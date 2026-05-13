export type LiveKitEnv = {
  apiKey: string
  apiSecret: string
  serverUrl: string
}

export function getLiveKitEnv(): LiveKitEnv | null {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const serverUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !serverUrl) {
    return null
  }

  return { apiKey, apiSecret, serverUrl }
}

export function normalizeLiveKitSegment(value: string | null): string {
  return value?.trim().slice(0, 80) ?? ""
}
