import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth";
import { notesCollection } from "@/lib/mongodb";
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

  const notes = await notesCollection();
  const note = await notes.findOne({ _id: new ObjectId(id) });
  // Same 404 whether the note is missing or owned by someone else — never
  // confirm a stranger's note id exists (mirrors the API routes).
  if (!note || note.ownerId !== user.firebaseUid) notFound();

  return (
    <NoteWorkspace
      noteId={id}
      noteType={note.noteType}
      title={note.title}
      initialElements={note.canvasElements ?? []}
      initialAppState={note.canvasAppState ?? {}}
      initialContent={note.documentContent ?? null}
    />
  );
}
