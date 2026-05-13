# `apps/realtime` — API server

This folder lives next to `apps/web` under the **repo root**:

```text
Spanish-English/          ← open this folder in Cursor / VS Code
  apps/
    realtime/             ← you are here (Express: LiveKit JWT + OpenAI client_secret)
    web/                  ← Vite React UI
  package.json
  .env                    ← optional: put LIVEKIT_* and OPENAI_API_KEY here
```

## Run

From the **repo root**:

```bash
cd apps/realtime
pnpm install
pnpm dev
```

The server listens on **http://127.0.0.1:8787** by default (`PORT` in `.env`).

It loads environment variables from:

1. `.env` at the **repository root** (e.g. `c:\Dev\Spanish-English\.env`)
2. then `apps/realtime/.env` (overrides the same keys)

So a single `.env` next to `package.json` is enough.

## Endpoints

| Method | Path | Purpose |
|--------|------|--------|
| `GET` | `/api/livekit/token` | LiveKit access token |
| `GET` | `/api/livekit/participants` | Who is in a room |
| `POST` | `/api/realtime/translation-token` | Short-lived OpenAI translation secret |
| `GET` | `/` | Short HTML page (browser hint: use `apps/web` on port 5173) |
| `GET` | `/health` | Liveness |

The web app (`apps/web`) proxies `/api` to this server in dev (see `apps/web/vite.config.ts`).
