import { z } from "zod";

/**
 * Environment validation.
 *
 * Server vars are validated lazily (on first access) rather than at module load
 * so that `next build` — which imports modules without a full runtime env —
 * doesn't fail before Vercel has injected the real values.
 */

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1).default("timbre"),

  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.email("FIREBASE_CLIENT_EMAIL must be an email"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),

  // Optional so the rest of the app (Mongo, auth) keeps working before the Blob
  // store is provisioned — only the voice routes need it, and they check for it
  // themselves and return a clear error when it's absent (Phase 4, ai_rules §5).
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment. Check .env.local (and the Vercel dashboard):\n${missing}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * Client (browser) config for the Firebase SDK.
 *
 * These must be referenced as literal `process.env.NEXT_PUBLIC_*` expressions —
 * Next.js inlines them at build time by static analysis, so a computed lookup
 * like `process.env[key]` would resolve to undefined in the browser.
 *
 * A Firebase web API key is not a secret; it identifies the project. Access is
 * controlled by Firebase Auth + our own server-side session checks, not by
 * hiding this value.
 */
export const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

/** Narrows the config to all-strings, throwing a readable error if any var is unset. */
export function requireFirebaseClientConfig(): Record<
  keyof typeof firebaseClientConfig,
  string
> {
  const missing = Object.entries(firebaseClientConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Firebase client config is incomplete — missing: ${missing.join(", ")}. ` +
        `Set the corresponding NEXT_PUBLIC_FIREBASE_* vars in .env.local.`,
    );
  }

  return firebaseClientConfig as Record<
    keyof typeof firebaseClientConfig,
    string
  >;
}
