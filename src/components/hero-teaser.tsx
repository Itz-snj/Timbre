/**
 * The "show, don't tell" hero (ai_rules.md §7): a miniature of the real product —
 * a sketch being drawn, a voice note recording onto it, and a collaborator's
 * cursor moving live.
 *
 * Deliberately a server component built from CSS + inline SVG only: no images to
 * load, no JS shipped, nothing to go stale when the real editor changes. The
 * global prefers-reduced-motion rule in globals.css settles every animation on
 * its final frame, so the still version reads as a finished sketch.
 */
export function HeroTeaser() {
  return (
    <div
      aria-hidden="true"
      className="relative select-none overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/5"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-destructive/40" />
        <span className="size-2.5 rounded-full bg-document/50" />
        <span className="size-2.5 rounded-full bg-canvas/50" />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">
          hydrology-lecture.vnote
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-canvas-muted px-2 py-0.5 text-[10px] font-medium text-canvas">
          <span className="size-1.5 rounded-full bg-canvas" />
          canvas
        </span>
      </div>

      {/* The canvas itself */}
      <div className="relative aspect-[16/10] bg-background">
        {/* Dot grid, exactly like a real infinite canvas */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--muted-foreground) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <svg
          viewBox="0 0 640 400"
          className="absolute inset-0 size-full"
          fill="none"
        >
          <style>{`
            .ink {
              stroke-linecap: round;
              stroke-linejoin: round;
              stroke-dasharray: var(--len);
              stroke-dashoffset: var(--len);
              animation: draw 1.1s ease-out forwards;
            }
            @keyframes draw { to { stroke-dashoffset: 0; } }

            @keyframes float-cursor {
              0%   { transform: translate(300px, 250px); }
              30%  { transform: translate(430px, 130px); }
              55%  { transform: translate(360px, 190px); }
              80%  { transform: translate(480px, 240px); }
              100% { transform: translate(300px, 250px); }
            }
            .cursor { animation: float-cursor 9s ease-in-out infinite; }

            @keyframes fade-up {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .pop { opacity: 0; animation: fade-up .5s ease-out forwards; }
          `}</style>

          {/* A hand-drawn water cycle: cloud, arrows, ground line */}
          <g stroke="var(--foreground)" strokeWidth="2.5" opacity="0.85">
            <path
              className="ink"
              style={{ ["--len" as string]: "420", animationDelay: "0.2s" }}
              d="M112 118c-14 0-25-10-25-23s11-23 25-23c3-13 15-22 29-22 16 0 29 11 31 26 12 1 22 11 22 23 0 13-11 23-25 23Z"
            />
            <path
              className="ink"
              style={{ ["--len" as string]: "60", animationDelay: "0.9s" }}
              d="M120 150v34"
            />
            <path
              className="ink"
              style={{ ["--len" as string]: "30", animationDelay: "1.1s" }}
              d="M112 174l8 12 8-12"
            />
            <path
              className="ink"
              style={{ ["--len" as string]: "60", animationDelay: "1s" }}
              d="M162 150v34"
            />
            <path
              className="ink"
              style={{ ["--len" as string]: "30", animationDelay: "1.2s" }}
              d="M154 174l8 12 8-12"
            />
            <path
              className="ink"
              style={{ ["--len" as string]: "300", animationDelay: "1.3s" }}
              d="M64 232c46-10 92-10 138 0s92 10 138 0"
            />
          </g>

          {/* Evaporation arrow, in the brand colour */}
          <path
            className="ink"
            style={{ ["--len" as string]: "220", animationDelay: "1.6s" }}
            d="M300 220C300 170 250 160 214 140"
            stroke="var(--brand)"
            strokeWidth="2.5"
            strokeDasharray="220"
          />
          <path
            className="ink"
            style={{ ["--len" as string]: "40", animationDelay: "2.1s" }}
            d="M214 140l22 4m-22-4l6-21"
            stroke="var(--brand)"
            strokeWidth="2.5"
          />

          {/* A collaborator's live cursor */}
          <g className="cursor">
            <path
              d="M0 0l0 16 4-4 3 7 3-1-3-7 5 0z"
              fill="var(--document)"
              stroke="var(--background)"
              strokeWidth="1"
            />
            <rect
              x="10"
              y="12"
              width="52"
              height="18"
              rx="9"
              fill="var(--document)"
            />
            <text
              x="36"
              y="24.5"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="var(--background)"
              fontFamily="var(--font-inter), sans-serif"
            >
              Priya
            </text>
          </g>
        </svg>

        {/* Voice-note pin, mid-recording — pinned to an (x,y) on the canvas */}
        <div
          className="pop absolute"
          style={{ left: "58%", top: "26%", animationDelay: "2.4s" }}
        >
          <div className="flex items-center gap-2.5 rounded-full border bg-card/95 py-1.5 pl-1.5 pr-3.5 shadow-lg backdrop-blur">
            <span className="relative flex size-7 items-center justify-center rounded-full bg-record">
              <span className="absolute inset-0 animate-record-pulse rounded-full bg-record/40" />
              <span className="size-2 rounded-full bg-record-foreground" />
            </span>

            {/* Live waveform */}
            <span className="flex h-5 items-end gap-[3px]">
              {[9, 16, 6, 20, 12, 18, 8, 14, 5].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-record/70"
                  style={{
                    height: `${h}px`,
                    animation: `record-pulse ${0.8 + (i % 4) * 0.22}s ease-in-out ${i * 0.09}s infinite`,
                  }}
                />
              ))}
            </span>

            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              2:14
            </span>
          </div>
        </div>

        {/* A second, already-saved voice note */}
        <div
          className="pop absolute"
          style={{ left: "13%", top: "70%", animationDelay: "2.8s" }}
        >
          <div className="flex items-center gap-2 rounded-full border bg-card/95 px-2.5 py-1.5 shadow-md backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-brand">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              4:02
            </span>
            <span className="text-[11px] text-muted-foreground">हिन्दी</span>
          </div>
        </div>
      </div>
    </div>
  );
}
