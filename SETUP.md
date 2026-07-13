# Phase 0 — console setup

The code is written and builds. These are the steps that need a human at a
console. Work through them in order; the whole thing is ~20 minutes.

When you're done, every value in `.env.local` is filled in **and** mirrored in the
Vercel dashboard (ai_rules.md §4, Phase 0).

---

## 1. Firebase — Auth (~7 min)

1. <https://console.firebase.google.com> → **Add project**. Name it whatever you
   like (e.g. `timbre`). Google Analytics is not needed — turn it off.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
   Set a support email. Save.
3. **Authentication → Settings → Authorized domains.** `localhost` is there by
   default. After the first Vercel deploy, come back and **add your
   `*.vercel.app` domain** — Google sign-in silently fails on unauthorized
   domains, and this is the single most common reason a deployed Firebase app
   won't log in.
4. **Project settings (gear) → General → Your apps → Web (`</>`)**. Register the
   app. Copy the config values into `.env.local`:

   | Firebase config key | `.env.local` var |
   |---|---|
   | `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
   | `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
   | `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

5. **Project settings → Service accounts → Generate new private key.** This
   downloads a JSON file. **It is a secret — never commit it.** From that JSON:

   | JSON field | `.env.local` var |
   |---|---|
   | `project_id` | `FIREBASE_PROJECT_ID` |
   | `client_email` | `FIREBASE_CLIENT_EMAIL` |
   | `private_key` | `FIREBASE_PRIVATE_KEY` |

   Keep `FIREBASE_PRIVATE_KEY` wrapped in double quotes with its `\n` escapes
   exactly as they appear in the JSON. The app converts them to real newlines at
   runtime (`src/lib/firebase/admin.ts`).

> Do **not** enable Firebase Cloud Storage — it needs the paid Blaze plan now.
> Audio goes to Vercel Blob in Phase 4 (ai_rules.md §5).

---

## 2. MongoDB Atlas — M0 (~7 min)

1. <https://cloud.mongodb.com> → create a **free M0** cluster (any region near you).
2. **Database Access → Add New Database User.** Username + password. Use a
   generated password and copy it now.
3. **Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).**
   Vercel's serverless functions have no fixed egress IPs, so an IP allowlist
   can't work here. Access is protected by the connection credentials instead.
4. **Clusters → Connect → Drivers → Node.js.** Copy the connection string into
   `MONGODB_URI`.
   - Replace `<password>` with the real password.
   - **URL-encode any special characters** in it (`@` → `%40`, `#` → `%23`, and
     so on) or the URI will fail to parse in a way that looks like an auth error.
5. Leave `MONGODB_DB="timbre"` as-is.

---

## 3. Verify locally (~2 min)

```bash
cd voicenote-canvas
bun run dev
```

Open <http://localhost:3000>:

- The landing page renders.
- **Continue with Google** signs you in and lands you on `/app`.
- The `/app` panel shows three green checks — sign-in, session cookie, and
  **MongoDB Atlas: connected**. If Mongo is red, the error text is printed right
  there.
- <http://localhost:3000/api-doc> lists `POST` and `DELETE /api/auth/session`.

---

## 4. GitHub + Vercel (~5 min)

1. Push the repo to GitHub (I can do this for you — just say so).
2. <https://vercel.com/new> → import the repo.
3. **Set the Root Directory to `voicenote-canvas`.** The repo root holds the spec
   docs, not the app — Vercel will not find `package.json` otherwise.
4. Add **every** var from `.env.local` under **Environment Variables**, for all
   three environments (Production / Preview / Development).
   - For `FIREBASE_PRIVATE_KEY`, paste the value *with* its `\n` escapes.
5. Deploy.
6. Go back to **Firebase → Authentication → Settings → Authorized domains** and
   add the `*.vercel.app` domain Vercel just gave you. (Step 1.3 above.)

---

## Phase 0 exit criterion

> A stranger can open the live Vercel URL, see the landing page, sign in with
> Google, land on an empty `/app` dashboard, and load `/api-doc`. Coming back
> after 24 hours requires signing in again.

Once the live URL does all of that, Phase 0 is done and Phase 1 can start.
