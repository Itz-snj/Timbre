"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type Auth,
} from "firebase/auth";
import { requireFirebaseClientConfig } from "@/lib/env";

function app(): FirebaseApp {
  // Next.js Fast Refresh re-runs modules; re-initializing would throw.
  return getApps().length ? getApp() : initializeApp(requireFirebaseClientConfig());
}

export function auth(): Auth {
  return getAuth(app());
}

/**
 * Full sign-in round trip.
 *
 * Firebase's client SDK gives us an ID token, but that token only lives in the
 * browser and lasts an hour. The server can't see it on a normal navigation, so
 * we immediately trade it for an httpOnly session cookie (see
 * `/api/auth/session`) — that cookie is what `proxy.ts` and the API routes
 * actually trust. See ai_rules.md §6.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth(), provider);
  const idToken = await credential.user.getIdToken();

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
 * Triggers a redirect sign-in. The browser will navigate away to Google.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithRedirect(auth(), provider);
}

/**
 * Call this on mount to catch the credential after returning from a redirect.
 * It completes the sign-in by trading the token for our session cookie.
 * Returns true if a redirect was processed and a session established, false otherwise.
 */
export async function handleSignInRedirect(): Promise<boolean> {
  const credential = await getRedirectResult(auth());
  if (!credential) return false;

  const idToken = await credential.user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    await firebaseSignOut(auth());
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? "Could not establish a session.");
  }

  return true;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
  await firebaseSignOut(auth());
}
