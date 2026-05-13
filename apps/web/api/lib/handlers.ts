import type { VercelRequest, VercelResponse } from "@vercel/node"
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
  RoomServiceClient,
} from "livekit-server-sdk"

import { joinCodeMatches, joinCodeRequired } from "./join-code.js"
import { getLiveKitEnv, normalizeLiveKitSegment } from "./livekit-env.js"
import {
  buildTranslationClientSecretRequest,
  normalizeTranslationLanguage,
} from "./openai-translation.js"
import { readJsonBody } from "./read-json-body.js"

type TokenResponse = {
  serverUrl: string
  roomName: string
  participantName: string
  participantToken: string
}

type ParticipantPresence = { identity: string; name: string }

type TranslationTokenRequest = {
  language?: string
  inputTranscriptionEnabled?: boolean
  noiseReductionEnabled?: boolean
  joinCode?: string
}

type ClientSecretResponse = {
  value?: string
  expires_at?: number
  client_secret?: { value?: string; expires_at?: number }
}

function getQuery(
  q: VercelRequest["query"],
  key: string
): string | null {
  const v = q[key]
  if (typeof v === "string") {
    return v
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0]
  }
  return null
}

function twirpNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }
  return (
    "code" in error &&
    String((error as { code: unknown }).code) === "not_found"
  )
}

export async function handleLiveKitToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const liveKitEnv = getLiveKitEnv()
    if (!liveKitEnv) {
      res
        .status(500)
        .send("Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL")
      return
    }

    const roomName = normalizeLiveKitSegment(getQuery(req.query, "roomName"))
    const participantName = normalizeLiveKitSegment(
      getQuery(req.query, "participantName")
    )

    if (!roomName) {
      res.status(400).send("Missing required query parameter: roomName")
      return
    }
    if (!participantName) {
      res.status(400).send("Missing required query parameter: participantName")
      return
    }

    const joinCode = getQuery(req.query, "joinCode") ?? ""
    if (joinCodeRequired() && !joinCodeMatches(joinCode)) {
      res.status(403).send("Invalid or missing team code (joinCode)")
      return
    }

    const participantToken = await createParticipantToken(
      {
        identity: `${slugify(participantName)}-${crypto.randomUUID().slice(0, 8)}`,
        name: participantName,
      },
      roomName,
      liveKitEnv
    )

    const body: TokenResponse = {
      serverUrl: liveKitEnv.serverUrl,
      roomName,
      participantName,
      participantToken,
    }
    res.status(200).json(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create LiveKit token"
    res.status(500).send(message)
  }
}

export async function handleLiveKitParticipants(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const liveKitEnv = getLiveKitEnv()
    if (!liveKitEnv) {
      res
        .status(500)
        .send("Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL")
      return
    }

    const roomName = normalizeLiveKitSegment(getQuery(req.query, "roomName"))
    if (!roomName) {
      res.status(400).send("Missing required query parameter: roomName")
      return
    }

    const joinCode = getQuery(req.query, "joinCode") ?? ""
    if (joinCodeRequired() && !joinCodeMatches(joinCode)) {
      res.status(403).send("Invalid or missing team code (joinCode)")
      return
    }

    const roomService = new RoomServiceClient(
      liveKitEnv.serverUrl,
      liveKitEnv.apiKey,
      liveKitEnv.apiSecret
    )

    const participants = await roomService.listParticipants(roomName)
    res.status(200).json({
      participants: participants.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
      })),
    } satisfies { participants: ParticipantPresence[] })
  } catch (error) {
    if (twirpNotFound(error)) {
      res.status(200).json({ participants: [] })
      return
    }
    const message =
      error instanceof Error ? error.message : "Unable to list participants"
    res.status(500).send(message)
  }
}

export async function handleTranslationToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      res.status(500).send("Missing OPENAI_API_KEY")
      return
    }

    const raw = readJsonBody(req)
    const payload = raw as TranslationTokenRequest

    if (joinCodeRequired() && !joinCodeMatches(payload.joinCode)) {
      res.status(403).send("Invalid or missing team code (joinCode)")
      return
    }

    let language: string
    try {
      language = normalizeTranslationLanguage(
        typeof payload.language === "string" ? payload.language : "es"
      )
    } catch (err) {
      res
        .status(400)
        .send(err instanceof Error ? err.message : "Unsupported translation language")
      return
    }

    const translationRequest = buildTranslationClientSecretRequest({
      apiKey,
      language,
      inputTranscriptionEnabled: !!payload.inputTranscriptionEnabled,
      noiseReductionEnabled: !!payload.noiseReductionEnabled,
      model: process.env.OPENAI_TRANSLATION_MODEL,
    })

    const response = await fetch(translationRequest.url, translationRequest.init)
    if (!response.ok) {
      res.status(response.status).send(await response.text())
      return
    }

    const data = (await response.json()) as ClientSecretResponse
    const clientSecret = data.value ?? data.client_secret?.value
    if (!clientSecret) {
      res
        .status(502)
        .send("Realtime translation client secret response was missing value")
      return
    }

    res.status(200).json({
      clientSecret,
      expiresAt: data.expires_at ?? data.client_secret?.expires_at ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "translation-token failed"
    res.status(500).send(message)
  }
}

async function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  liveKitEnv: NonNullable<ReturnType<typeof getLiveKitEnv>>
): Promise<string> {
  const accessToken = new AccessToken(
    liveKitEnv.apiKey,
    liveKitEnv.apiSecret,
    userInfo
  )
  accessToken.ttl = "30m"

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  }
  accessToken.addGrant(grant)
  return await accessToken.toJwt()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48)
}
