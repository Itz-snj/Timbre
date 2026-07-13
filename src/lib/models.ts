import type { ObjectId } from "mongodb";

/**
 * Mongo document shapes. See technical-spec-voicenote-canvas.md §4.
 *
 * Only `users` exists in Phase 0 — `notes` lands in Phase 1 and `voiceNotes` in
 * Phase 4, each with its own phase's schemas.
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
