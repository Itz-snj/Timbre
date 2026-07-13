import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Package, PenLine } from "lucide-react";
import { Brand } from "@/components/brand";
import { HeroTeaser } from "@/components/hero-teaser";
import { SignInButton } from "@/components/sign-in-button";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Brand />
          <div className="flex items-center gap-2">
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
              <Suspense fallback={<div className="h-9 w-24" />}>
                <SignInButton size="sm">Sign in</SignInButton>
              </Suspense>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Hero isSignedIn={isSignedIn} />
        <NoteTypes />
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

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-record" />
            Voice-first notes
          </p>

          <h1 className="mt-6 text-balance font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The note that talks back.
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            Most apps treat your voice as something to transcribe, then throw
            away. Here the recording{" "}
            <em className="font-medium not-italic text-foreground">is</em> the
            note — as long as you like, in whatever language you think in. Sketch
            around it on a canvas, or write around it in a document.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
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
              <Link href="#formats">See how it travels</Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Google sign-in · 5 minutes of recording per account
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
    <section className="border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Two ways to think. Pick one per note.
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
          Sketching and writing are different acts. Forcing both into a single
          metaphor serves neither, so we didn&apos;t.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {types.map((type) => (
            <div
              key={type.name}
              className="rounded-2xl border bg-card p-7 transition-shadow hover:shadow-md"
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
      </div>
    </section>
  );
}

function PortableFormat() {
  return (
    <section id="formats" className="scroll-mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
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
            <code className="font-mono text-sm">.epub</code> use. Hand it to
            someone. Open it back up here. The recording plays exactly as you left
            it.
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
    </section>
  );
}
