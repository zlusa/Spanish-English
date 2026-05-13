# v1 voice translation stack: OpenAI Realtime Translation + LiveKit

## Decision

We use **[OpenAI `gpt-realtime-translate`](https://developers.openai.com/api/docs/guides/realtime-translation)** for browser-side **speech-to-speech translation** (WebRTC to `https://api.openai.com/v1/realtime/translations`), following the official **[LiveKit translation demo](https://github.com/openai/openai-cookbook/tree/main/examples/voice_solutions/realtime_translation_guide/livekit-translation-demo)** pattern:

- **LiveKit** carries room audio/video (SFU).
- Each client opens a **translation sidecar** `RTCPeerConnection` per remote speaker track, sends that track to OpenAI, and plays translated audio locally (not republished to the room).

This matches the cookbook’s **per-listener, per-remote-speaker** model and scales down to the same-room training use case (English trainer, Spanish trainees).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Server-side only; used to mint short-lived translation client secrets |
| `OPENAI_TRANSLATION_MODEL` | Optional; defaults to `gpt-realtime-translate` |
| `LIVEKIT_API_KEY` | LiveKit project API key |
| `LIVEKIT_API_SECRET` | LiveKit project secret |
| `LIVEKIT_URL` | WebSocket URL, e.g. `wss://your-project.livekit.cloud` |

## Pricing and latency (indicative)

- **Billing:** OpenAI Realtime Translation is usage-based (see current [OpenAI pricing](https://openai.com/pricing)); LiveKit bills separately for minutes/participants.
- **Latency:** Expect roughly **sub-second to ~2 s** perceived delay depending on network, model load, and how much buffering the browser uses. Same-room trainees should use **5 GHz Wi‑Fi or wired** where possible (see `docs/TRAINING_ROOM_OPS.md`).

## Why not Azure in this repo

Azure Speech remains a valid alternative for server-mixed pipelines. This repository standardizes on OpenAI Realtime Translation for fastest alignment with the maintained cookbook demo and lower custom media-worker code.
