"use client";

import { useEffect, useState } from "react";
import {
  AudioLines,
  CircleAlert,
  FileDown,
  Loader2,
  Mic,
  Pencil,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { voiceDisplayName, type VoiceNoteSummary } from "@/lib/voice";
import { VOICE_TITLE_MAX } from "@/lib/models";
import { cn } from "@/lib/utils";
import {
  deleteVoiceNote,
  fmt,
  renameVoiceNote,
  useVoiceRecorder,
  type Budget,
  type RecPosition,
} from "@/components/notes/voice-shared";

/**
 * Floating record/list/budget surface, mounted on both note types. State is
 * owned by `NoteWorkspace` and passed in, so the panel, canvas pins, and inline
 * document blocks all read one list and stay in sync (Phase 4b).
 *
 * `getPosition` (canvas) tags a new recording with a pin location; `onInserted`
 * (document) is called with the created voice note so it can be dropped inline.
 */
export function VoicePanel({
  noteId,
  voiceNotes,
  budget,
  canEdit,
  onChanged,
  getPosition,
  onInserted,
  onAddToDocument,
}: {
  noteId: string;
  voiceNotes: VoiceNoteSummary[];
  budget: Budget;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  getPosition?: () => RecPosition | null;
  onInserted?: (voiceNote: VoiceNoteSummary) => void;
  /** Document notes only: re-insert an existing recording as an inline block. */
  onAddToDocument?: (voiceNote: VoiceNoteSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VoiceNoteSummary | null>(
    null,
  );

  const remaining = Math.max(0, budget.limitSeconds - budget.usedSeconds);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-brand-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        aria-label={`Voice notes${voiceNotes.length ? ` (${voiceNotes.length})` : ""}`}
      >
        <AudioLines className="size-4" />
        Voice
        {voiceNotes.length > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-foreground/20 px-1.5 text-xs tabular-nums">
            {voiceNotes.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <VoiceDrawer
          noteId={noteId}
          voiceNotes={voiceNotes}
          budget={budget}
          remaining={remaining}
          canEdit={canEdit}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
          getPosition={getPosition}
          onInserted={onInserted}
          onAddToDocument={onAddToDocument}
          onRequestDelete={setPendingDelete}
        />
      ) : null}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the audio and frees its{" "}
              {pendingDelete ? fmt(pendingDelete.durationSec) : "0:00"} from your
              voice budget. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                const target = pendingDelete;
                setPendingDelete(null);
                if (!target) return;
                if (await deleteVoiceNote(target.id)) {
                  toast.success("Recording deleted.");
                }
                await onChanged();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VoiceDrawer({
  noteId,
  voiceNotes,
  budget,
  remaining,
  canEdit,
  onClose,
  onChanged,
  getPosition,
  onInserted,
  onAddToDocument,
  onRequestDelete,
}: {
  noteId: string;
  voiceNotes: VoiceNoteSummary[];
  budget: Budget;
  remaining: number;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  getPosition?: () => RecPosition | null;
  onInserted?: (voiceNote: VoiceNoteSummary) => void;
  onAddToDocument?: (voiceNote: VoiceNoteSummary) => void;
  onRequestDelete: (note: VoiceNoteSummary) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const usedPct = Math.min(
    100,
    (budget.usedSeconds / budget.limitSeconds) * 100,
  );
  const nearLimit = usedPct >= 80;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
        aria-label="Close voice notes"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Voice notes"
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l bg-background shadow-xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
            <AudioLines className="size-4 text-brand" />
            Voice notes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Voice budget</span>
            <span
              className={cn(
                "font-mono tabular-nums",
                nearLimit ? "text-record" : "text-muted-foreground",
              )}
            >
              {fmt(budget.usedSeconds)} / {fmt(budget.limitSeconds)}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(usedPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Voice budget used"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                nearLimit ? "bg-record" : "bg-brand",
              )}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {canEdit ? (
          <RecorderControls
            noteId={noteId}
            remaining={remaining}
            getPosition={getPosition}
            onChanged={onChanged}
            onInserted={onInserted}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {voiceNotes.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <Mic className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">No recordings yet</p>
              <p className="mt-1 max-w-[15rem] text-pretty text-xs text-muted-foreground">
                {canEdit
                  ? "Record a voice note — the recording is the content, any length, any language."
                  : "No voice notes have been added to this note yet."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {voiceNotes.map((note, i) => (
                <VoiceNoteRow
                  key={note.id}
                  note={note}
                  index={i}
                  canEdit={canEdit}
                  onChanged={onChanged}
                  onAddToDocument={onAddToDocument}
                  onRequestDelete={onRequestDelete}
                  onClose={onClose}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function VoiceNoteRow({
  note,
  index,
  canEdit,
  onChanged,
  onAddToDocument,
  onRequestDelete,
  onClose,
}: {
  note: VoiceNoteSummary;
  index: number;
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onAddToDocument?: (voiceNote: VoiceNoteSummary) => void;
  onRequestDelete: (note: VoiceNoteSummary) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(note.title ?? "");
  const fallback = `Recording ${index + 1}`;
  const displayName = voiceDisplayName(note.title, fallback);

  async function commit() {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed === (note.title ?? "")) return; // unchanged
    if (await renameVoiceNote(note.id, trimmed.length ? trimmed : null)) {
      await onChanged();
    }
  }

  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={VOICE_TITLE_MAX}
            placeholder={fallback}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              } else if (e.key === "Escape") {
                setName(note.title ?? "");
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Recording name"
          />
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => {
              setName(note.title ?? "");
              setEditing(true);
            }}
            className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
            title="Rename recording"
          >
            <span className="truncate text-sm font-medium">{displayName}</span>
            <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {displayName}
          </span>
        )}

        {!editing && canEdit ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {onAddToDocument ? (
              <button
                type="button"
                onClick={() => {
                  onAddToDocument(note);
                  toast.success("Added to the document.");
                  onClose();
                }}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Add ${displayName} to the document`}
                title="Add to document"
              >
                <FileDown className="size-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRequestDelete(note)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Delete ${displayName}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">
        {note.uploaderName ? `${note.uploaderName} · ` : ""}
        {fmt(note.durationSec)}
        {note.position ? " · pinned" : ""}
      </p>

      <audio
        controls
        preload="metadata"
        src={note.audioUrl}
        className="mt-2 h-9 w-full"
      />
    </li>
  );
}

function RecorderControls({
  noteId,
  remaining,
  getPosition,
  onChanged,
  onInserted,
}: {
  noteId: string;
  remaining: number;
  getPosition?: () => RecPosition | null;
  onChanged: () => Promise<void>;
  onInserted?: (voiceNote: VoiceNoteSummary) => void;
}) {
  const { state, elapsed, start, stop } = useVoiceRecorder({
    noteId,
    remaining,
    getPosition,
    onUploaded: async (voiceNote) => {
      if (voiceNote && onInserted) onInserted(voiceNote);
      await onChanged();
    },
  });

  const budgetFull = remaining <= 0;

  if (state === "uploading") {
    return (
      <div className="flex items-center justify-center gap-2 border-b bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Saving recording…
      </div>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center justify-between gap-3 border-b bg-record/5 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-record-pulse rounded-full bg-record" />
          </span>
          <span className="font-mono text-sm tabular-nums text-record">
            {fmt(elapsed)}
          </span>
          <span className="text-xs text-muted-foreground">
            / {fmt(remaining)} left
          </span>
        </div>
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-lg bg-record px-3 py-2 text-sm font-medium text-record-foreground hover:bg-record/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          <Square className="size-3.5 fill-current" />
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="border-b px-4 py-4">
      <button
        type="button"
        onClick={start}
        disabled={budgetFull}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Mic className="size-4" />
        Record a voice note
      </button>
      {budgetFull ? (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-record">
          <CircleAlert className="size-3.5" />
          Voice budget full — delete a recording to free space.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {fmt(remaining)} of recording time left.
        </p>
      )}
    </div>
  );
}
