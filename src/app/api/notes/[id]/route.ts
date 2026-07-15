import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { del } from "@vercel/blob";
import {
  currentUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { notesCollection, voiceNotesCollection } from "@/lib/mongodb";
import { renameNoteSchema, toNoteDetail } from "@/lib/notes";
import { refundBudget } from "@/lib/voice-budget";
import type { NoteDoc, UserDoc } from "@/lib/models";

// Reads the session cookie and queries Mongo per request — never prerender.
export const dynamic = "force-dynamic";

/**
 * Loads a note the caller is allowed to touch, or returns the response to send
 * instead. A malformed id and a note owned by someone else both resolve to the
 * same 404: never confirm to a stranger that a given note id exists.
 */
async function loadOwnedNote(
  id: string,
  user: UserDoc,
): Promise<NoteDoc | NextResponse> {
  if (!ObjectId.isValid(id)) return notFound("Note not found.");

  const notes = await notesCollection();
  const note = await notes.findOne({ _id: new ObjectId(id) });
  if (!note || note.ownerId !== user.firebaseUid) {
    return notFound("Note not found.");
  }
  return note;
}

/**
 * @swagger
 * /api/notes/{id}:
 *   get:
 *     tags: [Notes]
 *     summary: Fetch a single note in full
 *     description: >
 *       Returns one note the caller owns, including its editor payload (canvas
 *       elements or document content) once those exist. Used by the note editors
 *       when a note is opened.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The note's id.
 *     responses:
 *       200:
 *         description: The note.
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const note = await loadOwnedNote(id, user);
  if (note instanceof NextResponse) return note;

  return NextResponse.json({ note: toNoteDetail(note) });
}

/**
 * @swagger
 * /api/notes/{id}:
 *   patch:
 *     tags: [Notes]
 *     summary: Rename a note
 *     description: >
 *       Updates a note's title. Only the owner can rename, and only the title is
 *       editable here — the note type is fixed at creation.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The note's id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 120
 *     responses:
 *       200:
 *         description: The renamed note.
 *       400:
 *         description: Body failed validation (empty or overlong title).
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = await parseJsonBody(request, renameNoteSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");

  const notes = await notesCollection();
  // Fold the ownership check into the write: `ownerId` in the filter means a
  // note the caller doesn't own simply matches nothing, so there's no
  // find-then-update race where ownership could change between the two.
  const updated = await notes.findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: user.firebaseUid },
    { $set: { title: parsed.title, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  if (!updated) return notFound("Note not found.");
  return NextResponse.json({ note: toNoteDetail(updated) });
}

/**
 * @swagger
 * /api/notes/{id}:
 *   delete:
 *     tags: [Notes]
 *     summary: Delete a note
 *     description: >
 *       Permanently deletes a note the caller owns. Idempotent from the client's
 *       point of view — deleting a note that's already gone returns the same 404
 *       as a note that never existed.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The note's id.
 *     responses:
 *       204:
 *         description: Deleted.
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const _id = new ObjectId(id);

  const notes = await notesCollection();
  const note = await notes.findOne({ _id, ownerId: user.firebaseUid });
  if (!note) return notFound("Note not found.");

  // Cascade: a note's voice notes have no meaning without it, so delete their
  // blobs, refund each uploader's budget, and drop the records. Done before the
  // note itself so a failure leaves the note (and thus a retry path) intact.
  const voiceNotes = await voiceNotesCollection();
  const voice = await voiceNotes.find({ noteId: _id }).toArray();
  if (voice.length > 0) {
    const token = serverEnv().BLOB_READ_WRITE_TOKEN;
    for (const vn of voice) {
      await refundBudget(vn.uploaderId, vn.durationSec);
      if (token) {
        try {
          await del(vn.blobPathname, { token });
        } catch (error) {
          console.error("[note delete] blob cleanup failed (orphan):", error);
        }
      }
    }
    await voiceNotes.deleteMany({ noteId: _id });
  }

  await notes.deleteOne({ _id });
  return new NextResponse(null, { status: 204 });
}
