import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Download,
  FileText,
  Mic,
  Package,
  PenLine,
  Upload,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { HeroTeaser } from "@/components/hero-teaser";
import { DocumentTeaser, CollabTeaser } from "@/components/landing-visuals";
import { SignInButton } from "@/components/sign-in-button";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

// The header reads the session cookie, so this page renders per-request.
export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "how", n: "01", label: "How it works" },
  { id: "modes", n: "02", label: "Two modes" },
  { id: "collaborate", n: "03", label: "Collaborate" },
  { id: "formats", n: "04", label: "The .vnote format" },
  { id: "limits", n: "05", label: "Limits" },
];

export default async function LandingPage() {
  // A signed-in visitor shouldn't be asked to sign in again — send them onward.
  // If Firebase isn't configured yet we still want the page to render, so this
  // failure is non-fatal.
  const session = await getSession().catch(() => null);
  const isSignedIn = session !== null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Brand />
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="#formats">Format</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/api-doc">API</Link>
            </Button>
            {isSignedIn ? (
              <Button asChild size="sm">
                <Link href="/app">
                  Open app <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Suspense fallback={<div className="h-9 w-28" />}>
                <SignInButton size="sm">Open Timbre</SignInButton>
              </Suspense>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Hero isSignedIn={isSignedIn} />
        <TocNav />
        <HowItWorks />
        <NoteTypes />
        <Collaborate />
        <PortableFormat />
        <Limits isSignedIn={isSignedIn} />
      </main>

      <SiteFooter />
    </>
  );
}

function Hero({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand wash behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--brand-muted),transparent)]"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-record" />
            Voice-first notes
          </p>

          <h1 className="mt-6 text-balance font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The note that talks back.
          </h1>

          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            The recording{" "}
            <em className="font-medium not-italic text-foreground">is</em> the
            note — any length, any language. Sketch around it, or write around
            it.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {isSignedIn ? (
              <Button asChild size="lg">
                <Link href="/app">
                  Open your notes <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Suspense fallback={<div className="h-11 w-56" />}>
                <SignInButton />
              </Suspense>
            )}
            <Button asChild variant="ghost" size="lg">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Google sign-in · 5 minutes of recording per account · free
          </p>
        </div>

        <HeroTeaser />
      </div>
    </section>
  );
}

/** delayt-style numbered table of contents for the page. */
function TocNav() {
  return (
    <nav
      aria-label="On this page"
      className="border-y bg-muted/20"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
        <span className="font-mono text-xs text-muted-foreground">{"// on this page"}</span>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <Link
                href={`#${s.id}`}
                className="group inline-flex items-baseline gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="font-mono text-xs text-brand">{s.n}</span>
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Mic,
      title: "Record",
      copy: "Hit record and talk — however long you need, in any language. The audio is saved as the content itself. No transcription required to keep it.",
    },
    {
      n: "02",
      icon: PenLine,
      title: "Place it",
      copy: "Pin the recording to an exact spot on a canvas, or drop it inline as a block in a document. It lives where it actually makes sense.",
    },
    {
      n: "03",
      icon: Package,
      title: "Carry it",
      copy: "Export the whole note — drawing, text and real audio — as one .vnote file. Hand it to someone. Re-open it here and it plays back exactly.",
    },
  ];

  return (
    <section id="how" className="scroll-mt-20 border-b">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-xs text-muted-foreground">{"// 01 · how it works"}</p>
        <h2 className="mt-3 max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Record, place, carry.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
          Three steps, and the voice memo never leaves the note it belongs to.
        </p>

        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="relative rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                  <step.icon className="size-4" />
                </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {step.n}
                </span>
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {step.copy}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function NoteTypes() {
  const types = [
    {
      icon: PenLine,
      name: "Canvas",
      chip: "bg-canvas-muted text-canvas",
      copy: "An infinite, freeform space. Draw the diagram while you talk through it, and pin each recording to the exact spot on the board it explains.",
    },
    {
      icon: FileText,
      name: "Document",
      chip: "bg-document-muted text-document",
      copy: "A block editor in the Obsidian mould. Recordings sit inline as blocks, in the flow of the writing — not bolted onto a sidebar.",
    },
  ];

  return (
    <section id="modes" className="scroll-mt-20 border-b bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-xs text-muted-foreground">{"// 02 · two modes"}</p>
        <h2 className="mt-3 max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Two ways to think. Pick one per note.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
          Sketching and writing are different acts. Forcing both into a single
          metaphor serves neither, so we didn&apos;t.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="grid gap-6">
            {types.map((type) => (
              <div
                key={type.name}
                className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${type.chip}`}
                >
                  <type.icon className="size-3.5" />
                  {type.name}
                </span>
                <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
                  {type.copy}
                </p>
              </div>
            ))}
          </div>

          {/* Document mode, shown. (Canvas mode is in the hero.) */}
          <DocumentTeaser />
        </div>
      </div>
    </section>
  );
}

function Collaborate() {
  return (
    <section id="collaborate" className="scroll-mt-20 border-b">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{"// 03 · collaborate"}</p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-brand">
            <Users className="size-3.5" />
            Live
          </span>

          <h2 className="mt-5 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Think out loud, together.
          </h2>

          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Share a note with a link and edit it side by side — cursors, presence
            and changes appear within about a second. Everyone can record their
            own voice note onto the same board; each pin remembers who left it.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Live cursors and presence avatars for everyone in the room.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Two access levels per link —{" "}
              <span className="font-medium text-foreground">can edit</span> or{" "}
              <span className="font-medium text-foreground">can view</span>.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
              Voice notes sync live too — recorded pins show up for everyone at
              once.
            </li>
          </ul>
        </div>

        <CollabTeaser />
      </div>
    </section>
  );
}

function PortableFormat() {
  return (
    <section id="formats" className="scroll-mt-20 border-b bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-xs text-muted-foreground">{"// 04 · the .vnote format"}</p>
        <div className="mt-3 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-brand">
              <Package className="size-3.5" />
              .vnote
            </span>

            <h2 className="mt-5 text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              One file. Audio included.
            </h2>

            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              A cloud link is not a copy. Export a note and you get a single{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                .vnote
              </code>{" "}
              file carrying the drawing, the text, and the real audio inside it —
              the same trick <code className="font-mono text-sm">.docx</code> and{" "}
              <code className="font-mono text-sm">.epub</code> use. There&apos;s
              no OS handler for it, which is the point: it only opens back up
              here, where the recordings play.
            </p>
          </div>

          {/* The bundle, unpacked */}
          <div className="rounded-2xl border bg-card p-6 font-mono text-sm shadow-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Package className="size-4 text-brand" />
              hydrology-lecture.vnote
            </div>
            <div className="mt-4 space-y-1.5 text-muted-foreground">
              <div className="flex items-baseline gap-2">
                <span className="text-border">├──</span>
                <span className="text-foreground">manifest.json</span>
                <span className="text-xs">the note itself</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-border">└──</span>
                <span className="text-foreground">audio/</span>
              </div>
              <div className="flex items-baseline gap-2 pl-6">
                <span className="text-border">├──</span>
                <span>vn_1.webm</span>
                <span className="text-xs tabular-nums">2:14</span>
              </div>
              <div className="flex items-baseline gap-2 pl-6">
                <span className="text-border">└──</span>
                <span>vn_2.webm</span>
                <span className="text-xs tabular-nums">4:02</span>
              </div>
            </div>
          </div>
        </div>

        {/* manifest shape + round-trip */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="font-mono text-xs text-muted-foreground">{"// manifest.json — the note, described"}</p>
            <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground">
              <code>{`{
  "version": "2.0",
  "type": "vnote-bundle",
  "noteType": "canvas",
  "meta":   { "title": "Hydrology lecture" },
  "canvas": { "elements": [ … ], "appState": { … } },
  "voiceNotes": [
    {
      "audioFile":   "audio/vn_1.webm",
      "durationSec": 134,
      "position":    { "x": 420, "y": 180 }
    }
  ]
}`}</code>
            </pre>
          </div>

          <div className="grid gap-4">
            <RoundTrip
              icon={Download}
              dir="Export"
              copy="Stream the note and every recording straight into a zip — nothing buffered, nothing left in the cloud."
            />
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ArrowLeftRight className="size-3.5" />
              <span className="font-mono">round-trip</span>
            </div>
            <RoundTrip
              icon={Upload}
              dir="Import"
              copy="Got a .vnote someone sent you? Open it here — the audio re-uploads, the pins and blocks come back, and it becomes a note of your own."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function RoundTrip({
  icon: Icon,
  dir,
  copy,
}: {
  icon: typeof Download;
  dir: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <Icon className="size-4" />
        </span>
        <span className="font-heading text-base font-semibold tracking-tight">
          {dir}
        </span>
      </div>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
        {copy}
      </p>
    </div>
  );
}

function Limits({ isSignedIn }: { isSignedIn: boolean }) {
  const rows = [
    ["recording", "up to 5:00 total per account"],
    ["languages", "any — the audio is the note, language-agnostic"],
    ["note types", "canvas · document"],
    ["collaboration", "live · one room per note · editor / viewer roles"],
    ["portable file", ".vnote — a zip carrying manifest + audio"],
    ["audio storage", "private, streamed on demand — never public"],
    ["sign-in", "Google"],
  ];

  return (
    <section id="limits" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="font-mono text-xs text-muted-foreground">{"// 05 · limits & availability"}</p>
        <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              The honest spec sheet.
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              What you get, stated plainly. No asterisks.
            </p>

            <div className="mt-8">
              {isSignedIn ? (
                <Button asChild size="lg">
                  <Link href="/app">
                    Open your notes <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Suspense fallback={<div className="h-11 w-56" />}>
                  <SignInButton>Start with Google</SignInButton>
                </Suspense>
              )}
            </div>
          </div>

          <dl className="divide-y rounded-2xl border bg-card font-mono text-sm">
            {rows.map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="w-40 shrink-0 text-muted-foreground">{key}</dt>
                <dd className="text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
