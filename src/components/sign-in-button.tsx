"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  completeRedirectSignIn,
  isAwaitingRedirect,
  signInWithGoogle,
} from "@/lib/firebase/client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.21 7.21 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function SignInButton({
  className,
  size = "lg",
  children = "Continue with Google",
}: {
  className?: string;
  size?: "default" | "sm" | "lg";
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // proxy.ts stashes the page they were trying to reach; send them back there.
  // Only honour same-app paths — an attacker-supplied ?next=https://evil.tld
  // would otherwise turn sign-in into an open redirect.
  const next = searchParams.get("next");
  const destination = next?.startsWith("/app") ? next : "/app";

  const busy = isSigningIn || isPending;

  function finishSignIn() {
    // The session cookie exists now, so proxy.ts will let this through.
    startTransition(() => {
      router.push(destination);
      router.refresh();
    });
  }

  // When the popup path isn't available, signInWithGoogle() falls back to a
  // full-page redirect to Google. On the return leg we land back here and have
  // to finish the session exchange. Several SignInButtons may be mounted; the
  // sessionStorage marker inside completeRedirectSignIn() ensures only the first
  // one claims the result.
  useEffect(() => {
    if (!isAwaitingRedirect()) return;

    let active = true;
    // Reflect the in-flight redirect completion. This runs once, only on the
    // return leg of a redirect sign-in, so the extra render is inconsequential.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSigningIn(true);
    completeRedirectSignIn()
      .then((completed) => {
        if (active && completed) finishSignIn();
      })
      .catch((error: unknown) => {
        if (!active) return;
        toast.error("Sign-in failed", {
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        });
      })
      .finally(() => {
        if (active) setIsSigningIn(false);
      });

    return () => {
      active = false;
    };
    // Runs once on mount; destination/router are stable for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn() {
    setIsSigningIn(true);
    try {
      const completed = await signInWithGoogle();
      if (completed) {
        finishSignIn();
      }
      // Otherwise we fell back to a redirect — the browser is navigating away
      // and completion happens on return (see the effect above). Keep the
      // spinner up rather than flashing it off before the page unloads.
    } catch (error: unknown) {
      setIsSigningIn(false);

      // Dismissing the Google popup is a normal thing to do, not an error worth
      // shouting about.
      if (
        error instanceof FirebaseError &&
        (error.code === "auth/popup-closed-by-user" ||
          error.code === "auth/cancelled-popup-request")
      ) {
        return;
      }

      toast.error("Sign-in failed", {
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={busy}
      size={size}
      className={cn("gap-2.5", className)}
    >
      {busy ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <GoogleMark />
      )}
      {busy ? "Signing you in…" : children}
    </Button>
  );
}
