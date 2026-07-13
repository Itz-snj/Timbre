"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
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

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
  await firebaseSignOut(auth());
}
