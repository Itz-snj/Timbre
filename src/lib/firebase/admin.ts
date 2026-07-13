import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { serverEnv } from "@/lib/env";

const ADMIN_APP = "timbre-admin";

function adminApp(): App {
  const existing = getApps().find((a) => a.name === ADMIN_APP);
  if (existing) return existing;

  const env = serverEnv();

  return initializeApp(
    {
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        // Dashboards and .env files store the PEM with literal "\n" sequences
        // rather than real newlines; the cert parser needs the real thing.
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    },
    ADMIN_APP,
  );
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** 24 hours, in milliseconds — the session length required by ai_rules.md §6. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 1000;

export const SESSION_COOKIE = "__session";
