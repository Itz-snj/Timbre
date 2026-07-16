/**
 * Closing CTA band — Miro's conversion-close analog.
 * Full-bleed brand-muted section with a Fraunces headline, primary CTA,
 * and a short reassurance line. Accepts `isSignedIn` to mirror Hero behaviour.
 * Server component.
 */
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/sign-in-button";
import { site } from "@/lib/site";

export function ClosingCTA({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-brand-muted">
      {/* Soft brand radial — mirrors the hero wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-[radial-gradient(60%_60%_at_50%_100%,var(--brand-muted),transparent)] opacity-60"
      />

      <div className="relative mx-auto max-w-7xl px-6 py-20 text-center lg:py-28">
        <h2 className="text-balance font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {site.landing.closingHeadline}
        </h2>
        <p className="mt-4 text-muted-foreground">{site.landing.closingSub}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isSignedIn ? (
            <Button asChild size="lg">
              <Link href="/app">
                Open your notes <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Suspense fallback={<div className="h-11 w-56" />}>
              <SignInButton size="lg" />
            </Suspense>
          )}
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          {site.landing.closingReassurance}
        </p>
      </div>
    </section>
  );
}
