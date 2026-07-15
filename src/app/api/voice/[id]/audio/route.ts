import { ObjectId } from "mongodb";
import { get } from "@vercel/blob";
import { currentUser, jsonError, notFound, unauthorized } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { notesCollection, voiceNotesCollection } from "@/lib/mongodb";

// Streams private audio per request — never prerender or cache at the edge.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/voice/{id}/audio:
 *   get:
 *     tags: [Voice notes]
 *     summary: Stream a voice note's audio
 *     description: >
 *       Streams the audio for a voice note the caller owns. The audio lives in a
 *       private Blob store, so it can't be fetched by URL directly — this route
 *       is the only way in: it verifies the session and note ownership, then
 *       pipes the blob back. This is what the player's `<audio>` element points
 *       at, so a leaked note id still can't expose someone else's recording.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The voice note's id.
 *     responses:
 *       200:
 *         description: The audio stream.
 *         content:
 *           audio/webm: {}
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such voice note, or its note isn't owned by the caller.
 *       503:
 *         description: Voice storage isn't configured (no Blob token).
 */
export async function GET(
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

  // Authorize through the parent note — same 404 for missing vs. not-owned.
  const notes = await notesCollection();
  const note = await notes.findOne({
    _id: voiceNote.noteId,
    ownerId: user.firebaseUid,
  });
  if (!note) return notFound("Voice note not found.");

  const token = serverEnv().BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[voice/audio] BLOB_READ_WRITE_TOKEN is not set.");
    return jsonError("Voice storage is not configured.", 503);
  }

  const result = await get(voiceNote.blobPathname, { access: "private", token });
  if (!result || result.statusCode !== 200) {
    return notFound("Audio not found.");
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      "Content-Type": voiceNote.mimeType,
      "Content-Length": String(voiceNote.sizeBytes),
      // The recording is private to this user; let the browser reuse it within
      // the session but never let a shared cache hold it.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
