import "server-only";

import type { Collection, Filter, ObjectId } from "mongodb";
import type { CollaboratorRole, NoteDoc } from "@/lib/models";

export type NoteRole = "owner" | CollaboratorRole; // owner | editor | viewer

/**
 * Access control for notes. A note is reachable by its **owner** or anyone in
 * its **collaborators** list (added by opening a share link — see the editor
 * page). This is the one place that rule lives, so every route agrees.
 *
 * Note: only the *owner* may do owner-scoped things (delete the note, manage
 * sharing). Those routes check ownership directly; everything else — reading and
 * editing content, voice notes, export — uses the access filter here.
 */

/** Mongo filter matching notes the user can **read** (owner or any collaborator). */
export function accessFilter(uid: string): Filter<NoteDoc> {
  return {
    $or: [{ ownerId: uid }, { collaborators: { $elemMatch: { userId: uid } } }],
  };
}

/**
 * Mongo filter matching notes the user can **write** — owner or an *editor*
 * collaborator. Viewers match `accessFilter` but not this, so a write route can
 * tell "no access" (404) apart from "view-only" (403) with a second read.
 */
export function writeAccessFilter(uid: string): Filter<NoteDoc> {
  return {
    $or: [
      { ownerId: uid },
      { collaborators: { $elemMatch: { userId: uid, role: "editor" } } },
    ],
  };
}

/** The user's role on a note, or null if they can't access it. */
export function noteRole(note: NoteDoc, uid: string): NoteRole | null {
  if (note.ownerId === uid) return "owner";
  const collab = note.collaborators.find((c) => c.userId === uid);
  return collab ? collab.role : null;
}

export type WriteAccess =
  | { ok: true; note: NoteDoc }
  | { ok: false; viewOnly: boolean };

/**
 * Resolves whether the user may write to a note: the note plus their role in one
 * read. `viewOnly` distinguishes "you can see it but not edit" (→ 403) from "no
 * such note / no access" (→ 404) so callers respond correctly.
 */
export async function checkWritable(
  notes: Collection<NoteDoc>,
  id: ObjectId,
  uid: string,
): Promise<WriteAccess> {
  const note = await notes.findOne({ _id: id, ...accessFilter(uid) });
  if (!note) return { ok: false, viewOnly: false };
  if (noteRole(note, uid) === "viewer") return { ok: false, viewOnly: true };
  return { ok: true, note };
}

/** The note if the user may access it (owner or collaborator), else null. */
export async function findAccessibleNote(
  notes: Collection<NoteDoc>,
  id: ObjectId,
  uid: string,
): Promise<NoteDoc | null> {
  const note = await notes.findOne({ _id: id, ...accessFilter(uid) });
  return note ?? null;
}

export function isNoteOwner(note: NoteDoc, uid: string): boolean {
  return note.ownerId === uid;
}
