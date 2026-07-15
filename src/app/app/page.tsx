import { NotebookPen } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { notesCollection } from "@/lib/mongodb";
import { toNoteSummary } from "@/lib/notes";
import { NewNoteButton } from "@/components/notes/new-note-button";
import { NoteCard } from "@/components/notes/note-card";

export const metadata = { title: "Your notes" };

// Reads the session cookie and queries Mongo — never prerender this.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Query Mongo directly in the server component for the first paint — no client
  // fetch waterfall. The interactive bits (create/rename/delete) go through the
  // API routes and then `router.refresh()` to re-run this query.
  const notes = await notesCollection();
  const docs = await notes
    .find({ ownerId: user.firebaseUid })
    .sort({ updatedAt: -1 })
    .toArray();
  const summaries = docs.map(toNoteSummary);

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight">
            {firstName ? `${firstName}'s notes` : "Your notes"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summaries.length === 0
              ? "Start a canvas to sketch, or a document to write."
              : `${summaries.length} note${summaries.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <NewNoteButton />
      </div>

      {summaries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
        <NotebookPen className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-heading text-xl font-medium tracking-tight">
        No notes yet
      </h2>
      <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
        Every note can hold a voice recording as its main content. Create your
        first one to get started — you can pick a freeform canvas or a linear
        document.
      </p>
      <div className="mt-6">
        <NewNoteButton />
      </div>
    </div>
  );
}
