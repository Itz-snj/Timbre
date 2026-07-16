"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Bold,
  Check,
  CircleAlert,
  Code,
  Eye,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceNoteSummary } from "@/lib/voice";
import { VoiceBlock } from "@/components/notes/voice-block-extension";
import type { NoteCollab } from "@/components/notes/use-note-collab";
import { PresenceStack } from "@/components/notes/presence-stack";
import { ShareButton } from "@/components/notes/share-button";

type SaveState = "saved" | "unsaved" | "saving" | "error";

/** The debounce window after the last edit before we persist. */
const AUTOSAVE_DELAY_MS = 800;
/** Slower than autosave: each remote apply resets the cursor (LWW tradeoff),
 *  so we broadcast document changes less often to keep that jank rare. */
const COLLAB_DELAY_MS = 400;

export function DocumentEditor({
  noteId,
  title,
  initialContent,
  voiceNotes,
  onVoiceChanged,
  registerInsertVoiceBlock,
  collab,
  isOwner,
  canEdit,
  isShared,
  shareEnabled,
  shareRole,
}: {
  noteId: string;
  title: string;
  initialContent: Record<string, unknown> | null;
  voiceNotes: VoiceNoteSummary[];
  onVoiceChanged: () => Promise<void>;
  registerInsertVoiceBlock: (
    fn: ((vn: VoiceNoteSummary) => void) | null,
  ) => void;
  collab: NoteCollab;
  isOwner: boolean;
  canEdit: boolean;
  isShared: boolean;
  shareEnabled: boolean;
  shareRole: "editor" | "viewer";
}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  // True while applying a remote change, so the resulting onUpdate doesn't echo
  // it back out or re-save it.
  const applyingRemote = useRef(false);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `onVoiceChanged` is the workspace's `refresh` (a stable useCallback), so the
  // editor — created once — safely captures this; no ref indirection needed.
  const onVoiceDeleted = useCallback(() => {
    void onVoiceChanged();
  }, [onVoiceChanged]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `dirty` tracks whether there are edits not yet persisted; `latest` holds the
  // most recent doc JSON so a save/flush always sends the newest state.
  const dirty = useRef(false);
  const latest = useRef<Record<string, unknown> | null>(initialContent);

  const buildBody = () => JSON.stringify({ content: latest.current });

  const save = useCallback(async () => {
    if (!dirty.current) return;
    // Clear the flag *before* the request: an edit landing mid-flight sets it
    // true again and re-schedules, so we never drop the trailing change.
    dirty.current = false;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/notes/${noteId}/document`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: buildBody(),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveState(dirty.current ? "unsaved" : "saved");
    } catch {
      dirty.current = true; // let a retry / flush pick it back up
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

  // Throttle document broadcasts; always send the latest doc JSON.
  const scheduleEmit = useCallback(() => {
    if (!collab.enabled || emitTimer.current) return;
    emitTimer.current = setTimeout(() => {
      emitTimer.current = null;
      collab.emitContent({ content: latest.current });
    }, COLLAB_DELAY_MS);
  }, [collab]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      VoiceBlock.configure({ onDeleted: onVoiceDeleted, canEdit }),
    ],
    // Tiptap must not render during SSR or it hydration-mismatches — this whole
    // component is client-side, but Next still server-renders client components.
    immediatelyRender: false,
    editable: canEdit,
    content: (initialContent as unknown as JSONContent | null) ?? "",
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[calc(100dvh-4rem-3rem)] px-6 py-8 focus:outline-none prose-headings:font-heading prose-headings:tracking-tight",
      },
    },
    onUpdate: ({ editor }) => {
      latest.current = editor.getJSON();
      if (applyingRemote.current) return; // remote-applied → don't echo or re-save
      dirty.current = true;
      setSaveState("unsaved");
      scheduleSave();
      scheduleEmit();
    },
  });

  // Apply remote document changes. setContent resets the selection, so we
  // capture and restore the cursor to soften the jump (last-write-wins; a CRDT
  // like Yjs is the production answer — see README).
  useEffect(() => {
    if (!editor || !collab.enabled) return;
    collab.setContentHandler((data) => {
      const content = (data as { content?: unknown }).content;
      if (!content) return;
      const { from, to } = editor.state.selection;
      applyingRemote.current = true;
      editor.commands.setContent(content as JSONContent);
      const size = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(from, size),
        to: Math.min(to, size),
      });
      applyingRemote.current = false;
    });
    return () => collab.setContentHandler(null);
  }, [editor, collab]);

  // Leaving with a pending debounce would drop the last <800ms of edits. Flush
  // best-effort on unmount + tab-hide with a keepalive request.
  const flush = useCallback(() => {
    if (!dirty.current) return;
    void fetch(`/api/notes/${noteId}/document`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: buildBody(),
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

  // Expose "insert a voice block at the cursor" to the workspace, so a recording
  // made in the panel drops inline where the user was typing.
  useEffect(() => {
    if (!editor) return;
    registerInsertVoiceBlock((vn) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "voiceNote",
          attrs: { voiceNoteId: vn.id, title: vn.title },
        })
        // Jump to the freshly inserted block — otherwise, with the cursor at the
        // end of a long doc, it lands below the fold and looks like nothing happened.
        .scrollIntoView()
        .run();
    });
    return () => registerInsertVoiceBlock(null);
  }, [editor, registerInsertVoiceBlock]);

  // A voice block only stores the recording's id, so its label and "recorded by"
  // are synced from the live list here — that's why a rename in the sidebar now
  // shows up in the block. Flagged as a remote-style change so it doesn't echo
  // over collab or trigger a save.
  useEffect(() => {
    if (!editor) return;
    const byId = new Map(voiceNotes.map((v) => [v.id, v]));
    let tr = editor.state.tr;
    let changed = false;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "voiceNote") return;
      const vn = byId.get(node.attrs.voiceNoteId as string);
      const nextTitle = vn?.title ?? null;
      const nextUploader = isShared ? (vn?.uploaderName ?? null) : null;
      if (
        node.attrs.title !== nextTitle ||
        node.attrs.uploaderName !== nextUploader
      ) {
        tr = tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          title: nextTitle,
          uploaderName: nextUploader,
        });
        changed = true;
      }
    });
    if (changed) {
      applyingRemote.current = true;
      editor.view.dispatch(tr);
      applyingRemote.current = false;
    }
  }, [editor, voiceNotes, isShared]);

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

      {editor && canEdit ? <Toolbar editor={editor} /> : null}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

/**
 * Formatting bar. In Tiptap v3 `useEditor` no longer re-renders the component on
 * every transaction, so active states are read through `useEditorState`, which
 * subscribes to just these flags and re-renders only when they change.
 */
function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b bg-background/80 px-3 py-1.5 backdrop-blur"
    >
      <ToolbarButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 1"
        active={state.h1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4",
        active && "bg-brand-muted text-brand hover:bg-brand-muted hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
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
    saved: { icon: Check, label: "Saved" },
    saving: { icon: Loader2, label: "Saving…" },
    unsaved: { icon: Loader2, label: "Unsaved changes" },
  } as const;
  const { icon: Icon, label } = map[state];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} />
      {label}
    </span>
  );
}
