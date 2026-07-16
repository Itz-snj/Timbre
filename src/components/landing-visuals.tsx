/**
 * On-theme mock visuals for the landing page — same window-chrome language as
 * `HeroTeaser`, built from CSS + inline SVG (no images, no JS). They fill the
 * Document and Collaborate sections now and are sized so a real screenshot can
 * drop into the same framed slot later.
 */

function Chrome({
  file,
  badge,
}: {
  file: string;
  badge: { label: string; className: string };
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
      <span className="size-2.5 rounded-full bg-destructive/40" />
      <span className="size-2.5 rounded-full bg-document/50" />
      <span className="size-2.5 rounded-full bg-canvas/50" />
      <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">
        {file}
      </span>
      <span
        className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {badge.label}
      </span>
    </div>
  );
}

/** Document mode: prose with a voice note sitting inline as a block. */
export function DocumentTeaser() {
  return (
    <div
      aria-hidden="true"
      className="relative select-none overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/5"
    >
      <Chrome
        file="big-data-notes.vnote"
        badge={{ label: "document", className: "bg-document-muted text-document" }}
      />

      <div className="space-y-3 bg-background p-6">
        <div className="h-4 w-40 rounded bg-foreground/80" />
        <div className="space-y-2">
          <div className="h-2.5 w-full rounded bg-muted-foreground/25" />
          <div className="h-2.5 w-11/12 rounded bg-muted-foreground/25" />
          <div className="h-2.5 w-4/5 rounded bg-muted-foreground/25" />
        </div>

        {/* The inline voice block */}
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
            <svg viewBox="0 0 24 24" className="size-4 fill-current">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Prof’s aside on schema-on-read</p>
            <span className="mt-1.5 flex h-4 items-end gap-[3px]">
              {[7, 12, 5, 15, 9, 13, 6, 11, 8, 14, 5, 10].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-brand/60"
                  style={{ height: `${h}px` }}
                />
              ))}
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            1:38
          </span>
        </div>

        <div className="space-y-2 pt-1">
          <div className="h-2.5 w-full rounded bg-muted-foreground/25" />
          <div className="h-2.5 w-3/4 rounded bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
}

/** A little cursor with a name label, positioned absolutely. */
function Cursor({
  left,
  top,
  name,
  color,
}: {
  left: string;
  top: string;
  name: string;
  color: string;
}) {
  return (
    <div className="absolute flex items-start gap-1" style={{ left, top }}>
      <svg viewBox="0 0 16 16" className="size-4 drop-shadow" style={{ color }}>
        <path fill="currentColor" d="M1 1l5.5 14 2.2-5.8L14.5 7z" />
      </svg>
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  );
}

/** Collaboration: two people on one note, presence + live cursors. */
export function CollabTeaser() {
  return (
    <div
      aria-hidden="true"
      className="relative select-none overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/5"
    >
      <Chrome
        file="sprint-planning.vnote"
        badge={{ label: "canvas", className: "bg-canvas-muted text-canvas" }}
      />

      {/* Presence avatars floating on the chrome edge */}
      <div className="absolute right-4 top-11 z-10 flex -space-x-2">
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-[#6366f1] text-[10px] font-semibold text-white">
          SN
        </span>
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-[#10b981] text-[10px] font-semibold text-white">
          PR
        </span>
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
          +1
        </span>
      </div>

      <div className="relative aspect-[16/10] bg-background">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--muted-foreground) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {/* A couple of sticky-ish boxes being arranged together */}
        <div className="absolute left-[12%] top-[24%] rounded-lg border bg-card px-3 py-2 text-[11px] font-medium shadow-sm">
          Auth
        </div>
        <div className="absolute left-[44%] top-[54%] rounded-lg border bg-card px-3 py-2 text-[11px] font-medium shadow-sm">
          Voice budget
        </div>
        <div className="absolute left-[68%] top-[30%] rounded-lg border-2 border-canvas/40 bg-canvas-muted/40 px-3 py-2 text-[11px] font-medium text-canvas shadow-sm">
          .vnote export
        </div>

        <Cursor left="30%" top="46%" name="Suman" color="#6366f1" />
        <Cursor left="60%" top="60%" name="Priya" color="#10b981" />
      </div>
    </div>
  );
}
