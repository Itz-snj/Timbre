import { ObjectId } from "mongodb";
import { get } from "@vercel/blob";
import { ZipArchive } from "archiver";
import { currentUser, jsonError, notFound, unauthorized } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { notesCollection, voiceNotesCollection } from "@/lib/mongodb";
import { accessFilter } from "@/lib/note-access";
import { buildManifest, vnoteFilename } from "@/lib/vnote";

// Reads the session cookie, pulls from Blob, builds a zip — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/notes/{id}/export:
 *   get:
 *     tags: [Notes]
 *     summary: Export a note as a .vnote bundle
 *     description: >
 *       Packages a note the caller owns into a `.vnote` file — a zip containing a
 *       manifest (note content + voice-note index) and every voice note's audio
 *       under `audio/`. The audio is pulled from the private Blob store and
 *       written into the zip; the response is a file download.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The .vnote file (application/zip).
 *         content:
 *           application/zip: {}
 *       401:
 *         description: No valid session cookie.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
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
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const noteId = new ObjectId(id);

  const notes = await notesCollection();
  const note = await notes.findOne({ _id: noteId, ...accessFilter(user.firebaseUid) });
  if (!note) return notFound("Note not found.");

  const voiceNotes = await voiceNotesCollection();
  const voice = await voiceNotes.find({ noteId }).sort({ createdAt: 1 }).toArray();

  const token = serverEnv().BLOB_READ_WRITE_TOKEN;
  if (voice.length > 0 && !token) {
    console.error("[export] BLOB_READ_WRITE_TOKEN is not set — cannot read audio.");
    return jsonError("Voice storage is not configured.", 503);
  }

  const { manifest, audio } = buildManifest(note, voice);

  // Buffer the zip. The 5-minute per-user voice budget caps a note's audio at
  // roughly 2MB, so the whole bundle stays comfortably within the function's
  // memory and time budget. At unbounded scale you'd stream archiver straight
  // into the response instead (see README) — here buffering is simpler and safe.
  const archive = new ZipArchive({ zlib: { level: 0 } }); // audio is already compressed
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", reject);
  });

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  for (const entry of audio) {
    const result = await get(entry.blobPathname, {
      access: "private",
      token: token!,
    });
    if (result && result.statusCode === 200) {
      const buf = Buffer.from(await new Response(result.stream).arrayBuffer());
      archive.append(buf, { name: entry.audioFile });
    }
  }

  await archive.finalize();
  await finished;
  const zip = Buffer.concat(chunks);

  return new Response(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${vnoteFilename(note.title)}"`,
      "Content-Length": String(zip.length),
    },
  });
}
