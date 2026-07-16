import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth";
import { notesCollection } from "@/lib/mongodb";
import { accessFilter, noteRole } from "@/lib/note-access";
import { NoteWorkspace } from "@/components/notes/note-workspace";

// Reads the session cookie and queries Mongo — never prerender this.
export const dynamic = "force-dynamic";

export default async function NoteEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  if (!ObjectId.isValid(id)) notFound();
  const _id = new ObjectId(id);

  const notes = await notesCollection();
  let note = await notes.findOne({ _id, ...accessFilter(user.firebaseUid) });

  // Not already the owner or a collaborator — but if this note is link-shared,
  // opening it joins you as an editor. This is what makes an invite link work.
  if (!note) {
    const shared = await notes.findOne({ _id, shareEnabled: true });
    if (shared && shared.ownerId !== user.firebaseUid) {
      await notes.updateOne(
        { _id, "collaborators.userId": { $ne: user.firebaseUid } },
        {
          $push: {
            collaborators: {
              userId: user.firebaseUid,
              role: shared.shareRole ?? "editor",
            },
          },
        },
      );
      note = await notes.findOne({ _id, ...accessFilter(user.firebaseUid) });
    }
  }

  // Same 404 whether the note is missing, private, or not shared with you.
  if (!note) notFound();

  const role = noteRole(note, user.firebaseUid);

  return (
    <NoteWorkspace
      noteId={id}
      noteType={note.noteType}
      title={note.title}
      userName={user.name?.split(" ")[0] ?? "Someone"}
      userPhotoURL={user.photoURL}
      isOwner={role === "owner"}
      canEdit={role !== "viewer"}
      isShared={note.shareEnabled || note.collaborators.length > 0}
      shareEnabled={note.shareEnabled ?? false}
      shareRole={note.shareRole ?? "editor"}
      initialElements={note.canvasElements ?? []}
      initialAppState={note.canvasAppState ?? {}}
      initialContent={note.documentContent ?? null}
    />
  );
}
