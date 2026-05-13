# `workers/translation`

This repository implements translation **in the browser** using **OpenAI Realtime Translation** WebRTC sidecars (see [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and the [OpenAI cookbook LiveKit demo](https://github.com/openai/openai-cookbook/tree/main/examples/voice_solutions/realtime_translation_guide/livekit-translation-demo)).

There is **no separate Python/media worker** in this repo: a server-side LiveKit egress worker would translate once per language and republish tracks, which is optional future work for very large rooms.
