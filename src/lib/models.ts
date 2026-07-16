import type { ObjectId } from "mongodb";

/**
 * Mongo document shapes. See technical-spec-voicenote-canvas.md §4.
 *
 * `users` and `notes` exist as of Phase 1; `voiceNotes` as of Phase 4.
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
  /** Shared-access list — populated when someone opens a share link and joins. */
  collaborators: Collaborator[];
  /**
   * When true, any signed-in user who opens this note's link joins as a
   * collaborator with role `shareRole` ("anyone with the link can edit/view").
   * Owner-controlled.
   */
  shareEnabled: boolean;
  /** The role link-openers get while sharing is on. Defaults to editor. */
  shareRole: CollaboratorRole;

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

/** Max voice-note name length. Kept in one place so the API and UI agree. */
export const VOICE_TITLE_MAX = 80;

/** Where a voice note is pinned on a canvas note, in excalidraw scene coords. */
export interface VoiceNotePosition {
  x: number;
  y: number;
}

export interface VoiceNoteDoc {
  _id?: ObjectId;
  /** The note this recording belongs to. */
  noteId: ObjectId;
  /** Firebase UID of whoever recorded it — the identity charged for the budget. */
  uploaderId: string;
  /** Display name of the recorder, denormalized so shared notes can show "recorded by …". */
  uploaderName: string | null;
  /** User-given name for the recording; `null` until named (UI shows "Recording N"). */
  title: string | null;
  /**
   * The audio lives in a **private** Vercel Blob store; the audio itself never
   * touches Mongo (ai_rules §2 rule 3). We keep the pathname (used to stream it
   * back via `get(..., { access: "private" })` and to delete it) and the blob
   * URL for reference — but a private URL isn't directly fetchable, so playback
   * goes through our authenticated proxy (`GET /api/voice/[id]/audio`), never
   * this URL straight into an `<audio>` tag.
   */
  blobPathname: string;
  blobUrl: string;
  /** Groq Whisper output, filled in only if the user explicitly transcribes (Phase 4 optional). */
  transcript: string | null;
  language: string | null;
  /**
   * Pin location for canvas notes; `null` for document notes (where the
   * recording is referenced inline as a block instead). Set in Phase 4b.
   */
  position: VoiceNotePosition | null;
  /**
   * Duration in seconds, parsed server-side from the uploaded audio — never the
   * client-reported value (ai_rules §9). This is what the voice budget counts.
   */
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}
