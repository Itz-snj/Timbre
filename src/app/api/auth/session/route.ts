import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  adminAuth,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/firebase/admin";

const createSessionSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

/** Firebase requires a sign-in no older than 5 minutes to mint a session cookie. */
const MAX_AUTH_AGE_MS = 5 * 60 * 1000;

/**
 * @swagger
 * /api/auth/session:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a Firebase ID token for a 24-hour session cookie
 *     description: >
 *       Called by the browser straight after Google sign-in. Verifies the Firebase
 *       ID token, checks the sign-in actually happened in the last five minutes,
 *       and mints an httpOnly session cookie that lasts 24 hours. That cookie —
 *       not the ID token — is what every subsequent request is authenticated with.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: The ID token from the Firebase client SDK.
 *     responses:
 *       201:
 *         description: Session established; the cookie is set on the response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid: { type: string }
 *                 expiresAt: { type: string, format: date-time }
 *       400:
 *         description: Body failed validation (missing or empty idToken).
 *       401:
 *         description: The ID token is invalid, expired, or the sign-in is too old.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    // checkRevoked: reject a token whose user was disabled or had their refresh
    // tokens revoked since it was minted.
    const decoded = await adminAuth().verifyIdToken(parsed.data.idToken, true);

    // A Firebase ID token stays valid for an hour. Without this check, an ID
    // token lifted from a browser 50 minutes ago could still be upgraded into a
    // fresh 24-hour session — turning a short leak into a long one. Firebase's
    // own guidance is to require a recent sign-in here.
    const authAgeMs = Date.now() - decoded.auth_time * 1000;
    if (authAgeMs > MAX_AUTH_AGE_MS) {
      return NextResponse.json(
        { error: "Recent sign-in required. Please sign in again." },
        { status: 401 },
      );
    }

    const sessionCookie = await adminAuth().createSessionCookie(
      parsed.data.idToken,
      { expiresIn: SESSION_MAX_AGE_MS },
    );

    const store = await cookies();
    store.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return NextResponse.json(
      {
        uid: decoded.uid,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    // The client gets a deliberately vague message — telling an attacker *why*
    // a token was rejected is a gift. But swallowing the cause entirely makes
    // this route undebuggable, so the real error goes to the server log.
    console.error("[auth/session] Failed to establish session:", error);

    return NextResponse.json(
      { error: "Could not verify that sign-in. Please try again." },
      { status: 401 },
    );
  }
}

/**
 * @swagger
 * /api/auth/session:
 *   delete:
 *     tags: [Auth]
 *     summary: Sign out — clear the session cookie
 *     description: >
 *       Clears the session cookie and revokes the user's Firebase refresh tokens,
 *       so the session cannot be resumed on any device rather than merely being
 *       forgotten by this browser. Always returns 204, even when no session was
 *       present, so that signing out is idempotent.
 *     responses:
 *       204:
 *         description: Signed out. The session cookie has been cleared.
 */
export async function DELETE() {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;

  if (session) {
    try {
      // Clearing the cookie alone only ends the session in *this* browser. If
      // the cookie leaked, it would still be usable elsewhere until it expired,
      // so revoke server-side too and let verifySessionCookie(checkRevoked) reject it.
      const decoded = await adminAuth().verifySessionCookie(session, false);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid or expired — nothing to revoke. Still clear the cookie.
    }
  }

  store.delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
