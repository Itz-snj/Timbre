# Timbre — the note that talks back

A note-taking app where the **voice recording is the note**, not a caption bolted onto one. Notes come in two flavours — an Excalidraw-style **canvas** and an Obsidian-style **document** — recordings can be any length in any language, and any note exports as a single portable `.vnote` file that carries its own audio inside it.

**Live:** <https://timbre-snj.vercel.app>

> **Status: Phase 0 (base infrastructure) complete.** Auth, database, deployment, and API docs are live and verified. Note CRUD and the editors land in Phase 1+. See [Build phases](#build-phases).

---

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | Mandated by the assignment |
| Auth | Firebase Authentication (Google) + Admin SDK | Free at this scale on Spark; a 24h session is a supported primitive rather than something to hand-roll |
| Session | httpOnly cookie via `createSessionCookie` | Firebase enforces the 24h expiry itself — no custom timers, no cron |
| Route guard | `proxy.ts` (Node.js runtime) | Next 16 renamed `middleware.ts` → `proxy.ts` **and moved it to the Node runtime**, so the Firebase Admin SDK runs directly, with no edge-compat shim |
| Database | MongoDB Atlas M0 | Notes, users, and voice-note *metadata*. Never audio |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) | Accessible primitives, restyled against a real token system |
| Validation | Zod | Every route body, plus the `.vnote` manifest on import |
| API docs | `next-swagger-doc` + `swagger-ui-react` | Generated from `@swagger` blocks in the route files, so they can't drift from the code |
| Hosting | Vercel | Native Next.js, CI/CD from GitHub on push |

### How auth actually works

1. The browser signs in with Google via the Firebase **client** SDK and receives an ID token (browser-only, ~1h life).
2. It immediately `POST`s that token to `/api/auth/session`, which verifies it, **requires the sign-in to be less than 5 minutes old**, and exchanges it for a 24-hour httpOnly session cookie.
3. `proxy.ts` checks that cookie on every `/app/*` request and redirects to `/` when it's missing or expired.
4. Every API route *independently* calls `requireUser()`, which re-verifies the cookie **with revocation checking** and lazily upserts the user into Mongo.

Step 4 is not redundant with step 3. Next's own docs state that Proxy "should not be used as a full session management or authorization solution" — it runs ahead of the app and is the wrong place to make security decisions. So proxy is a **fast UX redirect** (it deliberately skips the revocation round-trip that would cost a network call on every navigation), and the **routes are the real authorization boundary**. Removing either would be a mistake.

The freshness check in step 2 matters: a Firebase ID token stays valid for an hour, so without it, a token lifted from a browser 50 minutes ago could still be upgraded into a fresh 24-hour session — turning a short leak into a long one.

### Design system

Not shadcn defaults (`ai_rules.md` §7 is explicit about this). Colour carries domain meaning rather than decoration:

- `brand` — the product; primary actions and focus rings
- `record` — used for **nothing but active recording**, so a red pulse on screen always means "audio is being captured right now"
- `canvas` / `document` — the two note types are colour-coded, so the dashboard reads at a glance without parsing a text label on every card

The type pairing is **Fraunces** for headings (a variable serif, with its `SOFT` and `WONK` axes dialled to 0 so it reads editorial rather than novelty), **Inter** for body, and **JetBrains Mono** for durations and transcript timestamps, where tabular figures matter.

---

## Running it locally

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.3, Node ≥ 20.19 (see [Gotchas](#gotchas-worth-knowing)), a Firebase project, and a MongoDB Atlas cluster.

```bash
bun install
cp .env.example .env.local     # then fill it in — see SETUP.md
bun run dev
```

Open <http://localhost:3000>. The `/app` dashboard renders a panel that live-checks sign-in, the session cookie, and the database connection, so a misconfiguration tells you *which* piece is broken instead of failing opaquely.

**[SETUP.md](./SETUP.md)** has the full click-by-click Firebase / Atlas / Vercel walkthrough, including the failure modes that actually bit during this build.

```bash
bun run build   # production build
bun run lint
```

---

## API documentation

Swagger UI at **[`/api-doc`](https://timbre-snj.vercel.app/api-doc)**.

Per `ai_rules.md` §2 rule 4, a route isn't "done" until it has all three of: a **Zod schema**, an **auth check**, and a **`@swagger` JSDoc block**. The OpenAPI spec is generated from those blocks in the route files themselves, so it cannot silently drift from the implementation.

---

## Build phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Auth, DB, landing page, app shell, Swagger, deploy | ✅ Complete |
| 1 | Notes CRUD + dashboard | ⏳ Next |
| 2 | Canvas editor (Excalidraw) | — |
| 3 | Document editor (Tiptap) | — |
| 4 | Voice notes + the 5-minute budget | — |
| 5 | `.vnote` export / import | — |
| 6 | Real-time collaboration | — |
| 7 | Tests, accessibility pass, submission | — |

---

## Gotchas worth knowing

Four things broke this build in ways that were **invisible locally and appeared only in production**. Written down because each cost real time.

**1. `jose` is pinned to v5 in `overrides` — do not remove it.**
Next.js keeps `firebase-admin` in its *default* `server-external-packages` list, so it's `require()`d raw from `node_modules` inside the lambda rather than bundled. Its transitive dependency `jwks-rsa` is CommonJS and calls `require('jose')` — but `jose` v6 is ESM-only. That `require()` is legal only on Node ≥ 20.19 / 22.12. Local Node has it; Vercel's default didn't, so **every server-rendered route 500'd** while dev stayed perfectly healthy. `jose` v5 ships a real CJS build, and `jwks-rsa` uses only two APIs from it (`importJWK`, `exportSPKI`), which are unchanged across both majors.

**2. Atlas must allow `0.0.0.0/0`.**
Vercel's serverless functions have no fixed egress IPs, so a specific-IP allowlist can never match. Atlas doesn't reject a non-allowlisted IP cleanly — it kills the TLS handshake, which surfaces as `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR` / `ReplicaSetNoPrimary` and sends you hunting for a TLS bug that doesn't exist. The database is still protected by its SCRAM credentials; the allowlist was never what stood between the internet and the data. *At production scale you'd move to M10+ with PrivateLink and drop the open CIDR.*

**3. URL-encode the Atlas password.** Special characters in it produce `MongoParseError: Password contains unescaped characters`, which reads like an auth failure and isn't.

**4. Firebase Authentication is a separate product from the Firebase project.** Creating a project and registering a web app yields working config values — and sign-in still fails with `auth/configuration-not-found` until you explicitly enable Authentication *and* the Google provider. Separately, every deployed domain must be added under **Authentication → Settings → Authorized domains**, or Google sign-in fails silently on the live site while working perfectly on `localhost`.

---

## What's deliberately not built

Per `ai_rules.md` §2 rule 6, cut scope gets written down rather than quietly skipped.

- **CRDT conflict resolution for canvas collaboration.** The plan is broadcast-and-apply with last-write-wins. The production answer is Yjs or Automerge; a half-finished CRDT would be worse than a documented simple one. *Document notes get real CRDT merging for free via Tiptap's Yjs extension, so the two note types will end up with genuinely different consistency guarantees — a conscious trade, not an oversight.*
- **Rate limiting.** Upstash + `@upstash/ratelimit` on write-heavy routes would be a few lines. Not yet applied.
- **Offline-first / PWA support**, and **field-level permissions.**

*This section grows as later phases make their own trade-offs.*

---

## Author

**Suman Jain** — [GitHub](https://github.com/Itz-snj) · [LinkedIn](https://www.linkedin.com/in/)
