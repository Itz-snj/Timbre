"use client";

import type { Peer } from "@/components/notes/use-note-collab";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Overlapping avatars for the other people currently in this note. */
export function PresenceStack({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;

  const shown = peers.slice(0, 4);
  const extra = peers.length - shown.length;

  return (
    <div
      className="flex items-center -space-x-2"
      aria-label={`${peers.length} other${peers.length === 1 ? "" : "s"} editing this note`}
    >
      {shown.map((peer) =>
        peer.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Google avatar; next/image adds config overhead for a 28px presence dot
          <img
            key={peer.id}
            src={peer.photoURL}
            alt={peer.name}
            title={peer.name}
            referrerPolicy="no-referrer"
            className="size-7 rounded-full border-2 border-background object-cover"
            style={{ boxShadow: `0 0 0 2px ${peer.color}` }}
          />
        ) : (
          <span
            key={peer.id}
            title={peer.name}
            className="flex size-7 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white"
            style={{ backgroundColor: peer.color }}
          >
            {initials(peer.name)}
          </span>
        ),
      )}
      {extra > 0 ? (
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
