import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { put, del } from "@vercel/blob";
import { parseBuffer } from "music-metadata";
import AdmZip from "adm-zip";
import {
  currentUser,
  jsonError,
  unauthorized,
  validationError,
} from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { notesCollection, voiceNotesCollection } from "@/lib/mongodb";
import type { NoteDoc, VoiceNoteDoc } from "@/lib/models";
import { toNoteSummary } from "@/lib/notes";
import { isAllowedAudioType, extForAudioType } from "@/lib/voice";
import { reserveBudget, refundBudget } from "@/lib/voice-budget";
import {
  remapDocumentVoiceIds,
  vnoteManifestSchema,
  type ManifestVoice,
} from "@/lib/vnote";

// Reads the session cookie, uploads to Blob, writes Mongo — never prerender.
export const dynamic = "force-dynamic";

/** A .vnote is budget-capped audio + a small manifest, so it stays small. */
const VNOTE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * @swagger
 * /api/notes/import:
 *   post:
 *     tags: [Notes]
 *     summary: Import a .vnote bundle as a new note
 *     description: >
 *       Unpacks an uploaded `.vnote` file into a brand-new note owned by the
 *       caller. The manifest is validated against a strict schema (never trusting
 *       the file), each voice note's audio is re-uploaded to the private Blob
 *       store, and — for document notes — every inline voice-block reference is
 *       remapped to the freshly-created voice-note ids. The recordings count
 *       against the importer's 5-minute voice budget; if they'd exceed it the
 *       whole import is rejected before anything is stored.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The .vnote (zip) file.
 *     responses:
 *       201:
 *         description: Imported; returns the new note.
 *       400:
 *         description: Missing/invalid file, or the manifest failed validation.
 *       401:
 *         description: No valid session cookie.
 *       403:
 *         description: Importing would exceed the 5-minute voice budget.
 *       413:
 *         description: File exceeds the size cap.
 *       415:
 *         description: Bundle contains an unsupported audio type.
 *       503:
 *         description: Voice storage isn't configured (no Blob token).
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const token = serverEnv().BLOB_READ_WRITE_TOKEN;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart form-data.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Missing .vnote file.", 400);
  if (file.size === 0) return jsonError("File is empty.", 400);
  if (file.size > VNOTE_MAX_BYTES) return jsonError("File is too large.", 413);

  const zipBuffer = Buffer.from(await file.arrayBuffer());
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    return jsonError("Not a valid .vnote (zip) file.", 400);
  }

  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    return jsonError("Bundle is missing manifest.json.", 400);
  }
  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(zip.readAsText(manifestEntry));
  } catch {
    return jsonError("manifest.json is not valid JSON.", 400);
  }
  const parsedManifest = vnoteManifestSchema.safeParse(manifestRaw);
  if (!parsedManifest.success) return validationError(parsedManifest.error);
  const manifest = parsedManifest.data;

  // Pull each audio out of the zip and re-parse its duration from the bytes
  // themselves — the manifest's number is not trusted (ai_rules §9), or a
  // hand-edited bundle could under-report to slip past the budget.
  const items: {
    entry: ManifestVoice;
    buffer: Buffer;
    durationSec: number;
  }[] = [];
  for (const vn of manifest.voiceNotes) {
    const audioEntry = zip.getEntry(vn.audioFile);
    if (!audioEntry) {
      return jsonError(`Bundle is missing audio file: ${vn.audioFile}`, 400);
    }
    if (!isAllowedAudioType(vn.mimeType)) {
      return jsonError("Bundle contains an unsupported audio type.", 415);
    }
    const buffer = audioEntry.getData();
    let durationSec = 0;
    try {
      const meta = await parseBuffer(new Uint8Array(buffer), vn.mimeType, {
        duration: true,
      });
      durationSec = Math.round(meta.format.duration ?? 0);
    } catch {
      // fall through to the manifest value below
    }
    if (durationSec <= 0) durationSec = Math.max(1, Math.round(vn.durationSec));
    items.push({ entry: vn, buffer, durationSec });
  }

  if (items.length > 0 && !token) {
    console.error("[import] BLOB_READ_WRITE_TOKEN is not set — cannot store audio.");
    return jsonError("Voice storage is not configured.", 503);
  }

  // Reserve the whole import's budget up front; nothing is created if it won't fit.
  const totalSeconds = items.reduce((sum, i) => sum + i.durationSec, 0);
  if (totalSeconds > 0) {
    const reserved = await reserveBudget(user.firebaseUid, totalSeconds);
    if (!reserved) {
      return jsonError("Importing would exceed your 5-minute voice budget.", 403);
    }
  }

  // Past this point anything we create must be rolled back on failure.
  const notes = await notesCollection();
  const voiceNotesCol = await voiceNotesCollection();
  const now = new Date();
  const createdVoiceIds: ObjectId[] = [];
  const createdPathnames: string[] = [];
  let noteId: ObjectId | null = null;

  try {
    const noteDoc: NoteDoc = {
      title: manifest.meta.title,
      noteType: manifest.noteType,
      ownerId: user.firebaseUid,
      collaborators: [],
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };
    if (manifest.noteType === "canvas" && manifest.canvas) {
      noteDoc.canvasElements = manifest.canvas.elements;
      noteDoc.canvasAppState = manifest.canvas.appState;
    }
    const insertedNote = await notes.insertOne(noteDoc);
    noteId = insertedNote.insertedId;

    // Re-upload each recording under the new note and build old-id → new-id.
    const idMap = new Map<string, string>();
    for (const item of items) {
      const ext = extForAudioType(item.entry.mimeType);
      const blob = await put(
        `voice-notes/${noteId.toString()}/${crypto.randomUUID()}.${ext}`,
        item.buffer,
        {
          access: "private",
          contentType: item.entry.mimeType,
          addRandomSuffix: false,
          token: token!,
        },
      );
      createdPathnames.push(blob.pathname);

      const vnDoc: VoiceNoteDoc = {
        noteId,
        uploaderId: user.firebaseUid,
        title: item.entry.title,
        blobPathname: blob.pathname,
        blobUrl: blob.url,
        transcript: item.entry.transcript,
        language: item.entry.language,
        position: item.entry.position,
        durationSec: item.durationSec,
        mimeType: item.entry.mimeType,
        sizeBytes: item.buffer.length,
        createdAt: now,
      };
      const insertedVoice = await voiceNotesCol.insertOne(vnDoc);
      createdVoiceIds.push(insertedVoice.insertedId);
      idMap.set(item.entry.originalId, insertedVoice.insertedId.toString());
    }

    // Document notes reference voice notes by id inside the Tiptap JSON — remap
    // those to the new ids so the inline players resolve after import.
    if (manifest.noteType === "document") {
      const content = manifest.document?.contentJSON ?? null;
      const remapped = content
        ? (remapDocumentVoiceIds(content, idMap) as Record<string, unknown>)
        : null;
      await notes.updateOne(
        { _id: noteId },
        { $set: { documentContent: remapped, updatedAt: new Date() } },
      );
    }

    const finalNote = await notes.findOne({ _id: noteId });
    return NextResponse.json(
      { note: toNoteSummary(finalNote!) },
      { status: 201 },
    );
  } catch (error) {
    console.error("[import] failed — rolling back:", error);
    if (totalSeconds > 0) {
      await refundBudget(user.firebaseUid, totalSeconds).catch(() => {});
    }
    for (const vid of createdVoiceIds) {
      await voiceNotesCol.deleteOne({ _id: vid }).catch(() => {});
    }
    if (noteId) await notes.deleteOne({ _id: noteId }).catch(() => {});
    if (token) {
      for (const pathname of createdPathnames) {
        await del(pathname, { token }).catch(() => {});
      }
    }
    return jsonError("Could not import the file. Please try again.", 500);
  }
}
