import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { put } from "@vercel/blob";
import { parseBuffer } from "music-metadata";
import {
  currentUser,
  jsonError,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { notesCollection, voiceNotesCollection } from "@/lib/mongodb";
import { VOICE_BUDGET_SECONDS, type VoiceNoteDoc } from "@/lib/models";
import { reserveBudget, refundBudget } from "@/lib/voice-budget";
import {
  extForAudioType,
  isAllowedAudioType,
  toVoiceNoteSummary,
  voiceUploadMetaSchema,
  VOICE_MAX_BYTES,
} from "@/lib/voice";

// Reads the session cookie, streams to Blob, writes Mongo — never prerender.
export const dynamic = "force-dynamic";

/**
 * @swagger
 * /api/notes/{id}/voice:
 *   get:
 *     tags: [Voice notes]
 *     summary: List a note's voice notes
 *     description: >
 *       Returns every voice note attached to a note the caller owns, oldest
 *       first, plus the caller's current voice-budget usage. Only metadata — the
 *       audio itself is served from its Vercel Blob URL, never through Mongo.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The note's voice notes and the caller's budget usage.
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
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const noteId = new ObjectId(id);

  const notes = await notesCollection();
  const note = await notes.findOne({ _id: noteId, ownerId: user.firebaseUid });
  if (!note) return notFound("Note not found.");

  const voiceNotes = await voiceNotesCollection();
  const docs = await voiceNotes.find({ noteId }).sort({ createdAt: 1 }).toArray();

  return NextResponse.json({
    voiceNotes: docs.map(toVoiceNoteSummary),
    budget: {
      usedSeconds: user.totalVoiceSeconds,
      limitSeconds: VOICE_BUDGET_SECONDS,
    },
  });
}

/**
 * @swagger
 * /api/notes/{id}/voice:
 *   post:
 *     tags: [Voice notes]
 *     summary: Upload a voice note and attach it to a note
 *     description: >
 *       Accepts an audio recording as multipart form-data and attaches it to a
 *       note the caller owns. The recording's duration is read server-side from
 *       the audio itself (never trusting a client-reported value), then checked
 *       against the caller's 5-minute total voice budget with an atomic
 *       reservation *before* the audio is stored — a rejected recording never
 *       reaches Blob storage. On success the audio lands in Vercel Blob and only
 *       its URL + metadata are saved to Mongo.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio]
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: The audio file (webm/ogg/mp4/mpeg/wav).
 *               position:
 *                 type: string
 *                 description: Optional JSON "{x,y}" pin for canvas notes; omit for document notes.
 *     responses:
 *       201:
 *         description: Voice note stored and attached.
 *       400:
 *         description: Not multipart, missing/empty audio, or bad position JSON.
 *       401:
 *         description: No valid session cookie.
 *       403:
 *         description: Would exceed the 5-minute per-user voice budget.
 *       404:
 *         description: No such note, or it isn't owned by the caller.
 *       413:
 *         description: Recording exceeds the size cap.
 *       415:
 *         description: Not a supported audio type.
 *       422:
 *         description: Audio duration could not be read.
 *       502:
 *         description: Blob storage upload failed.
 *       503:
 *         description: Voice storage isn't configured (no Blob token).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!ObjectId.isValid(id)) return notFound("Note not found.");
  const noteId = new ObjectId(id);

  const notes = await notesCollection();
  const note = await notes.findOne({ _id: noteId, ownerId: user.firebaseUid });
  if (!note) return notFound("Note not found.");

  const token = serverEnv().BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[voice] BLOB_READ_WRITE_TOKEN is not set — cannot store audio.");
    return jsonError("Voice storage is not configured.", 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form-data.", 400);
  }

  const file = form.get("audio");
  if (!(file instanceof File)) return jsonError("Missing audio file.", 400);
  if (file.size === 0) return jsonError("Audio file is empty.", 400);
  if (file.size > VOICE_MAX_BYTES) {
    return jsonError("Recording is too large.", 413);
  }
  if (!isAllowedAudioType(file.type)) {
    return jsonError("Unsupported audio type.", 415);
  }

  // `position` is a JSON string in multipart; parse then validate the envelope.
  let position: unknown = null;
  const rawPosition = form.get("position");
  if (typeof rawPosition === "string" && rawPosition.trim().length > 0) {
    try {
      position = JSON.parse(rawPosition);
    } catch {
      return jsonError("position must be valid JSON.", 400);
    }
  }
  const meta = voiceUploadMetaSchema.safeParse({ position });
  if (!meta.success) return validationError(meta.error);

  const buffer = Buffer.from(await file.arrayBuffer());

  // Duration comes from the audio itself, not the client (ai_rules §9).
  // `{ duration: true }` forces a full scan — MediaRecorder's WebM/Ogg output
  // has no duration in its header, so it must be counted, not read.
  let durationSec = 0;
  try {
    const audio = await parseBuffer(new Uint8Array(buffer), file.type, {
      duration: true,
    });
    durationSec = Math.round(audio.format.duration ?? 0);
  } catch (error) {
    console.error("[voice] duration parse failed:", error);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return jsonError("Could not read the audio duration.", 422);
  }

  // Reserve budget BEFORE the upload; a rejection never touches Blob.
  const reserved = await reserveBudget(user.firebaseUid, durationSec);
  if (!reserved) {
    return jsonError("Voice note budget exceeded.", 403, {
      limitSeconds: VOICE_BUDGET_SECONDS,
      usedSeconds: user.totalVoiceSeconds,
    });
  }

  let blobPathname: string;
  let blobUrl: string;
  try {
    const ext = extForAudioType(file.type);
    // Private store: the audio is not publicly fetchable by URL — playback goes
    // through GET /api/voice/[id]/audio, which authenticates then streams it.
    const blob = await put(`voice-notes/${id}/${crypto.randomUUID()}.${ext}`, buffer, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
      token,
    });
    blobPathname = blob.pathname;
    blobUrl = blob.url;
  } catch (error) {
    // Upload failed after we'd already charged the budget — give it back.
    await refundBudget(user.firebaseUid, durationSec);
    console.error("[voice] Blob upload failed:", error);
    return jsonError("Could not store the recording. Please try again.", 502);
  }

  const voiceNotes = await voiceNotesCollection();
  const doc: VoiceNoteDoc = {
    noteId,
    uploaderId: user.firebaseUid,
    title: null,
    blobPathname,
    blobUrl,
    transcript: null,
    language: null,
    position: meta.data.position ?? null,
    durationSec,
    mimeType: file.type,
    sizeBytes: file.size,
    createdAt: new Date(),
  };
  const { insertedId } = await voiceNotes.insertOne(doc);

  // Surface voice activity on the dashboard's "edited" ordering.
  await notes.updateOne({ _id: noteId }, { $set: { updatedAt: new Date() } });

  return NextResponse.json(
    { voiceNote: toVoiceNoteSummary({ ...doc, _id: insertedId }) },
    { status: 201 },
  );
}
