import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth";
import { notesCollection } from "@/lib/mongodb";
import { CanvasEditor } from "@/components/notes/canvas-editor";
import { DocumentEditor } from "@/components/notes/document-editor";
import { VoicePanel } from "@/components/notes/voice-panel";

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
    <div className="h-[calc(100dvh-4rem)]">
      {note.noteType === "canvas" ? (
        <CanvasEditor
          noteId={id}
          title={note.title}
          initialElements={note.canvasElements ?? []}
          initialAppState={note.canvasAppState ?? {}}
        />
      ) : (
        <DocumentEditor
          noteId={id}
          title={note.title}
          initialContent={note.documentContent ?? null}
        />
      )}

      {/* Voice notes work the same on both note types in Phase 4a; canvas pins
          and inline document blocks arrive in 4b. */}
      <VoicePanel noteId={id} />
    </div>
  );
}
