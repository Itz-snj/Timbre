"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, CircleAlert, Loader2 } from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { cn } from "@/lib/utils";

/**
 * excalidraw is a browser-only canvas (it touches `window`/`document` at import
 * time), so it must be loaded client-side with `ssr: false`. That's only legal
 * inside a Client Component — hence this whole file is one.
 */
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading canvas…
      </div>
    ),
  },
);

type ExcalidrawProps = React.ComponentProps<typeof Excalidraw>;
type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type ChangeElements = Parameters<OnChange>[0];
type ChangeAppState = Parameters<OnChange>[1];

type SaveState = "saved" | "unsaved" | "saving" | "error";

/** The debounce window after the last edit before we persist. */
const AUTOSAVE_DELAY_MS = 800;

/**
 * Only this slice of excalidraw's appState is worth persisting: enough to
 * restore where the user was looking, nothing transient (selection, dragging,
 * collaborators…). Keeping it small also keeps the note document lean in Mongo.
 */
const APP_STATE_KEYS = [
  "viewBackgroundColor",
  "scrollX",
  "scrollY",
  "zoom",
  "gridSize",
] as const;

function pickAppState(appState: ChangeAppState): Record<string, unknown> {
  const source = appState as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of APP_STATE_KEYS) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/**
 * A cheap fingerprint of the drawing. excalidraw bumps an element's `version` on
 * every mutation and adds/removes elements outright, so summing versions (folded
 * with a prime) changes iff the drawing actually changed — letting us ignore the
 * flood of onChange calls fired by pure selection or pointer movement.
 */
function sceneSignature(elements: ChangeElements): number {
  let sig = elements.length;
  for (const el of elements) {
    sig = (sig * 31 + ((el as { version?: number }).version ?? 0)) | 0;
  }
  return sig;
}

/**
 * excalidraw keeps soft-deleted elements in its live array (flagged
 * `isDeleted`) for in-session undo. Those are worthless once persisted and
 * would grow the note document without bound, so we store only live elements —
 * the same thing excalidraw's own `serializeAsJSON` does on export.
 */
function liveElements(elements: ChangeElements): unknown[] {
  return elements.filter(
    (el) => !(el as { isDeleted?: boolean }).isDeleted,
  );
}

export function CanvasEditor({
  noteId,
  title,
  initialElements,
  initialAppState,
}: {
  noteId: string;
  title: string;
  initialElements: unknown[];
  initialAppState: Record<string, unknown>;
}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Data from Mongo is opaque JSON; cast through `unknown` into excalidraw's
  // types at this one boundary rather than importing its (non-subpath-exported)
  // element/appState types. excalidraw re-validates via `restore()` on load.
  const savedSig = useRef(
    sceneSignature(initialElements as unknown as ChangeElements),
  );
  const latest = useRef<{ elements: ChangeElements; appState: ChangeAppState }>({
    elements: initialElements as unknown as ChangeElements,
    appState: initialAppState as unknown as ChangeAppState,
  });

  const save = useCallback(async () => {
    const sigAtSave = sceneSignature(latest.current.elements);
    setSaveState("saving");
    try {
      const res = await fetch(`/api/notes/${noteId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: liveElements(latest.current.elements),
          appState: pickAppState(latest.current.appState),
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);

      savedSig.current = sigAtSave;
      // Edits may have arrived while the request was in flight; if so, the
      // pending debounce will save them — don't falsely show "Saved".
      setSaveState(
        sceneSignature(latest.current.elements) === sigAtSave
          ? "saved"
          : "unsaved",
      );
    } catch {
      setSaveState("error");
    }
  }, [noteId]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, AUTOSAVE_DELAY_MS);
  }, [save]);

  const handleChange = useCallback<OnChange>(
    (elements, appState) => {
      latest.current = { elements, appState };
      if (sceneSignature(elements) === savedSig.current) return; // no real change
      setSaveState("unsaved");
      scheduleSave();
    },
    [scheduleSave],
  );

  // Leaving the editor with a pending debounce would drop the last <800ms of
  // edits. Flush best-effort on unmount with a keepalive request that survives
  // the navigation. (Also covers hard tab-close, wired below.)
  const flush = useCallback(() => {
    if (savedSig.current === sceneSignature(latest.current.elements)) return;
    void fetch(`/api/notes/${noteId}/canvas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        elements: liveElements(latest.current.elements),
        appState: pickAppState(latest.current.appState),
      }),
      keepalive: true,
    });
  }, [noteId]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [flush]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Back to notes"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="truncate font-heading text-sm font-medium tracking-tight">
            {title}
          </h1>
        </div>
        <SaveIndicator state={saveState} onRetry={() => void save()} />
      </header>

      <div className="relative flex-1">
        <Excalidraw
          initialData={
            {
              elements: initialElements,
              appState: initialAppState,
              scrollToContent: true,
            } as unknown as ExcalidrawProps["initialData"]
          }
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CircleAlert className="size-3.5" />
        Save failed — retry
      </button>
    );
  }

  const map = {
    saved: { icon: Check, label: "Saved", className: "text-muted-foreground" },
    saving: {
      icon: Loader2,
      label: "Saving…",
      className: "text-muted-foreground",
    },
    unsaved: {
      icon: Loader2,
      label: "Unsaved changes",
      className: "text-muted-foreground",
    },
  } as const;
  const { icon: Icon, label, className } = map[state];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 px-2 text-xs", className)}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} />
      {label}
    </span>
  );
}
