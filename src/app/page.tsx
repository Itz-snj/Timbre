import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Download,
  FileText,
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
import { TrustRail } from "@/components/landing/trust-rail";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";

// The header reads the session cookie, so this page renders per-request.
export const dynamic = "force-dynamic";

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

      <main id="main" className="noise-overlay relative flex-1 overflow-hidden">
        {/* ── Ambient colour blobs ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          {/* Indigo — upper right */}
          <div
            className="animate-blob absolute -right-32 -top-16 h-[640px] w-[640px] rounded-full blur-[110px]"
            style={{ background: "oklch(0.51 0.19 276 / 0.065)" }}
          />
          {/* Teal — mid left */}
          <div
            className="animate-blob animation-delay-2000 absolute -left-24 top-[38%] h-[520px] w-[520px] rounded-full blur-[100px]"
            style={{ background: "oklch(0.58 0.12 196 / 0.05)" }}
          />
          {/* Amber — lower right */}
          <div
            className="animate-blob animation-delay-4000 absolute bottom-[10%] right-[15%] h-[460px] w-[460px] rounded-full blur-[100px]"
            style={{ background: "oklch(0.66 0.14 62 / 0.05)" }}
          />
        </div>

        <Hero isSignedIn={isSignedIn} />
        <TrustRail />
        <NoteTypes />
        <Collaborate />
        <FeatureGrid />
        <PortableFormat />
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

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-record" />
            Voice-first notes
          </p>

          <h1 className="hero-headline-shimmer mt-6 text-balance font-heading text-6xl font-semibold leading-[0.97] tracking-tight sm:text-7xl lg:text-8xl">
            {site.landing.heroHeadline}
          </h1>

          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            {site.landing.heroSub}
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
            <Button asChild variant="outline" size="lg">
              <Link href="#modes">See it in action</Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            {site.landing.heroReassurance}
          </p>
        </div>

        <HeroTeaser />
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
    <section id="modes" className="reveal-on-scroll scroll-mt-20 bg-muted/20">
      <div aria-hidden="true" className="gradient-divider" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Two modes
        </p>
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

          {/* Document mode mock. Canvas mode is in the hero. */}
          <DocumentTeaser />
        </div>
      </div>
    </section>
  );
}

function Collaborate() {
  return (
    <section id="collaborate" className="reveal-on-scroll scroll-mt-20">
      <div aria-hidden="true" className="gradient-divider" />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Collaborate
          </p>
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
    <section id="formats" className="reveal-on-scroll scroll-mt-20 bg-muted/20">
      <div aria-hidden="true" className="gradient-divider" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          The .vnote format
        </p>
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
