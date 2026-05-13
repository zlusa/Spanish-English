/**
 * ICE servers for the OpenAI Realtime Translation sidecar `RTCPeerConnection`.
 * STUN alone often fails behind symmetric NAT / corporate firewalls — add TURN via env.
 */

const DEFAULT_STUN: RTCIceServer = {
  urls: "stun:stun.l.google.com:19302",
}

function parseJsonIceServers(raw: string | undefined): RTCIceServer[] {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return []
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    const out: RTCIceServer[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue
      }
      const o = item as Record<string, unknown>
      const urls = o.urls
      if (typeof urls === "string" || Array.isArray(urls)) {
        const entry: RTCIceServer = { urls: urls as string | string[] }
        if (typeof o.username === "string") {
          entry.username = o.username
        }
        if (typeof o.credential === "string") {
          entry.credential = o.credential
        }
        out.push(entry)
      }
    }
    return out
  } catch {
    return []
  }
}

function parseTurnEnv(): RTCIceServer[] {
  const urlsRaw = (import.meta.env.VITE_TURN_URLS as string | undefined)?.trim()
  if (!urlsRaw) {
    return []
  }
  const urls = urlsRaw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
  if (!urls.length) {
    return []
  }

  const username = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim()
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim()

  if (username !== undefined && credential !== undefined) {
    return [{ urls, username, credential }]
  }
  return [{ urls }]
}

/** Merged ICE config for translation WebRTC (STUN + optional TURN / custom servers). */
export function buildTranslationRtcConfiguration(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [DEFAULT_STUN]
  iceServers.push(...parseJsonIceServers(import.meta.env.VITE_WEBRTC_ICE_SERVERS))
  iceServers.push(...parseTurnEnv())
  return { iceServers }
}
