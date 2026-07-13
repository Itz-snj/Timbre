import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, SESSION_COOKIE } from "@/lib/firebase/admin";

/**
 * Route guard for the authenticated app (ai_rules.md §6).
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` and — crucially — switched it
 * to the **Node.js runtime by default**. On older versions the Firebase Admin SDK
 * simply couldn't run here (it needs `net`/`tls`), which is why the ecosystem grew
 * a pile of edge-compatible workaround libraries. We don't need any of them.
 *
 * Scope: this is a *fast redirect for UX*, not the authorization boundary. Next's
 * own docs are explicit that proxy "should not be used as a full session
 * management or authorization solution". So we verify the cookie's signature and
 * expiry here to keep signed-out users out of the app shell, but we deliberately
 * skip the `checkRevoked` lookup — that costs a network round trip to Firebase on
 * every single navigation. The authoritative check (including revocation) lives in
 * `requireUser()`, which every API route calls for itself.
 */
export async function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    return redirectToLanding(request);
  }

  try {
    // Signature + 24h expiry. Firebase enforces the expiry itself — this throws
    // once the cookie's window has passed, so there's no custom timer anywhere.
    await adminAuth().verifySessionCookie(session, false);
    return NextResponse.next();
  } catch {
    // Expired or tampered with. Redirect *and* clear it, so the browser stops
    // replaying a dead cookie on every subsequent request.
    const response = redirectToLanding(request);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}

function redirectToLanding(request: NextRequest) {
  const url = new URL("/", request.url);
  // Remember where they were headed so sign-in can return them there.
  const target = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("next", target);
  url.searchParams.set("reason", "auth");
  return NextResponse.redirect(url);
}

export const config = {
  // Guards the authenticated app only. The landing page, the auth API (which has
  // to be reachable *while* signed out to establish a session), and static assets
  // are all intentionally outside this.
  matcher: ["/app/:path*"],
};
