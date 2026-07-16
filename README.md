# Timbre — the note that talks back

Timbre is a note-taking app where the **voice recording is the note**, not a caption bolted onto one. Notes come in two flavours — an Excalidraw-style **canvas** and an Obsidian-style **document** — recordings can be any length in any language, notes can be edited **live with other people**, and any note exports as a single portable **`.vnote`** file that carries its own audio inside it.

**Live app:** <https://timbre-snj.vercel.app> · **API docs (Swagger):** <https://timbre-snj.vercel.app/api-doc>

---

## What it does

- **Two editors, two metaphors.** A spatial **canvas** (Excalidraw) for sketching, and a linear **document** (Tiptap) for writing. The type is chosen when the note is created and fixed for its life.
- **Voice is the artifact.** Record directly into a note. On a canvas the recording drops as a draggable **pin** at a position on the board; in a document it embeds as an inline **block**. Recordings can be renamed and are playable in place.
- **A per-user voice budget.** Five minutes of total recording per account, enforced server-side with the duration parsed from the audio itself (never a client-reported number).
- **Real-time collaboration.** Presence avatars, live cursors on the canvas, and content that syncs across sessions in about a second.
- **Link sharing with roles.** Share a note as **editor** or **viewer**; access is enforced on the server, not just hidden in the UI.
- **Portable `.vnote` files.** Export a note — text/drawing *and* its audio — as one file, hand it to someone, and have them re-import it with nothing lost.

---

## Architecture

Timbre is a **Next.js 16 (App Router)** application: the UI and the REST API live in one TypeScript codebase, deployed on Vercel. A small **standalone Socket.io service** handles real-time messaging (Vercel's serverless functions can't hold WebSocket connections). Persistent data splits by kind: **MongoDB Atlas** stores JSON (users, notes, voice-note metadata), and **Vercel Blob** stores the audio bytes.

```
Browser ──HTTPS──▶ Next.js app (Vercel)  ──▶ MongoDB Atlas   (users, notes, voice metadata)
   │                                       └─▶ Vercel Blob    (private audio store)
   │
   └──WebSocket──▶ Socket.io relay (Render)  (live cursors, presence, content sync)
```

| Layer | Choice | Role |
|---|---|---|
| Framework | Next.js 16 (App Router), TypeScript | UI + REST API in one codebase |
| Auth | Firebase Authentication (Google) + Admin SDK | Sign-in and a 24-hour httpOnly session cookie |
| Route guard | `proxy.ts` (Node.js runtime) | Redirects signed-out users away from `/app/*` |
| Database | MongoDB Atlas | Users, notes, and voice-note **metadata** — never audio |
| Canvas editor | `@excalidraw/excalidraw` | The spatial note type |
| Document editor | Tiptap (ProseMirror) | The linear note type |
| Audio storage | Vercel Blob (**private** store) | Recording bytes; Mongo keeps only the pathname |
| Duration parsing | `music-metadata` | Reads audio length server-side for the budget |
| Real-time service | Socket.io on Render | Persistent WebSocket relay, one room per note |
| Bundling | `archiver` (export) + `adm-zip` (import) | Reads/writes the `.vnote` zip |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) | Accessible components on a custom token system |
| Validation | Zod | Every request body and the `.vnote` manifest |
| API docs | `next-swagger-doc` + `swagger-ui-react` | OpenAPI generated from the route files |
| Tests | Vitest (unit) + Playwright (e2e) | Pure-logic units + a cold-open browser flow |

### Authentication and sessions

1. The browser signs in with Google via the Firebase **client** SDK and gets an ID token.
2. It posts that token to `POST /api/auth/session`, which verifies it, requires the sign-in to be under five minutes old, and returns a **24-hour httpOnly session cookie**. Firebase enforces the expiry itself.
3. `proxy.ts` checks the cookie on every `/app/*` navigation and redirects to `/` when it's missing or expired.
4. Every API route **independently** re-verifies the session (with revocation checking) and lazily creates the user's Mongo record on first authenticated request.

Step 4 is intentional and not redundant with step 3: the proxy is a fast UX redirect, while the API routes are the real authorization boundary.

### Voice notes and audio

Audio never touches MongoDB and is never served from a public URL:

- Uploads go **through** the API (not direct-to-Blob) so the request is authenticated, size-checked, and budget-checked before anything is stored. The duration is re-parsed from the uploaded bytes with `music-metadata`.
- Blobs live in a **private** Vercel Blob store; Mongo keeps only the pathname. Playback streams through an authenticated proxy (`GET /api/voice/[id]/audio`) that re-checks the session and note access, so a leaked id can't expose someone else's recording.
- The **5-minute per-user budget** is applied with an atomic check-and-increment before upload, rolled back if the Blob write fails, and refunded on delete.

### Real-time collaboration (the Socket.io microservice)

`socket-server/` is a **standalone service** with its own `package.json`, deployed separately (to Render). It is a **pure relay** — one room per note id, no database. Each connected client still saves its own changes through the normal REST API; the relay only fans out cursor moves, presence, and content updates. Both note types sync with a broadcast-and-apply, last-write-wins model. If the app is run without pointing at a socket server (`NEXT_PUBLIC_SOCKET_URL` unset), everything works except live sync.

### The `.vnote` file format

A `.vnote` is a **zip** containing a `manifest.json` (validated with Zod on import) plus the note's audio under `audio/`:

```
my-note.vnote
├── manifest.json     # note type, title, canvas/document content, voice-note metadata
└── audio/
    ├── vn_1.webm
    └── vn_2.webm
```

Export pulls each recording from the private Blob store and writes it in. Import unzips, re-parses every audio duration server-side, reserves the whole import against the budget up front, re-uploads the audio, and remaps a document's inline voice-block references to the newly created recordings — rolling everything back together on any failure.

### Design system

Colour carries meaning, not decoration: a `brand` accent for primary actions, a `record` red used for **nothing but active recording**, and `canvas`/`document` colours so the two note types are legible at a glance on the dashboard. Type is **Fraunces** (headings), **Inter** (body), and **JetBrains Mono** (durations/timestamps, where tabular figures matter).

---

## Project structure

```
voicenote-canvas/
├── src/
│   ├── app/
│   │   ├── page.tsx            # public landing page
│   │   ├── app/                # authenticated app (dashboard + note editors)
│   │   ├── api/                # REST API route handlers
│   │   └── api-doc/            # Swagger UI
│   ├── components/notes/       # canvas + document editors, voice UI, sharing
│   ├── lib/                    # models, db, auth, access control, voice, .vnote
│   └── proxy.ts                # /app/* route guard
├── socket-server/              # standalone Socket.io relay (own package.json)
├── e2e/                        # Playwright tests
└── vitest.config.ts            # unit test config
```

---

## Running locally

**Prerequisites:** [Bun](https://bun.sh), a Firebase project (Google sign-in enabled), and a MongoDB Atlas cluster. **[SETUP.md](./SETUP.md)** has the full click-by-click walkthrough for Firebase, Atlas, Vercel Blob, and Render.

```bash
bun install
cp .env.example .env.local     # fill in Firebase, Mongo, and Blob values
bun run dev                    # http://localhost:3000
```

**Real-time service (optional).** Run the relay to enable live collaboration:

```bash
cd socket-server && bun install && bun start   # serves on :3001, health at /health
```

Then set `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001` in `.env.local`. Left unset, the app runs fully except live sync.

```bash
bun run build      # production build
bun run lint
```

---

## API endpoints

Interactive docs live at **[`/api-doc`](https://timbre-snj.vercel.app/api-doc)** (Swagger UI, generated from the route files). Every endpoint except `POST /api/auth/session` requires the session cookie from sign-in; requests without it get `401`. A note you don't own or can't access returns `404` (no existence leak), and a write to a note you can only view returns `403`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/session` | Exchange a Firebase ID token for a 24-hour session cookie |
| `DELETE` | `/api/auth/session` | Sign out (clear the cookie) |
| `GET` | `/api/notes` | List the signed-in user's notes |
| `POST` | `/api/notes` | Create a note (`canvas` or `document`) |
| `GET` | `/api/notes/{id}` | Fetch a note (owner or collaborator) |
| `PATCH` | `/api/notes/{id}` | Rename a note |
| `DELETE` | `/api/notes/{id}` | Delete a note (owner only; removes its audio + refunds the budget) |
| `PUT` | `/api/notes/{id}/canvas` | Save the canvas scene |
| `PUT` | `/api/notes/{id}/document` | Save the document content |
| `POST` | `/api/notes/{id}/share` | Enable/disable link sharing and set the role (owner only) |
| `GET` | `/api/notes/{id}/export` | Download the note as a `.vnote` file |
| `POST` | `/api/notes/import` | Create a note from an uploaded `.vnote` file |
| `GET` | `/api/notes/{id}/voice` | List a note's voice recordings |
| `POST` | `/api/notes/{id}/voice` | Upload and attach a recording |
| `GET` | `/api/voice/{id}/audio` | Stream a recording through the authenticated proxy |
| `PATCH` | `/api/voice/{id}` | Rename or reposition a recording |
| `DELETE` | `/api/voice/{id}` | Delete a recording (refunds the budget) |

---

## Testing

```bash
bun run test        # Vitest unit tests
bun run test:e2e    # Playwright e2e — first run: bunx playwright install chromium
```

- **Unit (Vitest).** Cover the pure, security-sensitive logic: the note **access-control filters and role checks** (read vs write; owner/editor/viewer), the **`.vnote` manifest schema, voice-id remapping, and filename slugifier**, and the **voice helpers** (display-name fallback, audio MIME allowlist and extension mapping).
- **E2E (Playwright).** Exercises the new-visitor flow end to end — the landing page renders with a Google sign-in CTA, and visiting `/app` with no session redirects to the landing page. It runs against `PLAYWRIGHT_BASE_URL` (default: the live deployment), so it needs no local secrets; set that variable to point at a local server instead.

---

## Limitations and trade-offs

- **Concurrent edits use last-write-wins, not a CRDT.** Real-time sync broadcasts and applies changes; the most recent write wins for both note types. A CRDT (Yjs/Automerge) is the production answer for merging simultaneous edits to the same region and is the natural next step.
- **Transcription is not wired up.** The data model carries `transcript`/`language` fields, but the (optional, user-triggered) speech-to-text action is not built. Adding it needs no schema change.
- **Pasted-image binaries on a canvas aren't persisted.** Shapes, text, and freehand survive a refresh; an embedded image's bytes would belong in Blob storage alongside the audio, not in the database.
- **The document editor ships a core toolset.** Headings, formatting, lists, quotes, and code blocks are in; tables, task lists, image embeds, and a slash menu are not — each is a drop-in editor extension that stores into the same content JSON with no migration.
- **No rate limiting, offline/PWA support, or field-level permissions** yet.

---

## Author

**Suman Jain** — [GitHub](https://github.com/Itz-snj) · [LinkedIn](https://www.linkedin.com/in/suman-naresh-jain)
