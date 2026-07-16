"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Live-collaboration client. Connects to the standalone Socket.io relay
 * (`NEXT_PUBLIC_SOCKET_URL`), joins the note's room, and exposes emit + handler
 * hooks for content and cursors. When the URL is unset it's a no-op — the app
 * runs perfectly without live collab.
 *
 * `content-update` payloads are opaque here: each editor decides what to send
 * (canvas elements / document JSON) and how to apply it. This is broadcast +
 * last-write-wins, not a CRDT — the deliberate tradeoff documented in the README.
 */

// Must be a literal for Next to inline it into the client bundle.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

export type Peer = {
  id: string;
  name: string;
  color: string;
  photoURL: string | null;
};
export type RemoteCursor = { id: string; user: Peer; x: number; y: number };

type ContentHandler = (data: unknown) => void;
type CursorHandler = (cursor: RemoteCursor) => void;
type VoiceHandler = () => void;

export interface NoteCollab {
  enabled: boolean;
  connected: boolean;
  peers: Peer[];
  emitContent: (data: unknown) => void;
  emitCursor: (x: number, y: number) => void;
  /** Signal that this note's voice notes changed, so peers refetch the list. */
  emitVoiceChanged: () => void;
  setContentHandler: (fn: ContentHandler | null) => void;
  setCursorHandler: (fn: CursorHandler | null) => void;
  setVoiceChangedHandler: (fn: VoiceHandler | null) => void;
}

export function useNoteCollab(
  noteId: string,
  name: string,
  color: string,
  photoURL: string | null,
): NoteCollab {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const contentHandler = useRef<ContentHandler | null>(null);
  const cursorHandler = useRef<CursorHandler | null>(null);
  const voiceHandler = useRef<VoiceHandler | null>(null);

  useEffect(() => {
    if (!SOCKET_URL) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", {
        noteId,
        user: { name, color, photoURL },
      });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("peers", (list: Peer[]) => setPeers(list));
    socket.on("peer-joined", (peer: Peer) =>
      setPeers((prev) => [...prev.filter((p) => p.id !== peer.id), peer]),
    );
    socket.on("peer-left", (peer: Peer) =>
      setPeers((prev) => prev.filter((p) => p.id !== peer.id)),
    );
    socket.on("content-update", (data: unknown) =>
      contentHandler.current?.(data),
    );
    socket.on("cursor-move", (cursor: RemoteCursor) =>
      cursorHandler.current?.(cursor),
    );
    socket.on("voice-changed", () => voiceHandler.current?.());

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [noteId, name, color, photoURL]);

  const emitContent = useCallback((data: unknown) => {
    socketRef.current?.emit("content-update", data);
  }, []);
  const emitCursor = useCallback((x: number, y: number) => {
    socketRef.current?.emit("cursor-move", { x, y });
  }, []);
  const emitVoiceChanged = useCallback(() => {
    socketRef.current?.emit("voice-changed");
  }, []);
  const setContentHandler = useCallback((fn: ContentHandler | null) => {
    contentHandler.current = fn;
  }, []);
  const setCursorHandler = useCallback((fn: CursorHandler | null) => {
    cursorHandler.current = fn;
  }, []);
  const setVoiceChangedHandler = useCallback((fn: VoiceHandler | null) => {
    voiceHandler.current = fn;
  }, []);

  return {
    enabled: Boolean(SOCKET_URL),
    connected,
    peers,
    emitContent,
    emitCursor,
    emitVoiceChanged,
    setContentHandler,
    setCursorHandler,
    setVoiceChangedHandler,
  };
}

/** A stable, pleasant colour for a session's presence dot + cursor. */
export function randomPeerColor(): string {
  const colors = [
    "#6366f1", // indigo
    "#0ea5e9", // sky
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#ec4899", // pink
    "#8b5cf6", // violet
    "#14b8a6", // teal
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
