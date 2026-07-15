"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { VoiceNoteSummary } from "@/lib/voice";

/**
 * Shared voice-recording primitives, used by the floating panel (Phase 4a) and,
 * in Phase 4b, by the canvas-pin and document-inline flows — all through the
 * one `useVoiceRecorder` hook so capture/upload logic lives in a single place.
 */

export type Budget = { usedSeconds: number; limitSeconds: number };
export type RecPosition = { x: number; y: number };

/** mm:ss — voice durations always read as time, never a raw second count. */
export function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Pick the best audio container the browser can actually record. */
export function pickMimeType(): string {
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

export type RecState = "idle" | "recording" | "uploading";

/**
 * The whole record→stop→upload lifecycle for one note.
 *
 * - `getPosition` (canvas notes) is read at upload time so the recording lands
 *   as a pin where the user was looking; document notes leave it undefined.
 * - `onUploaded` receives the created voice note (or null on failure) so the
 *   caller can refresh its list and, for documents, insert an inline block.
 */
export function useVoiceRecorder({
  noteId,
  remaining,
  getPosition,
  onUploaded,
}: {
  noteId: string;
  remaining: number;
  getPosition?: () => RecPosition | null;
  onUploaded: (voiceNote: VoiceNoteSummary | null) => void | Promise<void>;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest values readable from inside the interval/closures without making them
  // deps (which would restart the timer or rebuild callbacks mid-recording).
  const remainingRef = useRef(remaining);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);
  const getPositionRef = useRef(getPosition);
  useEffect(() => {
    getPositionRef.current = getPosition;
  }, [getPosition]);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => stopTracks, [stopTracks]);

  const upload = useCallback(async (blob: Blob, mimeType: string) => {
    setState("uploading");
    let created: VoiceNoteSummary | null = null;
    try {
      const file = new File([blob], "voice-note", { type: mimeType });
      const form = new FormData();
      form.append("audio", file);
      const position = getPositionRef.current?.();
      if (position) form.append("position", JSON.stringify(position));

      const res = await fetch(`/api/notes/${noteId}/voice`, {
        method: "POST",
        body: form,
      });

      if (res.status === 403) {
        toast.error("That would exceed your 5-minute voice budget.");
      } else if (!res.ok) {
        throw new Error(String(res.status));
      } else {
        const data = (await res.json()) as { voiceNote: VoiceNoteSummary };
        created = data.voiceNote;
        toast.success("Voice note saved.");
      }
    } catch {
      toast.error("Could not save the recording. Please try again.");
    } finally {
      setState("idle");
      setElapsed(0);
      await onUploadedRef.current(created);
    }
  }, [noteId]);

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
      // Low bitrate keeps a full-budget recording under Vercel's request-size
      // limit (the upload goes through our API route, not direct-to-Blob).
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

  return { state, elapsed, start, stop };
}

/** Shared DELETE call — used by the panel list, canvas pins, and inline blocks. */
export async function deleteVoiceNote(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/voice/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(String(res.status));
    return true;
  } catch {
    toast.error("Could not delete the recording.");
    return false;
  }
}

/** Rename a recording (or clear its name with `null`). */
export async function renameVoiceNote(
  id: string,
  title: string | null,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/voice/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return true;
  } catch {
    toast.error("Could not rename the recording.");
    return false;
  }
}
