"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasEditor } from "@/components/notes/canvas-editor";
import { DocumentEditor } from "@/components/notes/document-editor";
import { VoicePanel } from "@/components/notes/voice-panel";
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
  initialElements,
  initialAppState,
  initialContent,
}: {
  noteId: string;
  noteType: NoteType;
  title: string;
  initialElements: unknown[];
  initialAppState: Record<string, unknown>;
  initialContent: Record<string, unknown> | null;
}) {
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
          onVoiceChanged={refresh}
          registerGetPinPosition={registerGetPinPosition}
        />
      ) : (
        <DocumentEditor
          noteId={noteId}
          title={title}
          initialContent={initialContent}
          onVoiceChanged={refresh}
          registerInsertVoiceBlock={registerInsertVoiceBlock}
        />
      )}

      <VoicePanel
        noteId={noteId}
        voiceNotes={voiceNotes}
        budget={budget}
        onChanged={refresh}
        getPosition={noteType === "canvas" ? getPosition : undefined}
        onInserted={noteType === "document" ? onInserted : undefined}
        onAddToDocument={noteType === "document" ? onInserted : undefined}
      />
    </div>
  );
}
