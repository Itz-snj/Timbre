"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Eye,
  Loader2,
  Mic,
  Trash2,
  X,
} from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { cn } from "@/lib/utils";
import { voiceDisplayName, type VoiceNoteSummary } from "@/lib/voice";
import {
  deleteVoiceNote,
  fmt,
  type RecPosition,
} from "@/components/notes/voice-shared";
import type {
  NoteCollab,
  RemoteCursor,
} from "@/components/notes/use-note-collab";
import { PresenceStack } from "@/components/notes/presence-stack";
import { ShareButton } from "@/components/notes/share-button";

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
type ExcalidrawAPI = Parameters<NonNullable<ExcalidrawProps["excalidrawAPI"]>>[0];

type SaveState = "saved" | "unsaved" | "saving" | "error";

/** How often (ms) to broadcast the scene / cursor while actively editing. */
const COLLAB_CONTENT_MS = 200;
const COLLAB_CURSOR_MS = 60;

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

/**
 * The view transform needed to place pins over the canvas. excalidraw's own
 * `sceneCoordsToViewportCoords` reduces to `(scene + scroll) * zoom` when the
 * overlay shares the canvas's origin (it does — it's `inset-0` in the same
 * container), so its `offsetLeft/Top` cancel and we don't need to import the
 * util (which would pull excalidraw into SSR).
 */
type ViewTransform = { scrollX: number; scrollY: number; zoom: number };

function readView(appState: unknown): ViewTransform {
  const a = appState as
    | { scrollX?: number; scrollY?: number; zoom?: number | { value?: number } }
    | undefined;
  const zoom =
    typeof a?.zoom === "number" ? a.zoom : (a?.zoom?.value ?? 1);
  return {
    scrollX: typeof a?.scrollX === "number" ? a.scrollX : 0,
    scrollY: typeof a?.scrollY === "number" ? a.scrollY : 0,
    zoom: zoom || 1,
  };
}

export function CanvasEditor({
  noteId,
  title,
  initialElements,
  initialAppState,
  voiceNotes,
  onVoiceChanged,
  registerGetPinPosition,
  collab,
  isOwner,
  canEdit,
  shareEnabled,
  shareRole,
}: {
  noteId: string;
  title: string;
  initialElements: unknown[];
  initialAppState: Record<string, unknown>;
  voiceNotes: VoiceNoteSummary[];
  onVoiceChanged: () => Promise<void>;
  registerGetPinPosition: (fn: (() => RecPosition | null) | null) => void;
  collab: NoteCollab;
  isOwner: boolean;
  canEdit: boolean;
  shareEnabled: boolean;
  shareRole: "editor" | "viewer";
}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  // Pins re-position on every pan/zoom, so the view transform is React state.
  const [view, setView] = useState<ViewTransform>(() => readView(initialAppState));
  // The canvas area, used to measure viewport centre when dropping a new pin.
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Live collaboration: excalidraw's imperative API applies remote scenes;
  // remote cursors render in an overlay. Only elements are synced (each user
  // keeps their own viewport). Broadcast is last-write-wins — see README.
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorEmit = useRef(0);
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({});

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

  // Throttle scene broadcasts so a burst of edits sends at most one every
  // COLLAB_CONTENT_MS, always the latest.
  const scheduleEmit = useCallback(() => {
    if (!collab.enabled || emitTimer.current) return;
    emitTimer.current = setTimeout(() => {
      emitTimer.current = null;
      collab.emitContent({
        elements: liveElements(latest.current.elements),
      });
    }, COLLAB_CONTENT_MS);
  }, [collab]);

  const handleChange = useCallback<OnChange>(
    (elements, appState) => {
      latest.current = { elements, appState };

      // Keep pins glued to the scene as the user pans/zooms. Only re-render when
      // the transform actually moved — not on every element edit.
      const next = readView(appState);
      setView((prev) =>
        prev.scrollX === next.scrollX &&
        prev.scrollY === next.scrollY &&
        prev.zoom === next.zoom
          ? prev
          : next,
      );

      // A remote scene we just applied lands here too, but its signature already
      // equals savedSig (set below in the handler), so it's a no-op — no echo,
      // no redundant save.
      if (sceneSignature(elements) === savedSig.current) return; // no real change
      setSaveState("unsaved");
      scheduleSave();
      scheduleEmit();
    },
    [scheduleSave, scheduleEmit],
  );

  // Tell the workspace where a new pin should land: the centre of what's
  // currently on screen, converted back into scene coords. Reads the freshest
  // appState (kept in `latest`) so it's correct even mid-pan.
  useEffect(() => {
    registerGetPinPosition(() => {
      const el = canvasAreaRef.current;
      if (!el) return null;
      const { scrollX, scrollY, zoom } = readView(latest.current.appState);
      return {
        x: el.clientWidth / 2 / zoom - scrollX,
        y: el.clientHeight / 2 / zoom - scrollY,
      };
    });
    return () => registerGetPinPosition(null);
  }, [registerGetPinPosition]);

  // Apply remote scenes + track remote cursors.
  useEffect(() => {
    if (!collab.enabled) return;
    collab.setContentHandler((data) => {
      const els = (data as { elements?: unknown[] }).elements;
      const api = apiRef.current;
      if (!api || !Array.isArray(els)) return;
      // Pre-set savedSig to the incoming scene so the onChange this triggers is
      // recognised as "no change" — no echo back out, no redundant save.
      savedSig.current = sceneSignature(els as unknown as ChangeElements);
      (api.updateScene as (scene: { elements: unknown[] }) => void)({
        elements: els,
      });
    });
    collab.setCursorHandler((cursor) => {
      setCursors((prev) => ({ ...prev, [cursor.id]: cursor }));
    });
    return () => {
      collab.setContentHandler(null);
      collab.setCursorHandler(null);
    };
  }, [collab]);

  // Broadcast this user's pointer in scene coords (throttled), so it maps onto
  // everyone else's canvas regardless of their own pan/zoom.
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!collab.enabled) return;
      const now = Date.now();
      if (now - lastCursorEmit.current < COLLAB_CURSOR_MS) return;
      lastCursorEmit.current = now;
      const el = canvasAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { scrollX, scrollY, zoom } = readView(latest.current.appState);
      collab.emitCursor(
        (e.clientX - rect.left) / zoom - scrollX,
        (e.clientY - rect.top) / zoom - scrollY,
      );
    },
    [collab],
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
      if (emitTimer.current) clearTimeout(emitTimer.current);
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
        <div className="flex items-center gap-3">
          <PresenceStack peers={collab.peers} />
          {isOwner ? (
            <ShareButton
              noteId={noteId}
              initialShareEnabled={shareEnabled}
              initialShareRole={shareRole}
            />
          ) : null}
          {canEdit ? (
            <SaveIndicator state={saveState} onRetry={() => void save()} />
          ) : (
            <ViewOnlyBadge />
          )}
        </div>
      </header>

      <div
        ref={canvasAreaRef}
        className="relative flex-1"
        onPointerMove={handlePointerMove}
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          viewModeEnabled={!canEdit}
          initialData={
            {
              elements: initialElements,
              appState: initialAppState,
              scrollToContent: true,
            } as unknown as ExcalidrawProps["initialData"]
          }
          onChange={handleChange}
        />

        <PinsOverlay
          voiceNotes={voiceNotes}
          view={view}
          canEdit={canEdit}
          onChanged={onVoiceChanged}
        />

        <CursorsOverlay cursors={cursors} peers={collab.peers} view={view} />
      </div>
    </div>
  );
}

/** Remote collaborators' live pointers, mapped from scene coords to the canvas. */
function CursorsOverlay({
  cursors,
  peers,
  view,
}: {
  cursors: Record<string, RemoteCursor>;
  peers: { id: string }[];
  view: ViewTransform;
}) {
  const active = new Set(peers.map((p) => p.id));
  const visible = Object.values(cursors).filter((c) => active.has(c.id));
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {visible.map((cursor) => {
        const left = (cursor.x + view.scrollX) * view.zoom;
        const top = (cursor.y + view.scrollY) * view.zoom;
        return (
          <div
            key={cursor.id}
            className="absolute flex items-start gap-1"
            style={{ left, top }}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4 shrink-0 drop-shadow"
              style={{ color: cursor.user.color }}
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M1 1l5.5 14 2.2-5.8L14.5 7z"
              />
            </svg>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: cursor.user.color }}
            >
              {cursor.user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Voice-note pins floating over the canvas. The layer itself ignores pointer
 * events so it never blocks drawing; only the pins (and an open popover) take
 * clicks. Pins are draggable — a drag commits a new scene position, a tap opens
 * the player.
 */
function PinsOverlay({
  voiceNotes,
  view,
  canEdit,
  onChanged,
}: {
  voiceNotes: VoiceNoteSummary[];
  view: ViewTransform;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const pinned = voiceNotes.filter((v) => v.position);

  const moveVoiceNote = useCallback(
    async (id: string, position: RecPosition): Promise<boolean> => {
      let ok = true;
      try {
        const res = await fetch(`/api/voice/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      await onChanged();
      return ok;
    },
    [onChanged],
  );

  if (pinned.length === 0) return null;

  return (
    // z-30 is deliberate: excalidraw's canvases set an explicit z-index (1–2),
    // which beats z-index:auto no matter the DOM order — so the layer must sit
    // above them to be visible, while staying below the voice drawer (z-50).
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* Click-away catcher while a popover is open. */}
      {openId ? (
        <button
          type="button"
          aria-label="Close voice note"
          className="pointer-events-auto absolute inset-0 cursor-default"
          onClick={() => setOpenId(null)}
        />
      ) : null}

      {pinned.map((vn, i) => {
        const left = (vn.position!.x + view.scrollX) * view.zoom;
        const top = (vn.position!.y + view.scrollY) * view.zoom;
        return (
          <VoicePin
            key={vn.id}
            index={i}
            voiceNote={vn}
            left={left}
            top={top}
            view={view}
            canEdit={canEdit}
            open={openId === vn.id}
            onToggle={() => setOpenId((cur) => (cur === vn.id ? null : vn.id))}
            onMoved={moveVoiceNote}
            onChanged={onChanged}
          />
        );
      })}
    </div>
  );
}

function VoicePin({
  index,
  voiceNote,
  left,
  top,
  view,
  canEdit,
  open,
  onToggle,
  onMoved,
  onChanged,
}: {
  index: number;
  voiceNote: VoiceNoteSummary;
  left: number;
  top: number;
  view: ViewTransform;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  onMoved: (id: string, position: RecPosition) => Promise<boolean>;
  onChanged: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const name = voiceDisplayName(voiceNote.title, `Voice note ${index + 1}`);
  // Live drag delta, applied on top of the committed (left, top). When not
  // dragging it's zero, so the pin simply follows left/top as the canvas pans.
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setOffset({ dx, dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;

    if (!d.moved || !canEdit) {
      // A tap (or a viewer who can't move it) — just open/close the player.
      setOffset({ dx: 0, dy: 0 });
      if (!d.moved) onToggle();
      return;
    }

    // A drag — convert the drop point back to scene coords and persist. Keep the
    // visual offset until the refresh confirms it (or roll it back on failure).
    const newLeft = left + (e.clientX - d.startX);
    const newTop = top + (e.clientY - d.startY);
    const position: RecPosition = {
      x: newLeft / view.zoom - view.scrollX,
      y: newTop / view.zoom - view.scrollY,
    };
    // Hold the visual offset until the move settles, then clear it: on success
    // left/top have advanced to the drop point; on failure they're unchanged and
    // the pin snaps back. Either way the offset returns to zero.
    void onMoved(voiceNote.id, position).finally(() =>
      setOffset({ dx: 0, dy: 0 }),
    );
  };

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: left + offset.dx,
        top: top + offset.dy,
        transform: "translate(-50%, -50%)",
      }}
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          // Drag is pointer-only; keep the pin operable from the keyboard.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-label={`${name}, ${fmt(voiceNote.durationSec)}.${canEdit ? " Drag to move, click to play." : " Click to play."}`}
        aria-expanded={open}
        className={cn(
          "flex size-9 touch-none items-center justify-center rounded-full border-2 border-background bg-brand text-brand-foreground shadow-md transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          open && "scale-110 ring-2 ring-ring",
        )}
      >
        <Mic className="size-4" />
      </button>

      {/* Always-visible name tag so a crowd of pins stays identifiable without
          opening each one. Ignores pointer events (drag/tap belong to the pin)
          and steps aside when the popover — which shows the name itself — opens. */}
      {!open ? (
        <span
          className="pointer-events-none absolute left-1/2 top-[calc(100%+5px)] block max-w-[8.5rem] -translate-x-1/2 truncate rounded-md bg-background/85 px-1.5 py-0.5 text-center text-[10px] font-medium text-foreground/80 shadow-sm ring-1 ring-border backdrop-blur-sm"
          aria-hidden="true"
        >
          {name}
        </span>
      ) : null}

      {open ? (
        <div
          className="absolute left-1/2 top-[calc(100%+8px)] z-10 w-64 -translate-x-1/2 rounded-xl border bg-popover p-3 shadow-xl"
          role="dialog"
          aria-label={name}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {name}
              <span className="text-muted-foreground">
                {" · "}
                {fmt(voiceNote.durationSec)}
              </span>
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {voiceNote.uploaderName ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Recorded by {voiceNote.uploaderName}
            </p>
          ) : null}
          <audio
            controls
            preload="metadata"
            src={voiceNote.audioUrl}
            className="mt-2 h-9 w-full"
          />
          {canEdit ? (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                await deleteVoiceNote(voiceNote.id);
                await onChanged();
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ViewOnlyBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Eye className="size-3.5" />
      View only
    </span>
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
