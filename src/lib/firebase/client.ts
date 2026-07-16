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
 * The browser refused to open (or immediately closed) the sign-in popup. Thrown
 * as its own type so the UI can give an actionable "allow pop-ups" message
 * instead of a generic failure.
 *
 * We deliberately do NOT fall back to `signInWithRedirect` here: on Chrome the
 * redirect flow's `getRedirectResult` has to read its pending state out of
 * third-party storage, which Chrome's storage partitioning blocks — so the
 * redirect returns and silently does nothing. The popup completes the OAuth
 * inside the popup window and returns the credential via postMessage, never
 * touching partitioned storage, which is why it's the reliable path.
 */
export class PopupBlockedError extends Error {
  constructor() {
    super("The browser blocked the sign-in popup.");
    this.name = "PopupBlockedError";
  }
}

const POPUP_BLOCKED_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

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

  let credential;
  try {
    credential = await signInWithPopup(auth(), provider);
  } catch (error) {
    if (error instanceof FirebaseError && POPUP_BLOCKED_CODES.has(error.code)) {
      throw new PopupBlockedError();
    }
    throw error;
  }

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
