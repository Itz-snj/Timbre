import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  currentUser,
  jsonError,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { notesCollection } from "@/lib/mongodb";
import { canvasSaveSchema } from "@/lib/notes";

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
  // The `noteType: "canvas"` in the filter is a guard, not an optimisation: it
  // means the $set can never land canvas fields on a document note. When it
  // matches nothing we do a second read purely to tell 404 (no such note) apart
  // from 409 (wrong type) for a useful error.
  const updated = await notes.findOneAndUpdate(
    { _id, ownerId: user.firebaseUid, noteType: "canvas" },
    {
      $set: {
        canvasElements: parsed.elements,
        canvasAppState: parsed.appState,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (updated) {
    return NextResponse.json({ updatedAt: updated.updatedAt.toISOString() });
  }

  const exists = await notes.findOne({ _id, ownerId: user.firebaseUid });
  if (!exists) return notFound("Note not found.");
  return jsonError("This note is not a canvas note.", 409);
}
