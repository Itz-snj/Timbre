import { z } from "zod";
import { VOICE_TITLE_MAX, type VoiceNoteDoc } from "@/lib/models";

/**
 * Voice-note constants + schemas. See ai_rules.md §9 (budget) and the
 * technical-spec §3 (audio → Blob, metadata → Mongo).
 */

/**
 * Hard size cap on a single upload. The upload goes *through* our API route
 * (technical-spec §3 — so we can auth + size-check + budget-check before
 * anything is stored), and Vercel's serverless request body tops out around
 * 4.5MB. A full 5-minute budget of voice-optimised Opus is well under 2MB, so
 * 4MB is comfortable headroom that still stays under the platform limit. The
 * recorder is pinned to a low bitrate (see the recorder component) to match.
 */
export const VOICE_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Accepted container types. MediaRecorder emits WebM (Chrome) or Ogg (Firefox),
 * both Opus; the others are here so a re-imported `.vnote` (Phase 5) or an
 * unusual browser still round-trips. Anything not `audio/*` is rejected outright.
 */
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
] as const;

export function isAllowedAudioType(mime: string): boolean {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return (ALLOWED_AUDIO_TYPES as readonly string[]).includes(base);
}

/** File extension for the Blob object name, from the recording's MIME type. */
export function extForAudioType(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "bin";
  }
}

/** Pin location on a canvas note (excalidraw scene coords). Wired up in Phase 4b. */
export const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/**
 * The non-file fields of the upload's multipart body. The audio itself is read
 * from the FormData separately; `position` arrives as a JSON string (multipart
 * values are strings) and is optional — absent/omitted for document notes and
 * for the Phase 4a core panel, set once canvas pins land in 4b.
 */
export const voiceUploadMetaSchema = z.object({
  position: positionSchema.nullish(),
});

/**
 * Partial update for a voice note — move its pin and/or rename it. At least one
 * field must be present. `title` may be `null` to clear a name back to untitled.
 */
export const voiceUpdateSchema = z
  .object({
    position: positionSchema.optional(),
    title: z.string().trim().max(VOICE_TITLE_MAX).nullable().optional(),
  })
  .refine((v) => v.position !== undefined || v.title !== undefined, {
    message: "Provide a position or a title to update.",
  });

/** The name to show for a recording — the user's title, or a numbered fallback. */
export function voiceDisplayName(
  title: string | null | undefined,
  fallback: string,
): string {
  return title?.trim() || fallback;
}

export interface VoiceNoteSummary {
  id: string;
  noteId: string;
  uploaderId: string;
  title: string | null;
  /**
   * Where the client plays the audio from — our own authenticated proxy, not
   * the private blob URL (which the browser can't fetch directly). The real
   * blob location never leaves the server.
   */
  audioUrl: string;
  transcript: string | null;
  language: string | null;
  position: { x: number; y: number } | null;
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export function toVoiceNoteSummary(doc: VoiceNoteDoc): VoiceNoteSummary {
  const id = doc._id!.toString();
  return {
    id,
    noteId: doc.noteId.toString(),
    uploaderId: doc.uploaderId,
    title: doc.title ?? null,
    audioUrl: `/api/voice/${id}/audio`,
    transcript: doc.transcript,
    language: doc.language,
    position: doc.position,
    durationSec: doc.durationSec,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt.toISOString(),
  };
}
