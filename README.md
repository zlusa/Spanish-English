# Spanish–English same-room training (LiveKit + OpenAI)

Two-way interpretation for a **trainer speaking English** and **trainees speaking Spanish**, using:

- **[LiveKit](https://livekit.io/)** for room audio (SFU).
- **[OpenAI `gpt-realtime-translate`](https://developers.openai.com/api/docs/guides/realtime-translation)** for per-remote-speech translation sidecars in each browser, following the [LiveKit translation cookbook demo](https://github.com/openai/openai-cookbook/tree/main/examples/voice_solutions/realtime_translation_guide/livekit-translation-demo).

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+
- LiveKit project (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
- OpenAI API key with access to Realtime Translation

## Setup

Create a `.env` at the **repo root** (next to `package.json`, e.g. `c:\Dev\Spanish-English\.env`) **or** in `apps\realtime\.env`. Copy from [`.env.example`](.env.example).

**Finding `apps/realtime`:** In Explorer or the IDE sidebar, open the **`apps`** folder under this repo, then **`realtime`**. See also [`apps/realtime/README.md`](apps/realtime/README.md).

## Run (local)

From the **repository root** (`Spanish-English`), one command starts **both** the API and the web app:

```bash
pnpm install
pnpm dev
```

- **Web UI:** Vite prints **Local** and **Network** URLs using **HTTPS** (self-signed cert), e.g. `https://192.168.x.x:5173/`. Phones **must** use that `https://` link so the browser exposes `navigator.mediaDevices` for the microphone. The first time, accept the certificate warning (“Advanced” → proceed).
- **API:** [http://localhost:8787/](http://localhost:8787/) on the same machine — try [http://localhost:8787/health](http://localhost:8787/health) for `{"ok":true}` (HTTP is fine here; only the browser UI needs HTTPS on LAN).

`pnpm start` is the same as `pnpm dev` (one command).

Logs from `apps/web` and `apps/realtime` are interleaved. Stop everything with **Ctrl+C** once.

If the API exits with **`EADDRINUSE` … port 8787**, something else is already using that port (often another `pnpm dev` you forgot to close). Stop that process or set a different `PORT` in `.env`.

### Run in two terminals instead (optional)

Terminal 1 — API:

```bash
cd apps/realtime
pnpm install
pnpm dev
```

Terminal 2 — web (proxies `/api` to port 8787):

```bash
cd apps/web
pnpm install
pnpm dev
```

From the repo root you can also run `pnpm dev:realtime` or `pnpm dev:web` individually.

Open the Vite URL. Use the **same room code** on trainer and trainee devices. **Use headphones.**

## Connect from another computer (same Wi‑Fi / LAN)

With **`pnpm dev`** from the repo root, Vite is already configured with **`host: true`**, so it listens on your LAN.

1. On the **host** PC, run `pnpm dev` and look at the terminal for the **Network** line (e.g. `https://192.168.1.23:5173/`).

2. **On each other device** (same Wi‑Fi), open that **Network** URL — not `localhost` on their device (that would point to their own machine). On **phones**, use **`https://`** (required for the mic); proceed past the self-signed certificate warning the first time.

3. **Windows Firewall:** allow Node / private networks when prompted, or allow inbound **TCP 5173** on the host.

**Why this works:** Other browsers load the UI from your IP; `/api` is proxied on the host to the API. **LiveKit** is in the cloud (`LIVEKIT_URL`), so room audio/video does not require peers to reach your machine’s SFU.

**Phones on the same Wi‑Fi:** use the same **Network** URL (`https://…`). Plain `http://` on a LAN IP does not provide a secure context, so `navigator.mediaDevices` stays undefined and you get errors like “undefined is not an object (evaluating 'navigator.mediaDevices.getUserMedia')”.

**Someone far away (different network):** deploy the web build and API, or use a tunnel (e.g. [ngrok](https://ngrok.com/)), and set `VITE_REALTIME_URL` plus `CORS_ORIGIN` as below.

### Optional: separate API host

If the realtime API is not on the Vite origin, build or run web with:

```bash
set VITE_REALTIME_URL=https://your-api.example.com
pnpm dev
```

Ensure `apps/realtime` enables `CORS_ORIGIN` for your web origin.

## Docs

- [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) — deploy the web app + API to Vercel (free tier) and optional **team code**
- [`docs/VENDOR.md`](docs/VENDOR.md) — OpenAI + LiveKit vendor choice
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — SFU and token flow
- [`docs/TRAINING_ROOM_OPS.md`](docs/TRAINING_ROOM_OPS.md) — headphones, Wi‑Fi, PTT

## Monorepo layout

| Path | Role |
|------|------|
| [`apps/realtime`](apps/realtime) | Express: LiveKit JWT, OpenAI translation `client_secret` |
| [`apps/web`](apps/web) | Vite + React training UI |
| [`workers/README.md`](workers/README.md) | Why there is no separate translation worker |
