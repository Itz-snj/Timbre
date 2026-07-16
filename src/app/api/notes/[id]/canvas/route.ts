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
import { canvasSaveSchema } from "@/lib/notes";
import { checkWritable } from "@/lib/note-access";

// Reads the session cookie and writes to Mongo per request — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/notes/{id}/canvas:
 *   put:
 *     tags: [Notes]
 *     summary: Save a canvas note's drawing
 *     description: >
 *       Persists the excalidraw scene for a canvas note — the full elements array
 *       plus a small subset of view state (background, scroll, zoom). Called by
 *       the editor's debounced autosave, so it's a whole-scene replace, not a
 *       delta. Only the owner can save, and only canvas notes accept a drawing;
 *       saving to a document note returns 409.
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
 *             required: [elements]
 *             properties:
 *               elements:
 *                 type: array
 *                 items: { type: object }
 *                 description: The excalidraw elements array, stored verbatim.
 *               appState:
 *                 type: object
 *                 description: Curated view state (viewBackgroundColor, scrollX/Y, zoom).
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
 *         description: The note exists but isn't a canvas note.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = await parseJsonBody(request, canvasSaveSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const _id = new ObjectId(id);

  const notes = await notesCollection();
  const access = await checkWritable(notes, _id, user.firebaseUid);
  if (!access.ok) return access.viewOnly ? forbidden() : notFound("Note not found.");
  if (access.note.noteType !== "canvas") {
    return jsonError("This note is not a canvas note.", 409);
  }

  const now = new Date();
  await notes.updateOne(
    { _id },
    {
      $set: {
        canvasElements: parsed.elements,
        canvasAppState: parsed.appState,
        updatedAt: now,
      },
    },
  );
  return NextResponse.json({ updatedAt: now.toISOString() });
}
