/**
 * Tech trust rail — continuous pure CSS marquee.
 * Infinite horizontal marquee with branded tech badges + pill treatment.
 * Fade masks on both edges for a premium scroll effect.
 * Server component — marquee is pure CSS (no JS).
 */

interface TechItem {
  abbr: string;
  name: string;
  badge: string;
}

const TECH: TechItem[] = [
  { abbr: "N",  name: "Next.js",    badge: "bg-brand-muted     text-brand"      },
  { abbr: "TS", name: "TypeScript", badge: "bg-brand-muted     text-brand"      },
  { abbr: "F",  name: "Firebase",   badge: "bg-record/15       text-record"     },
  { abbr: "M",  name: "MongoDB",    badge: "bg-canvas-muted    text-canvas"     },
  { abbr: "▲",  name: "Vercel",     badge: "bg-foreground/10   text-foreground" },
  { abbr: "E",  name: "Excalidraw", badge: "bg-document-muted  text-document"   },
  { abbr: "Tt", name: "Tiptap",     badge: "bg-canvas-muted    text-canvas"     },
  { abbr: "S",  name: "Socket.io",  badge: "bg-brand-muted     text-brand"      },
];

// Duplicate for seamless loop — marquee animates translateX(-50%)
const DOUBLED = [...TECH, ...TECH];

export function TrustRail() {
  return (
    <div className="border-y">
      {/* Header row */}
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-6 pb-5 pt-7">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
            Stack
          </p>
          <p className="mt-1 font-heading text-lg font-semibold tracking-tight text-foreground/75">
            Built with open tools.
          </p>
        </div>
        <p className="hidden max-w-[260px] text-right text-xs leading-relaxed text-muted-foreground sm:block">
          Production-grade, open-source — no proprietary black boxes.
        </p>
      </div>

      {/* Marquee track with fade-edge masks */}
      <div
        className="relative mx-auto max-w-7xl overflow-hidden pb-7"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
        }}
      >
        <div className="flex w-max animate-marquee items-center gap-3 px-6 hover:[animation-play-state:paused]">
          {DOUBLED.map((tech, i) => (
            <div
              key={`${tech.name}-${i}`}
              className="inline-flex shrink-0 items-center gap-2.5 rounded-full border border-border/60 bg-card/80 px-5 py-2.5 text-sm font-medium text-foreground/70 backdrop-blur-sm"
            >
              {/* Theme-colored letter badge */}
              <span
                className={`flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold leading-none tracking-tight ${tech.badge}`}
                aria-hidden="true"
              >
                {tech.abbr}
              </span>
              {tech.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
