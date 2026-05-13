# Deploy to Vercel (free tier for testing)

The browser app is a **Vite static build**. API routes for LiveKit tokens and OpenAI translation secrets live as **Vercel Serverless Functions** under [`apps/web/api/`](../apps/web/api/) (same paths as local dev: `/api/...`).

## 1. Push the repo to GitHub

Vercel imports from Git (GitHub, GitLab, or Bitbucket).

## 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New… → Project** → import your repository.
3. **Root Directory:** set to **`apps/web`** (important — not the monorepo root).
4. **Framework Preset:** Vite (auto-detected).
5. **Build Command:** `pnpm run build` (default).
6. **Output Directory:** `dist` (default).
7. **Install Command:** leave default or use `pnpm install` (Vercel enables pnpm when it sees `packageManager` in `package.json`).

[`apps/web/vercel.json`](../apps/web/vercel.json) configures SPA fallback so client-side routes reload correctly.

## 3. Environment variables

In the project **Settings → Environment Variables**, add:

| Name | Required | Notes |
|------|------------|--------|
| `LIVEKIT_API_KEY` | Yes | From LiveKit Cloud |
| `LIVEKIT_API_SECRET` | Yes | |
| `LIVEKIT_URL` | Yes | e.g. `wss://….livekit.cloud` |
| `OPENAI_API_KEY` | Yes | For translation `client_secret` |
| `OPENAI_TRANSLATION_MODEL` | No | Defaults to `gpt-realtime-translate` |
| `TRAINING_JOIN_CODE` | No | If set, everyone must enter this **team code** in the join form (same value for trainer and trainees) |

Redeploy after changing env vars.

## 4. Team code behavior

- If **`TRAINING_JOIN_CODE` is unset** (empty on Vercel): anyone with the link can join; the **Team code** field in the UI is optional.
- If **`TRAINING_JOIN_CODE` is set** (e.g. `spring2026`): every client must type that exact string in **Team code** before joining. Requests without a matching code get **403**.

The same check runs on **local** [`apps/realtime`](../apps/realtime) if you set `TRAINING_JOIN_CODE` in `.env`.

## 5. Deploy and test

Deploy, then open your **`https://….vercel.app`** URL on a laptop and phone. Production is already **HTTPS**, so **microphones work on phones** without certificate tricks.

## Other free hosts (short notes)

- **Cloudflare Pages** + **Workers** for `/api/*`: possible, but you must port the handlers from `apps/web/server/handlers.ts` to the Worker format.
- **Netlify** + **Netlify Functions**: same idea as Vercel; folder layout differs (`netlify/functions/…`).
- **Render / Railway / Fly.io**: run the existing **Express** app in [`apps/realtime`](../apps/realtime) and set **`VITE_REALTIME_URL`** on a static web build to that API’s public `https://` origin (and enable CORS with `CORS_ORIGIN`).

For the smallest path to a public HTTPS test URL, **Vercel + `apps/web` root** is the one this repo wires up out of the box.
