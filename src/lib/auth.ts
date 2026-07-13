import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, SESSION_COOKIE } from "@/lib/firebase/admin";
import { usersCollection } from "@/lib/mongodb";
import type { UserDoc } from "@/lib/models";

/**
 * Server-side session handling.
 *
 * `proxy.ts` also verifies the cookie, but that is a fast redirect for UX only —
 * Next's own docs say proxy "should not be used as a full session management or
 * authorization solution". So every API route calls `requireUser()` itself and
 * re-verifies independently. Proxy keeps signed-out users from *seeing* the app
 * shell; this is what actually enforces access.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Verifies the session cookie. Returns null when it's missing, malformed, or
 * past its 24h window — Firebase enforces that expiry itself, so there's no
 * custom timer here (ai_rules.md §6).
 */
export async function getSession(): Promise<DecodedIdToken | null> {
  // Next.js 16: cookies() is async — synchronous access was removed entirely.
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    return await adminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

/**
 * The authenticated user, lazily mirrored into Mongo.
 *
 * We upsert on first authenticated request rather than using a Firebase Auth
 * `onCreate` trigger, because Cloud Functions triggers require the paid Blaze
 * plan (ai_rules.md §6). `$setOnInsert` guards `totalVoiceSeconds` so a returning
 * user's voice budget is never reset by a later sign-in.
 */
export async function requireUser(): Promise<UserDoc> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  return upsertUser(session);
}

async function upsertUser(session: DecodedIdToken): Promise<UserDoc> {
  const users = await usersCollection();
  const now = new Date();

  const upsert = () =>
    users.findOneAndUpdate(
      { firebaseUid: session.uid },
      {
        $set: {
          name: session.name ?? null,
          email: session.email ?? null,
          photoURL: session.picture ?? null,
          updatedAt: now,
        },
        $setOnInsert: {
          firebaseUid: session.uid,
          totalVoiceSeconds: 0,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

  try {
    const user = await upsert();
    if (user) return user;
  } catch (error: unknown) {
    // Two concurrent first-ever requests from the same new user both miss, both
    // try to insert, and the unique index on firebaseUid rejects the loser. The
    // row it wanted now exists, so a plain retry resolves to it.
    if (!isDuplicateKeyError(error)) throw error;
    const user = await upsert();
    if (user) return user;
  }

  throw new Error("Failed to load the user record after upsert.");
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
