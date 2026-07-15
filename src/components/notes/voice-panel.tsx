"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  CircleAlert,
  Loader2,
  Mic,
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
import { VOICE_BUDGET_SECONDS } from "@/lib/models";
import type { VoiceNoteSummary } from "@/lib/voice";
import { cn } from "@/lib/utils";

/** mm:ss — voice durations always read as time, never a raw second count. */
function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Pick the best audio container the browser can actually record. */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

type Budget = { usedSeconds: number; limitSeconds: number };

export function VoicePanel({ noteId }: { noteId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<VoiceNoteSummary[]>([]);
  const [budget, setBudget] = useState<Budget>({
    usedSeconds: 0,
    limitSeconds: VOICE_BUDGET_SECONDS,
  });
  const [loaded, setLoaded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VoiceNoteSummary | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/voice`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        voiceNotes: VoiceNoteSummary[];
        budget: Budget;
      };
      setNotes(data.voiceNotes);
      setBudget(data.budget);
    } catch {
      // Non-fatal: the panel just shows whatever it last had.
    } finally {
      setLoaded(true);
    }
  }, [noteId]);

  useEffect(() => {
    // Initial load on mount. setState happens only after the awaited fetch
    // resolves, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const remaining = Math.max(0, budget.limitSeconds - budget.usedSeconds);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-brand-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        aria-label={`Voice notes${notes.length ? ` (${notes.length})` : ""}`}
      >
        <AudioLines className="size-4" />
        Voice
        {notes.length > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-foreground/20 px-1.5 text-xs tabular-nums">
            {notes.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <VoiceDrawer
          noteId={noteId}
          notes={notes}
          budget={budget}
          remaining={remaining}
          loaded={loaded}
          onClose={() => setOpen(false)}
          onChanged={refresh}
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
                if (!target) return;
                try {
                  const res = await fetch(`/api/voice/${target.id}`, {
                    method: "DELETE",
                  });
                  if (!res.ok && res.status !== 404) {
                    throw new Error(String(res.status));
                  }
                  toast.success("Recording deleted.");
                } catch {
                  toast.error("Could not delete the recording.");
                } finally {
                  setPendingDelete(null);
                  void refresh();
                }
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
  notes,
  budget,
  remaining,
  loaded,
  onClose,
  onChanged,
  onRequestDelete,
}: {
  noteId: string;
  notes: VoiceNoteSummary[];
  budget: Budget;
  remaining: number;
  loaded: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
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

        {/* Budget */}
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

        <Recorder
          noteId={noteId}
          remaining={remaining}
          onUploaded={onChanged}
        />

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!loaded ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <Mic className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">No recordings yet</p>
              <p className="mt-1 max-w-[15rem] text-pretty text-xs text-muted-foreground">
                Record a voice note — the recording is the content, any length,
                any language.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notes.map((note, i) => (
                <li
                  key={note.id}
                  className="rounded-xl border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Recording {i + 1} · {fmt(note.durationSec)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(note)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={`Delete recording ${i + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <audio
                    controls
                    preload="metadata"
                    src={note.audioUrl}
                    className="mt-2 h-9 w-full"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

type RecState = "idle" | "recording" | "uploading";

function Recorder({
  noteId,
  remaining,
  onUploaded,
}: {
  noteId: string;
  remaining: number;
  onUploaded: () => Promise<void>;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest remaining budget, readable from inside the interval without it being
  // a dependency (which would restart the timer every refresh).
  const remainingRef = useRef(remaining);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  const upload = useCallback(
    async (blob: Blob, mimeType: string) => {
      setState("uploading");
      try {
        const file = new File([blob], "voice-note", { type: mimeType });
        const form = new FormData();
        form.append("audio", file);

        const res = await fetch(`/api/notes/${noteId}/voice`, {
          method: "POST",
          body: form,
        });

        if (res.status === 403) {
          toast.error("That would exceed your 5-minute voice budget.");
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          toast.success("Voice note saved.");
        }
      } catch {
        toast.error("Could not save the recording. Please try again.");
      } finally {
        setState("idle");
        setElapsed(0);
        await onUploaded();
      }
    },
    [noteId, onUploaded],
  );

  const start = useCallback(async () => {
    if (remainingRef.current <= 0) {
      toast.error("Your voice budget is full. Delete a recording to free space.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed to record.");
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(
      stream,
      // Low bitrate keeps a full-budget recording well under Vercel's request
      // size limit (the upload goes through our API route, not direct-to-Blob).
      mimeType
        ? { mimeType, audioBitsPerSecond: 64_000 }
        : { audioBitsPerSecond: 64_000 },
    );
    chunksRef.current = [];
    recorderRef.current = recorder;
    streamRef.current = stream;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopTracks();
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size > 0) void upload(blob, type);
      else setState("idle");
    };

    recorder.start();
    setState("recording");
    setElapsed(0);

    tickRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        // Can't record past the remaining budget — auto-stop at the ceiling.
        if (next >= remainingRef.current) {
          if (recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
          }
          toast.info("Reached your remaining voice budget — recording stopped.");
        }
        return next;
      });
    }, 1000);
  }, [stopTracks, upload]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

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
