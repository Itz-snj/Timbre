"use client";

import {
  getApp,
  getApps,
  initializeApp,
  FirebaseError,
  type FirebaseApp,
} from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import { requireFirebaseClientConfig } from "@/lib/env";

function app(): FirebaseApp {
  // Next.js Fast Refresh re-runs modules; re-initializing would throw.
  return getApps().length ? getApp() : initializeApp(requireFirebaseClientConfig());
}

export function auth(): Auth {
  return getAuth(app());
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

// Firebase codes that mean "the popup path isn't available here" — Chrome
// refused the popup, or the browser's storage partitioning won't let the
// cross-origin auth handler run. These are the cases where we retry via a
// full-page redirect. User cancellations (popup-closed-by-user,
// cancelled-popup-request) are deliberately NOT here — those should surface as
// normal cancellations, not trigger a redirect.
const POPUP_UNAVAILABLE = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

// Survives the round trip to Google in the same tab (sessionStorage persists
// across same-origin navigations). Lets us know, on return, that we should look
// for a redirect result — and lets exactly one mounted SignInButton claim it.
const REDIRECT_MARKER = "timbre:auth-redirect";

/**
 * Trade a signed-in Firebase user for the httpOnly session cookie the server
 * actually trusts. See ai_rules.md §6 — the client ID token only lives in the
 * browser, so `proxy.ts` and the API routes rely on this cookie instead.
 */
async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    // Don't leave the client holding a Firebase session the server rejected —
    // that state would render as "signed in" in the UI but 401 on every call.
    await firebaseSignOut(auth());
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not establish a session.");
  }
}

/**
 * Start Google sign-in.
 *
 * Prefers a popup (no full-page navigation, better UX). If Chrome blocks the
 * popup — or the browser's third-party storage rules break the cross-origin
 * auth handler, which is the common failure in production even when popups are
 * allowed in settings — we fall back to `signInWithRedirect`, which has neither
 * constraint.
 *
 * Returns `true` when sign-in completed in-page (popup). Returns `false` when we
 * handed off to a redirect: the browser is navigating away, and completion
 * happens on return via {@link completeRedirectSignIn}.
 */
export async function signInWithGoogle(): Promise<boolean> {
  try {
    const credential = await signInWithPopup(auth(), googleProvider());
    await establishSession(credential.user);
    return true;
  } catch (error) {
    if (error instanceof FirebaseError && POPUP_UNAVAILABLE.has(error.code)) {
      sessionStorage.setItem(REDIRECT_MARKER, "1");
      await signInWithRedirect(auth(), googleProvider());
      return false; // browser is navigating away now
    }
    throw error;
  }
}

/** True if this page load is the return leg of a redirect sign-in. */
export function isAwaitingRedirect(): boolean {
  return (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(REDIRECT_MARKER) === "1"
  );
}

/**
 * Finish a redirect-based sign-in. Safe to call on every load: it no-ops unless
 * we actually left via a redirect. The marker is cleared before we await so
 * that, with several SignInButtons mounted, only the first caller claims the
 * result.
 *
 * Returns `true` when a redirect sign-in completed and the session cookie is set.
 */
export async function completeRedirectSignIn(): Promise<boolean> {
  if (!isAwaitingRedirect()) return false;
  sessionStorage.removeItem(REDIRECT_MARKER);

  const result = await getRedirectResult(auth());
  if (!result) return false;

  await establishSession(result.user);
  return true;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
  await firebaseSignOut(auth());
}
