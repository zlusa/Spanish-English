# Training room operations

## Headphones (required for same-room use)

- **Everyone** should use **headphones** (or earbuds). Open speakers cause **echo** and **mic bleed** into other participants’ streams, which degrades both LiveKit clarity and OpenAI translation.
- The **trainer** benefits from a **closed-back headset** with a **boom mic** in loud rooms.

## Phones and HTTPS (dev on your LAN)

Browsers treat **`http://192.168.x.x`** as **not secure** (unlike `http://localhost`). Then **`navigator.mediaDevices` is undefined**, and mic access throws (e.g. “undefined is not an object … getUserMedia”).

The Vite dev server uses **HTTPS with a self-signed certificate** so phones get a secure context. Open the **`https://…`** URL printed in the terminal and accept the certificate warning once.

## Wi‑Fi and latency

- Prefer **5 GHz** Wi‑Fi or **wired Ethernet** for the trainer’s laptop.
- If translation stutters, reduce the number of simultaneous talkers, disable **camera** to save bandwidth, or lower the number of active translation sidecars (see concurrency cap in the app).

## OpenAI translation (“WebRTC failed” / ICE errors)

The translation sidecar opens a **second** browser `RTCPeerConnection` to **OpenAI** (`api.openai.com`), separate from LiveKit. If you see **Translation WebRTC failed** or an error mentioning **ICE**:

- Try **without VPN** and avoid **guest Wi‑Fi** that blocks WebRTC or UDP.
- **Corporate networks** often block browser WebRTC to external hosts; try a home network or phone hotspot to confirm.
- The app uses a **cloned** copy of the remote LiveKit mic for OpenAI so it does not fight LiveKit’s own audio path.

## Push-to-talk (PTT)

- Optional for **trainer or trainee** before joining: enable **Push-to-talk**, then the mic stays **off** until you transmit.
- **Desktop:** hold **Space** (ignored when typing in a field).
- **Phone / tablet:** use the **Hold to speak** button (there is no Space key in the mobile browser for this).
- Release to mute. Helps in noisy rooms.

## Optional source transcription & noise reduction

- **Source-language transcription** sends input audio through the translation stack’s transcription path (see OpenAI Realtime Translation docs). Disable if you need minimal processing.
- **Near-field noise reduction** helps laptop mics; disable if audio sounds “thin” or clipped.

## Secrets

- Never put **`OPENAI_API_KEY`** or **`LIVEKIT_API_SECRET`** in the web bundle. They belong only in **`apps/realtime`** environment (or your deployment secret store).

## Locking the room

- Room access control is not enforced in this MVP (anyone with the room code and your LiveKit project can request a token). For production, add **host approval**, **PIN**, or **SSO** in the token service before minting JWTs.
