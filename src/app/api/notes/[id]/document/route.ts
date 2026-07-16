import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  currentUser,
  forbidden,
  jsonError,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { notesCollection } from "@/lib/mongodb";
import { documentSaveSchema } from "@/lib/notes";
import { checkWritable } from "@/lib/note-access";

// Reads the session cookie and writes to Mongo per request — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/notes/{id}/document:
 *   put:
 *     tags: [Notes]
 *     summary: Save a document note's content
 *     description: >
 *       Persists the Tiptap/ProseMirror document JSON for a document note.
 *       Called by the editor's debounced autosave — a whole-document replace,
 *       not a delta. Only the owner can save, and only document notes accept
 *       content; saving to a canvas note returns 409.
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
 *             required: [content]
 *             properties:
 *               content:
 *                 type: object
 *                 description: The Tiptap doc JSON ({ type "doc", content [...] }), stored verbatim.
 *     responses:
 *       200:
 *         description: Saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updatedAt: { type: string, format: date-time }
 *       400:
 *         description: Body failed validation.
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
 *       409:
 *         description: The note exists but isn't a document note.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = await parseJsonBody(request, documentSaveSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const _id = new ObjectId(id);

  const notes = await notesCollection();
  // `noteType: "document"` in the filter guards against ever landing document
  // content on a canvas note; on no-match, a second read tells 404 (no such
  // note) apart from 409 (wrong type).
  const access = await checkWritable(notes, _id, user.firebaseUid);
  if (!access.ok) return access.viewOnly ? forbidden() : notFound("Note not found.");
  if (access.note.noteType !== "document") {
    return jsonError("This note is not a document note.", 409);
  }

  const now = new Date();
  await notes.updateOne(
    { _id },
    { $set: { documentContent: parsed.content, updatedAt: now } },
  );
  return NextResponse.json({ updatedAt: now.toISOString() });
}
