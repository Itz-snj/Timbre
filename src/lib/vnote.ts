import { z } from "zod";
import { NOTE_TITLE_MAX, type NoteDoc, type VoiceNoteDoc } from "@/lib/models";
import { extForAudioType } from "@/lib/voice";

/**
 * The `.vnote` bundle format (technical-spec §5): a zip carrying a
 * `manifest.json` plus the note's audio under `audio/`. This module owns the
 * manifest's shape — the Zod schema that every *imported* file is validated
 * against (never trust an uploaded file, §7) and the builder that produces one
 * on export — so export and import can never drift apart.
 */

export const VNOTE_VERSION = "2.0";

const positionSchema = z.object({ x: z.number(), y: z.number() });

const manifestVoiceSchema = z.object({
  /** Path of the audio inside the zip, e.g. "audio/vn_1.webm". */
  audioFile: z.string().min(1),
  /** The voice note's id in the *source* database — used to remap document refs. */
  originalId: z.string().min(1),
  title: z.string().max(200).nullable().default(null),
  transcript: z.string().nullable().default(null),
  language: z.string().nullable().default(null),
  durationSec: z.number().nonnegative(),
  position: positionSchema.nullable().default(null),
  mimeType: z.string().default("audio/webm"),
});

export const vnoteManifestSchema = z.object({
  version: z.string(),
  type: z.literal("vnote-bundle"),
  noteType: z.enum(["canvas", "document"]),
  meta: z.object({
    title: z.string().trim().min(1).max(NOTE_TITLE_MAX),
    exportedAt: z.string().optional(),
    originalId: z.string().optional(),
  }),
  canvas: z
    .object({
      elements: z.array(z.unknown()).default([]),
      appState: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable()
    .default(null),
  document: z
    .object({
      contentJSON: z.record(z.string(), z.unknown()).nullable(),
    })
    .nullable()
    .default(null),
  voiceNotes: z.array(manifestVoiceSchema).default([]),
});

export type VnoteManifest = z.infer<typeof vnoteManifestSchema>;
export type ManifestVoice = z.infer<typeof manifestVoiceSchema>;

/** An audio file to stream into the export zip, and where it lives in Blob. */
export interface AudioEntry {
  audioFile: string;
  blobPathname: string;
}

/**
 * Assemble the manifest for a note plus the list of audio files to append.
 * Voice notes are numbered `vn_1…` for stable, human-legible zip paths; their
 * real ids ride along as `originalId` so document references can be remapped on
 * import.
 */
export function buildManifest(
  note: NoteDoc,
  voiceNotes: VoiceNoteDoc[],
): { manifest: VnoteManifest; audio: AudioEntry[] } {
  const audio: AudioEntry[] = [];

  const manifestVoiceNotes: ManifestVoice[] = voiceNotes.map((vn, i) => {
    const audioFile = `audio/vn_${i + 1}.${extForAudioType(vn.mimeType)}`;
    audio.push({ audioFile, blobPathname: vn.blobPathname });
    return {
      audioFile,
      originalId: vn._id!.toString(),
      title: vn.title,
      transcript: vn.transcript,
      language: vn.language,
      durationSec: vn.durationSec,
      position: vn.position,
      mimeType: vn.mimeType,
    };
  });

  const manifest: VnoteManifest = {
    version: VNOTE_VERSION,
    type: "vnote-bundle",
    noteType: note.noteType,
    meta: {
      title: note.title,
      exportedAt: new Date().toISOString(),
      originalId: note._id!.toString(),
    },
    canvas:
      note.noteType === "canvas"
        ? {
            elements: note.canvasElements ?? [],
            appState: note.canvasAppState ?? {},
          }
        : null,
    document:
      note.noteType === "document"
        ? { contentJSON: note.documentContent ?? null }
        : null,
    voiceNotes: manifestVoiceNotes,
  };

  return { manifest, audio };
}

/**
 * Rewrite the `voiceNoteId` on every inline voice block in a Tiptap document,
 * mapping each source id to the freshly-created one. Without this, an imported
 * document's blocks would point at voice notes that don't exist in the new note.
 * Returns a new tree; the input isn't mutated.
 */
export function remapDocumentVoiceIds(
  content: unknown,
  idMap: Map<string, string>,
): unknown {
  if (!content || typeof content !== "object") return content;

  const node = content as {
    type?: string;
    attrs?: Record<string, unknown>;
    content?: unknown[];
  };
  const next: Record<string, unknown> = { ...node };

  if (
    node.type === "voiceNote" &&
    typeof node.attrs?.voiceNoteId === "string"
  ) {
    const mapped = idMap.get(node.attrs.voiceNoteId);
    if (mapped) next.attrs = { ...node.attrs, voiceNoteId: mapped };
  }

  if (Array.isArray(node.content)) {
    next.content = node.content.map((child) =>
      remapDocumentVoiceIds(child, idMap),
    );
  }

  return next;
}

/** A safe download filename for a note, e.g. "Sprint planning" → "sprint-planning.vnote". */
export function vnoteFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "note"}.vnote`;
}
