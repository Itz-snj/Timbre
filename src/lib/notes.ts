import { z } from "zod";
import type { NoteDoc, NoteType } from "@/lib/models";
import { NOTE_TITLE_MAX } from "@/lib/models";

/**
 * Zod schemas + serialization for the `notes` API (ai_rules.md §2 rule 4:
 * every route validates its body with Zod). Kept out of the route files so the
 * list route, the id route, and any future importer share one definition.
 */

export const noteTypeSchema = z.enum(["canvas", "document"]);

/** A title the user typed: trimmed, non-empty, bounded. */
const titleSchema = z
  .string()
  .trim()
  .min(1, "Title cannot be empty.")
  .max(NOTE_TITLE_MAX, `Title must be at most ${NOTE_TITLE_MAX} characters.`);

/**
 * Create body. `title` is optional — the "new note" flow only forces the user
 * to pick a type; an omitted title is filled with a type-based default
 * server-side (see `defaultTitle`) so a note is never nameless.
 */
export const createNoteSchema = z.object({
  noteType: noteTypeSchema,
  title: titleSchema.optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

/** Rename body. Title is required here — there's nothing else to rename to. */
export const renameNoteSchema = z.object({
  title: titleSchema,
});

export type RenameNoteInput = z.infer<typeof renameNoteSchema>;

/**
 * Canvas autosave body. We store the excalidraw elements array verbatim
 * (technical-spec §4 — "stored as-is") and only a curated subset of appState
 * (viewport + zoom), never the full appState, which is mostly transient UI
 * state. `elements` are opaque here: validating each element's shape against
 * excalidraw's internal types would be brittle and pointless — excalidraw runs
 * its own `restore()` over them on load. Zod's job at this layer is just to
 * confirm the envelope is the right shape.
 */
export const canvasSaveSchema = z.object({
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()).default({}),
});

export type CanvasSaveInput = z.infer<typeof canvasSaveSchema>;

/** The name a note gets when the user didn't supply one at creation. */
export function defaultTitle(noteType: NoteType): string {
  return noteType === "canvas" ? "Untitled canvas" : "Untitled document";
}

/**
 * Wire shape of a note. `_id` and dates are stringified so the payload is plain
 * JSON — a Mongo `ObjectId`/`Date` would otherwise serialize into shapes the
 * client can't use directly. The heavy editor payloads (`canvasElements`,
 * `documentContent`) are deliberately omitted: the dashboard only needs the
 * summary, and the editor phases will fetch the full document on open.
 */
export interface NoteSummary {
  id: string;
  title: string;
  noteType: NoteType;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toNoteSummary(doc: NoteDoc): NoteSummary {
  return {
    id: doc._id!.toString(),
    title: doc.title,
    noteType: doc.noteType,
    ownerId: doc.ownerId,
    isPublic: doc.isPublic,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * The full note, editor payload included. What the canvas/document editors load
 * on open (Phases 2–3). In Phase 1 the payload fields are simply absent on a
 * freshly created note, so this reads as a summary until content exists.
 */
export interface NoteDetail extends NoteSummary {
  collaborators: NoteDoc["collaborators"];
  canvasElements?: NoteDoc["canvasElements"];
  canvasAppState?: NoteDoc["canvasAppState"];
  documentContent?: NoteDoc["documentContent"];
}

export function toNoteDetail(doc: NoteDoc): NoteDetail {
  return {
    ...toNoteSummary(doc),
    collaborators: doc.collaborators,
    canvasElements: doc.canvasElements,
    canvasAppState: doc.canvasAppState,
    documentContent: doc.documentContent,
  };
}
