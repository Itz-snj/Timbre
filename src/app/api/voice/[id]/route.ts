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
import { refundBudget } from "@/lib/voice-budget";
import { voiceUpdateSchema } from "@/lib/voice";

// Reads the session cookie and mutates Mongo/Blob — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/voice/{id}:
 *   patch:
 *     tags: [Voice notes]
 *     summary: Update a voice note (rename and/or move its pin)
 *     description: >
 *       Updates a voice note the caller owns (via ownership of its parent note).
 *       Send `title` to rename it (null clears the name back to untitled) and/or
 *       `position` to move its canvas pin. At least one field is required.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 nullable: true
 *                 maxLength: 80
 *               position:
 *                 type: object
 *                 required: [x, y]
 *                 properties:
 *                   x: { type: number }
 *                   y: { type: number }
 *     responses:
 *       200:
 *         description: Updated.
 *       400:
 *         description: Body failed validation (or neither field provided).
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such voice note, or its note isn't owned by the caller.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Voice note not found.");

  const parsed = await parseJsonBody(request, voiceUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const voiceNotes = await voiceNotesCollection();
  const voiceNote = await voiceNotes.findOne({ _id: new ObjectId(id) });
  if (!voiceNote) return notFound("Voice note not found.");

  const notes = await notesCollection();
  const note = await notes.findOne({
    _id: voiceNote.noteId,
    ownerId: user.firebaseUid,
  });
  if (!note) return notFound("Voice note not found.");

  // Only set the fields that were actually sent; an empty title clears the name.
  const update: Record<string, unknown> = {};
  if (parsed.position !== undefined) update.position = parsed.position;
  if (parsed.title !== undefined) update.title = parsed.title || null;

  await voiceNotes.updateOne({ _id: voiceNote._id }, { $set: update });
  return NextResponse.json({ ok: true });
}

/**
 * @swagger
 * /api/voice/{id}:
 *   delete:
 *     tags: [Voice notes]
 *     summary: Delete a voice note
 *     description: >
 *       Removes a voice note the caller owns (via ownership of its parent note),
 *       deletes the audio from Blob storage, and credits the recorded seconds
 *       back to the uploader's voice budget. Idempotent from the client's point
 *       of view — a voice note that's already gone returns the same 404.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The voice note's id.
 *     responses:
 *       204:
 *         description: Deleted.
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such voice note, or its note isn't owned by the caller.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Voice note not found.");

  const voiceNotes = await voiceNotesCollection();
  const voiceNote = await voiceNotes.findOne({ _id: new ObjectId(id) });
  if (!voiceNote) return notFound("Voice note not found.");

  // Authorize through the parent note: only the note's owner may delete its
  // recordings. Same 404 whether the note is missing or owned by someone else.
  const notes = await notesCollection();
  const note = await notes.findOne({
    _id: voiceNote.noteId,
    ownerId: user.firebaseUid,
  });
  if (!note) return notFound("Voice note not found.");

  // Remove the Mongo record first so it leaves the UI immediately; a concurrent
  // delete that already won returns 404.
  const { deletedCount } = await voiceNotes.deleteOne({ _id: voiceNote._id });
  if (deletedCount === 0) return notFound("Voice note not found.");

  // Credit the budget back to whoever recorded it.
  await refundBudget(voiceNote.uploaderId, voiceNote.durationSec);

  // Best-effort blob cleanup — the record is already gone, so a failure here
  // only orphans bytes in Blob (logged), it doesn't break the user's view.
  const token = serverEnv().BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      await del(voiceNote.blobPathname, { token });
    } catch (error) {
      console.error("[voice] Blob delete failed (orphaned object):", error);
    }
  }

  return new NextResponse(null, { status: 204 });
}
