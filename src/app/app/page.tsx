import { CheckCircle2, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { pingDb } from "@/lib/mongodb";

export const metadata = { title: "Your notes" };

// Reads the session cookie and pings Mongo — never prerender this.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Phase 0's whole point is proving the base infrastructure is live, so we
  // round-trip the database here rather than merely claiming it's connected.
  // This panel gets replaced by the real notes list in Phase 1.
  const db = await pingDb().then(
    () => ({ ok: true as const }),
    (error: unknown) => ({
      ok: false as const,
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-balance font-heading text-4xl font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}.` : "Welcome."}
      </h1>
      <p className="mt-3 max-w-lg text-pretty text-muted-foreground">
        You&apos;re signed in and your account is live. Notes — canvas and
        document — arrive in the next build.
      </p>

      <section
        aria-labelledby="infra-heading"
        className="mt-12 max-w-xl rounded-2xl border bg-card p-7"
      >
        <h2
          id="infra-heading"
          className="font-heading text-lg font-semibold tracking-tight"
        >
          Phase 0 · base infrastructure
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A temporary panel that proves the foundations are working end to end.
        </p>

        <dl className="mt-6 space-y-3">
          <Check label="Google sign-in" detail={user.email ?? "session active"} ok />
          <Check
            label="Session cookie"
            detail="httpOnly · verified server-side · 24h"
            ok
          />
          <Check
            label="MongoDB Atlas"
            detail={db.ok ? "connected · user record synced" : db.message}
            ok={db.ok}
          />
        </dl>
      </section>
    </div>
  );
}

function Check({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {ok ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-canvas"
          aria-hidden="true"
        />
      ) : (
        <XCircle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0">
        <dt className="text-sm font-medium">
          {label}
          <span className="sr-only">: {ok ? "working" : "failing"}</span>
        </dt>
        <dd className="truncate text-sm text-muted-foreground">{detail}</dd>
      </div>
    </div>
  );
}
