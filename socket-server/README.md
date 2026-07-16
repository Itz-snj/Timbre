# Timbre socket server

A standalone [Socket.io](https://socket.io) relay for Timbre's live
collaboration. It exists because Vercel's serverless functions can't hold
long-lived WebSocket connections — this small always-on process can.

It is a **pure relay**: it fans out `content-update` and `cursor-move` events to
everyone in a note's room and tracks presence. It never touches the database —
persistence stays in the Next app (each client autosaves its own changes).

## Run locally

```bash
cd socket-server
npm install
npm start          # listens on :3001
```

Then point the Next app at it — in `voicenote-canvas/.env.local`:

```
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

Restart `next dev`, open the same note in two browser tabs, and edits in one
appear in the other within ~1s.

## Deploy to Render

1. **New → Web Service**, connect this GitHub repo.
2. **Root Directory:** `voicenote-canvas/socket-server`
3. **Build Command:** `npm install` · **Start Command:** `npm start`
4. **Health Check Path:** `/health`
5. Environment variables:
   - `ALLOWED_ORIGIN` = your Vercel origin(s), comma-separated
     (e.g. `https://timbre-snj.vercel.app,http://localhost:3000`)
6. After it deploys, set `NEXT_PUBLIC_SOCKET_URL` to the Render URL
   (e.g. `https://timbre-socket.onrender.com`) in the **Vercel** project's env,
   and redeploy the Next app.

**Free-tier note:** Render spins the service down after ~15 min idle and takes
~30–60s to cold-start on the next request — so the first collaborator after a
quiet spell waits for it to wake. Hit `/health` a minute before a live demo to
warm it up.

If `NEXT_PUBLIC_SOCKET_URL` is unset, the app simply runs without live
collaboration — everything else works unchanged.
