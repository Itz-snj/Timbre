import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { notesCollection } from "@/lib/mongodb";
import { CanvasEditor } from "@/components/notes/canvas-editor";

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

  if (note.noteType === "canvas") {
    return (
      <div className="h-[calc(100dvh-4rem)]">
        <CanvasEditor
          noteId={id}
          title={note.title}
          initialElements={note.canvasElements ?? []}
          initialAppState={note.canvasAppState ?? {}}
        />
      </div>
    );
  }

  // Document editor is Phase 3. Until then the note opens to a deliberate
  // placeholder rather than a broken screen.
  return <DocumentPlaceholder title={note.title} />;
}

function DocumentPlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-document-muted text-document">
        <FileText className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
        The document editor arrives in the next build. Your note is saved and
        waiting — nothing here is lost.
      </p>
      <Link
        href="/app"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" />
        Back to notes
      </Link>
    </div>
  );
}
