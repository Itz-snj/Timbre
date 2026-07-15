import type { ObjectId } from "mongodb";

/**
 * Mongo document shapes. See technical-spec-voicenote-canvas.md §4.
 *
 * `users` and `notes` exist as of Phase 1; `voiceNotes` lands in Phase 4, with
 * its own phase's schemas.
 */

export interface UserDoc {
  _id?: ObjectId;
  /** Firebase UID — the identity we actually trust, taken from a verified token. */
  firebaseUid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
  /**
   * Running total behind the 5-minute per-user voice budget (ai_rules.md §9).
   * Incremented atomically before an upload, decremented on delete/rollback.
   */
  totalVoiceSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 5 minutes, in seconds — the per-user voice budget (ai_rules.md §9). */
export const VOICE_BUDGET_SECONDS = 300;

/**
 * The two note metaphors (ai_rules.md §1): a spatial Excalidraw-style `canvas`
 * and a linear Obsidian-style `document`. Chosen at creation and immutable —
 * the editor a note opens in is fixed for its lifetime.
 */
export type NoteType = "canvas" | "document";

export type CollaboratorRole = "editor" | "viewer";

export interface Collaborator {
  /** Firebase UID of the collaborator. */
  userId: string;
  role: CollaboratorRole;
}

export interface NoteDoc {
  _id?: ObjectId;
  title: string;
  noteType: NoteType;
  /**
   * Firebase UID of the owner — the same identity `requireUser()` trusts, so
   * ownership checks compare against `user.firebaseUid` with no extra lookup.
   */
  ownerId: string;
  /** Shared-access list. Empty until Phase 6 wires collaboration; present now so the shape is stable. */
  collaborators: Collaborator[];

  /**
   * Editor payloads, stored as the raw JSON each editor already produces
   * (technical-spec §4). Absent on a freshly created Phase 1 note — the canvas
   * fields land in Phase 2, the document field in Phase 3.
   */
  canvasElements?: unknown[]; // present only when noteType = "canvas"
  canvasAppState?: Record<string, unknown>; // present only when noteType = "canvas"
  documentContent?: Record<string, unknown> | null; // present only when noteType = "document"

  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Max note-title length. Kept in one place so the API and the UI agree. */
export const NOTE_TITLE_MAX = 120;
