import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import type { UserDoc } from "@/lib/models";

/**
 * Shared request-handling helpers for the API routes.
 *
 * Every route repeats the same three moves — authenticate, validate, answer in
 * one JSON error shape — so they live here rather than being copy-pasted. The
 * error envelope (`{ error, issues? }`) matches what `/api/auth/session` already
 * returns, so the whole API speaks one dialect.
 */

/**
 * The authenticated user, or `null` when the session cookie is missing/expired.
 *
 * `requireUser()` throws `UnauthorizedError` in that case; here we translate it
 * into a `null` the caller turns into a 401, while letting any *other* failure
 * (e.g. Mongo is down) propagate as a real 500 rather than masquerading as
 * "signed out".
 */
export async function currentUser(): Promise<UserDoc | null> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  }
}

export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function unauthorized(): NextResponse {
  return jsonError("Authentication required.", 401);
}

export function notFound(message = "Not found."): NextResponse {
  return jsonError(message, 404);
}

/** 400 carrying a Zod issue tree, so the client can pinpoint the bad field. */
export function validationError(error: z.ZodError): NextResponse {
  return jsonError("Invalid request.", 400, { issues: z.treeifyError(error) });
}

/**
 * Reads and Zod-validates a JSON body in one step. Returns either the parsed
 * data or a ready-to-return error response (400 for non-JSON or schema misses),
 * so a route can write `const parsed = await parseJsonBody(...); if (parsed
 * instanceof NextResponse) return parsed;`.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  return parsed.data;
}
