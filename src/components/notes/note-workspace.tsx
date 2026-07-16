"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasEditor } from "@/components/notes/canvas-editor";
import { DocumentEditor } from "@/components/notes/document-editor";
import { VoicePanel } from "@/components/notes/voice-panel";
import {
  useNoteCollab,
  randomPeerColor,
} from "@/components/notes/use-note-collab";
import { VOICE_BUDGET_SECONDS, type NoteType } from "@/lib/models";
import type { VoiceNoteSummary } from "@/lib/voice";
import type { Budget, RecPosition } from "@/components/notes/voice-shared";

/**
 * Client shell for a single note. It owns the one source of truth for this
 * note's voice notes + budget, so the editor (canvas pins / inline document
 * blocks) and the floating panel all render from the same list and never drift.
 *
 * The editor and panel are siblings, so they coordinate through two registered
 * callbacks held in refs: the canvas editor supplies *where* a new pin should
 * land, and the document editor supplies *how* to drop a new inline block.
 */
export function NoteWorkspace({
  noteId,
  noteType,
  title,
  userName,
  userPhotoURL,
  isOwner,
  canEdit,
  isShared,
  shareEnabled,
  shareRole,
  initialElements,
  initialAppState,
  initialContent,
}: {
  noteId: string;
  noteType: NoteType;
  title: string;
  userName: string;
  userPhotoURL: string | null;
  isOwner: boolean;
  canEdit: boolean;
  isShared: boolean;
  shareEnabled: boolean;
  shareRole: "editor" | "viewer";
  initialElements: unknown[];
  initialAppState: Record<string, unknown>;
  initialContent: Record<string, unknown> | null;
}) {
  // A stable identity for this browser session's presence (one colour per tab).
  const color = useMemo(() => randomPeerColor(), []);
  const collab = useNoteCollab(noteId, userName, color, userPhotoURL);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNoteSummary[]>([]);
  const [budget, setBudget] = useState<Budget>({
    usedSeconds: 0,
    limitSeconds: VOICE_BUDGET_SECONDS,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/voice`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        voiceNotes: VoiceNoteSummary[];
        budget: Budget;
      };
      setVoiceNotes(data.voiceNotes);
      setBudget(data.budget);
    } catch {
      // Non-fatal — the UI keeps whatever it last had.
    }
  }, [noteId]);

  useEffect(() => {
    // Initial load; setState happens only after the awaited fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Voice notes travel over the REST API, not the collab content channel — so
  // after a *local* voice change (record/move/delete) we refetch AND ping peers
  // to refetch too, keeping pins as live as drawing strokes.
  const { emitVoiceChanged, setVoiceChangedHandler, enabled: collabOn } = collab;
  const refreshAndBroadcast = useCallback(async () => {
    await refresh();
    emitVoiceChanged();
  }, [refresh, emitVoiceChanged]);

  useEffect(() => {
    if (!collabOn) return;
    setVoiceChangedHandler(() => void refresh());
    return () => setVoiceChangedHandler(null);
  }, [collabOn, setVoiceChangedHandler, refresh]);

  // Canvas editor registers a getter for the current viewport-center in scene
  // coords; the doc editor registers an inline-block inserter. Stable identities
  // so the child effects that call them don't re-run each render.
  const getPinPositionRef = useRef<(() => RecPosition | null) | null>(null);
  const insertBlockRef = useRef<((vn: VoiceNoteSummary) => void) | null>(null);

  const registerGetPinPosition = useCallback(
    (fn: (() => RecPosition | null) | null) => {
      getPinPositionRef.current = fn;
    },
    [],
  );
  const registerInsertVoiceBlock = useCallback(
    (fn: ((vn: VoiceNoteSummary) => void) | null) => {
      insertBlockRef.current = fn;
    },
    [],
  );

  const getPosition = useCallback(
    () => getPinPositionRef.current?.() ?? null,
    [],
  );
  const onInserted = useCallback((vn: VoiceNoteSummary) => {
    insertBlockRef.current?.(vn);
  }, []);

  return (
    <div className="h-[calc(100dvh-4rem)]">
      {noteType === "canvas" ? (
        <CanvasEditor
          noteId={noteId}
          title={title}
          initialElements={initialElements}
          initialAppState={initialAppState}
          voiceNotes={voiceNotes}
          onVoiceChanged={refreshAndBroadcast}
          registerGetPinPosition={registerGetPinPosition}
          collab={collab}
          isOwner={isOwner}
          canEdit={canEdit}
          shareEnabled={shareEnabled}
          shareRole={shareRole}
        />
      ) : (
        <DocumentEditor
          noteId={noteId}
          title={title}
          initialContent={initialContent}
          voiceNotes={voiceNotes}
          onVoiceChanged={refreshAndBroadcast}
          registerInsertVoiceBlock={registerInsertVoiceBlock}
          collab={collab}
          isOwner={isOwner}
          canEdit={canEdit}
          isShared={isShared}
          shareEnabled={shareEnabled}
          shareRole={shareRole}
        />
      )}

      <VoicePanel
        noteId={noteId}
        voiceNotes={voiceNotes}
        budget={budget}
        canEdit={canEdit}
        onChanged={refreshAndBroadcast}
        getPosition={noteType === "canvas" && canEdit ? getPosition : undefined}
        onInserted={noteType === "document" ? onInserted : undefined}
        onAddToDocument={
          noteType === "document" && canEdit ? onInserted : undefined
        }
      />
    </div>
  );
}
