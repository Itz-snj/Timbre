/**
 * Feature grid — Miro-style flat benefit cards.
 * Absorbs the former HowItWorks steps + Limits spec-sheet facts into
 * 6 concise cards. 3-column on desktop, 2-column tablet, 1-column mobile.
 * Server component.
 */
import {
  Globe,
  Mic,
  MousePointer2,
  Package,
  PenLine,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Mic,
    title: "Voice is the note",
    copy: "Hit record and talk — the audio is stored as the content itself. No transcription required to keep it.",
  },
  {
    icon: PenLine,
    title: "Place it precisely",
    copy: "Pin a recording to the exact spot on a canvas, or drop it inline in a document. It lives where it belongs.",
  },
  {
    icon: Globe,
    title: "Any language",
    copy: "The audio is the note — language-agnostic by design. Talk in whatever tongue the thought arrives in.",
  },
  {
    icon: MousePointer2,
    title: "Live cursors",
    copy: "Share a link and edit side by side. Presence and changes appear within a second; everyone's cursor is visible.",
  },
  {
    icon: ShieldCheck,
    title: "Edit or view",
    copy: "Two access levels per shared link — collaborators either edit alongside you or read without touching anything.",
  },
  {
    icon: Package,
    title: "One portable file",
    copy: "Export as a .vnote — a single zip carrying drawing, text, and real audio. Import it back; everything plays.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section id="features" className="reveal-on-scroll scroll-mt-20">
      <div aria-hidden="true" className="gradient-divider" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          What you get
        </p>
        <h2 className="mt-3 max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything a voice note should be.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
          Six things that make Timbre different from a recording app.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feat) => (
            <li
              key={feat.title}
              className="feature-card rounded-2xl border bg-card p-6"
            >
              <span className="feature-icon flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <feat.icon className="size-4" />
              </span>
              <h3 className="mt-5 font-heading text-lg font-semibold tracking-tight">
                {feat.title}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {feat.copy}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
