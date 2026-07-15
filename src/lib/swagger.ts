import "server-only";

import { createSwaggerSpec } from "next-swagger-doc";

/**
 * Builds the OpenAPI spec by scanning the `@swagger` JSDoc blocks that live above
 * each route handler (ai_rules.md §8). The docs are generated from the route files
 * themselves, so they can't drift out of sync with the code the way a hand-written
 * spec file would.
 */
export function getApiSpec(): Record<string, unknown> {
  return createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Timbre API",
        version: "0.1.0",
        description:
          "Voice-first collaborative notes. Every endpoint validates its body with Zod and authenticates via the `__session` cookie established by `POST /api/auth/session`.",
      },
      components: {
        securitySchemes: {
          sessionCookie: {
            type: "apiKey",
            in: "cookie",
            name: "__session",
            description:
              "httpOnly Firebase session cookie, valid for 24 hours. Set by POST /api/auth/session and sent automatically by the browser.",
          },
        },
      },
      security: [{ sessionCookie: [] }],
      tags: [
        { name: "Auth", description: "Sign-in, sign-out, and session lifecycle." },
        {
          name: "Notes",
          description: "Create, list, rename, and delete notes (canvas or document).",
        },
        {
          name: "Voice notes",
          description:
            "Record, list, and delete voice notes. Audio lives in Vercel Blob; Mongo holds only metadata. Per-user 5-minute budget enforced server-side.",
        },
      ],
    },
  }) as Record<string, unknown>;
}
