"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  signInWithGoogle,
  signInWithGoogleRedirect,
  handleSignInRedirect,
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

  const isHandlingRedirect = useRef(false);

  useEffect(() => {
    // Only try to handle redirect result once on mount
    if (isHandlingRedirect.current) return;
    isHandlingRedirect.current = true;

    async function checkRedirect() {
      try {
        const success = await handleSignInRedirect();
        if (success) {
          setIsSigningIn(true);
          startTransition(() => {
            router.push(destination);
            router.refresh();
          });
        }
      } catch (error: unknown) {
        toast.error("Sign-in failed", {
          description:
            error instanceof Error
              ? error.message
              : "Could not complete sign-in.",
        });
      }
    }
    checkRedirect();
  }, [destination, router]);

  const busy = isSigningIn || isPending;

  async function handleSignIn() {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      // The session cookie exists now, so proxy.ts will let this through.
      startTransition(() => {
        router.push(destination);
        router.refresh();
      });
    } catch (error: unknown) {
      // Dismissing the Google popup is a normal thing to do, not an error worth
      // shouting about.
      if (
        error instanceof FirebaseError &&
        (error.code === "auth/popup-closed-by-user" ||
          error.code === "auth/cancelled-popup-request")
      ) {
        return;
      }

      // If the browser strictly blocked the popup, fall back to redirect.
      if (error instanceof FirebaseError && error.code === "auth/popup-blocked") {
        toast.info("Popup blocked. Redirecting to Google...");
        try {
          await signInWithGoogleRedirect();
          return; // The page will navigate away
        } catch (redirectError) {
          // If even the redirect fails to launch, fall through to the generic error.
          error = redirectError;
        }
      }

      toast.error("Sign-in failed", {
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSigningIn(false);
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
