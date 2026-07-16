"use client";

import {
  Node,
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { GripVertical, Mic, Trash2 } from "lucide-react";
import { deleteVoiceNote } from "@/components/notes/voice-shared";

export interface VoiceBlockOptions {
  /** Called after a block deletes its recording, so the workspace can refresh. */
  onDeleted: () => void;
  /** Viewers get a read-only block: no drag handle, no delete. */
  canEdit: boolean;
}

/**
 * A custom Tiptap block that embeds a voice note inline in a document (spec §5:
 * document voice notes are referenced as blocks, not pinned). It's an `atom` —
 * it holds no editable content, just a reference to a voice note by id, so the
 * audio itself lives in Blob and only the id rides along in the document JSON.
 * That means export/import and autosave carry it for free.
 */
export const VoiceBlock = Node.create<VoiceBlockOptions>({
  name: "voiceNote",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { onDeleted: () => {}, canEdit: true };
  },

  addAttributes() {
    return {
      voiceNoteId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-voice-note-id"),
        renderHTML: (attrs) =>
          attrs.voiceNoteId
            ? { "data-voice-note-id": attrs.voiceNoteId }
            : {},
      },
      // The recording's name, captured at insert time so the block reads
      // meaningfully. It can drift if the recording is renamed afterwards — the
      // sidebar remains the source of truth.
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-voice-note-title"),
        renderHTML: (attrs) =>
          attrs.title ? { "data-voice-note-title": attrs.title } : {},
      },
      uploaderName: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-voice-note-uploader"),
        renderHTML: (attrs) =>
          attrs.uploaderName
            ? { "data-voice-note-uploader": attrs.uploaderName }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-voice-note-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-voice-note": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceBlockView);
  },
});

function VoiceBlockView({ node, deleteNode, extension }: NodeViewProps) {
  const id = node.attrs.voiceNoteId as string | null;
  const title = (node.attrs.title as string | null)?.trim() || "Voice note";
  const uploaderName = (node.attrs.uploaderName as string | null)?.trim() || "";
  const canEdit = extension.options.canEdit;

  return (
    <NodeViewWrapper className="my-3">
      <div
        contentEditable={false}
        className="flex items-center gap-2 rounded-xl border bg-card p-3"
      >
        {/* Drag handle — `data-drag-handle` + the node's `draggable: true` let
            Tiptap move the whole block to a new line, Notion-style. Editors only. */}
        {canEdit ? (
          <span
            data-drag-handle
            draggable
            aria-label="Drag to reorder"
            className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </span>
        ) : null}

        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <Mic className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">
            {title}
            {uploaderName ? (
              <span className="font-normal text-muted-foreground">
                {" · "}
                {uploaderName}
              </span>
            ) : null}
          </p>
          {id ? (
            <audio
              controls
              preload="metadata"
              src={`/api/voice/${id}/audio`}
              className="mt-1 h-9 w-full"
            />
          ) : (
            <p className="mt-1 text-xs text-destructive">Missing recording.</p>
          )}
        </div>
        {canEdit ? (
          <button
            type="button"
            aria-label="Delete voice note"
            onClick={async () => {
              if (id) await deleteVoiceNote(id);
              deleteNode();
              extension.options.onDeleted();
            }}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
