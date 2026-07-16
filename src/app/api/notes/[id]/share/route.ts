import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  currentUser,
  notFound,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { notesCollection } from "@/lib/mongodb";

// Reads the session cookie and writes to Mongo — never prerender.
export const dynamic = "force-dynamic";

const shareSchema = z.object({
  enabled: z.boolean(),
  role: z.enum(["editor", "viewer"]).optional(),
});

/**
 * @swagger
 * /api/notes/{id}/share:
 *   post:
 *     tags: [Notes]
 *     summary: Turn link-sharing on or off for a note
 *     description: >
 *       Only the note's owner can change this. When enabled, any signed-in user
 *       who opens the note's link is added as an editor collaborator ("anyone
 *       with the link can edit"). Turning it off stops new people joining;
 *       existing collaborators keep their access.
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
 *             required: [enabled]
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: The new sharing state.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shareEnabled: { type: boolean }
 *       400:
 *         description: Body failed validation.
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or the caller isn't its owner.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const parsed = await parseJsonBody(request, shareSchema);
  if (parsed instanceof NextResponse) return parsed;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");

  const set: Record<string, unknown> = {
    shareEnabled: parsed.enabled,
    updatedAt: new Date(),
  };
  if (parsed.role) set.shareRole = parsed.role;

  const notes = await notesCollection();
  // Owner-only: sharing is a management action, so the filter pins ownerId.
  const updated = await notes.findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: user.firebaseUid },
    { $set: set },
    { returnDocument: "after" },
  );

  if (!updated) return notFound("Note not found.");
  return NextResponse.json({
    shareEnabled: updated.shareEnabled,
    shareRole: updated.shareRole,
  });
}
