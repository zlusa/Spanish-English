import path from "node:path"
import { fileURLToPath } from "node:url"

import { config as loadEnv } from "dotenv"
import cors from "cors"
import express from "express"
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
  RoomServiceClient,
  TwirpError,
} from "livekit-server-sdk"

import { joinCodeMatches, joinCodeRequired } from "./join-code.js"
import { getLiveKitEnv, normalizeLiveKitSegment } from "./livekit-env.js"
import {
  buildTranslationClientSecretRequest,
  normalizeTranslationLanguage,
} from "./openai-translation.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Repo root `.env` (e.g. c:\Dev\Spanish-English\.env), then `apps/realtime/.env` overrides.
loadEnv({ path: path.resolve(__dirname, "../../../.env") })
loadEnv({ path: path.resolve(__dirname, "../.env"), override: true })

const app = express()
const PORT = Number(process.env.PORT) || 8787

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  })
)
app.use(express.json())

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>@training/realtime</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; }
    h1 { font-size: 1.25rem; }
    ul { padding-left: 1.25rem; }
  </style>
</head>
<body>
  <h1>Training room — API server</h1>
  <p>This is the <strong>backend</strong> for LiveKit tokens and OpenAI translation secrets. There is no full UI here.</p>
  <p>Open the web app instead (after <code>pnpm dev</code> in <code>apps/web</code>), usually <a href="http://localhost:5173/">http://localhost:5173/</a>.</p>
  <h2>Endpoints</h2>
  <ul>
    <li><code>GET /health</code> — liveness</li>
    <li><code>GET /api/livekit/token?roomName=&amp;participantName=</code> — LiveKit JWT</li>
    <li><code>GET /api/livekit/participants?roomName=</code> — room roster</li>
    <li><code>POST /api/realtime/translation-token</code> — OpenAI <code>client_secret</code> (JSON body)</li>
  </ul>
</body>
</html>`)
})

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end()
})

type TokenResponse = {
  serverUrl: string
  roomName: string
  participantName: string
  participantToken: string
}

app.get("/api/livekit/token", async (req, res) => {
  try {
    const liveKitEnv = getLiveKitEnv()
    if (!liveKitEnv) {
      res
        .status(500)
        .send("Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL")
      return
    }

    const roomName = normalizeLiveKitSegment(
      typeof req.query.roomName === "string" ? req.query.roomName : null
    )
    const participantName = normalizeLiveKitSegment(
      typeof req.query.participantName === "string"
        ? req.query.participantName
        : null
    )

    if (!roomName) {
      res.status(400).send("Missing required query parameter: roomName")
      return
    }
    if (!participantName) {
      res.status(400).send("Missing required query parameter: participantName")
      return
    }

    const joinCode =
      typeof req.query.joinCode === "string" ? req.query.joinCode : ""
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
    res.json(body)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create LiveKit token"
    res.status(500).send(message)
  }
})

type ParticipantPresence = { identity: string; name: string }

app.get("/api/livekit/participants", async (req, res) => {
  const liveKitEnv = getLiveKitEnv()
  if (!liveKitEnv) {
    res
      .status(500)
      .send("Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL")
    return
  }

  const roomName = normalizeLiveKitSegment(
    typeof req.query.roomName === "string" ? req.query.roomName : null
  )
  if (!roomName) {
    res.status(400).send("Missing required query parameter: roomName")
    return
  }

  const joinCode =
    typeof req.query.joinCode === "string" ? req.query.joinCode : ""
  if (joinCodeRequired() && !joinCodeMatches(joinCode)) {
    res.status(403).send("Invalid or missing team code (joinCode)")
    return
  }

  const roomService = new RoomServiceClient(
    liveKitEnv.serverUrl,
    liveKitEnv.apiKey,
    liveKitEnv.apiSecret
  )

  try {
    const participants = await roomService.listParticipants(roomName)
    res.json({
      participants: participants.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
      })),
    } satisfies { participants: ParticipantPresence[] })
  } catch (error) {
    if (error instanceof TwirpError && error.code === "not_found") {
      res.json({ participants: [] })
      return
    }
    const message =
      error instanceof Error ? error.message : "Unable to list participants"
    res.status(500).send(message)
  }
})

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

app.post("/api/realtime/translation-token", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).send("Missing OPENAI_API_KEY")
    return
  }

  let payload: TranslationTokenRequest
  try {
    payload = req.body as TranslationTokenRequest
  } catch {
    res.status(400).send("Invalid JSON body")
    return
  }

  if (joinCodeRequired() && !joinCodeMatches(payload.joinCode)) {
    res.status(403).send("Invalid or missing team code (joinCode)")
    return
  }

  let language: string
  try {
    language = normalizeTranslationLanguage(payload.language || "es")
  } catch (error) {
    res
      .status(400)
      .send(
        error instanceof Error ? error.message : "Unsupported translation language"
      )
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

  res.json({
    clientSecret,
    expiresAt: data.expires_at ?? data.client_secret?.expires_at ?? null,
  })
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

app.use((req, res) => {
  const hint =
    req.method === "GET" && req.path !== "/"
      ? ` Try <a href="/">GET /</a> for a list of routes.`
      : ""
  res
    .status(404)
    .type("html")
    .send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body>` +
        `<p><strong>404</strong> ${escapeHtml(req.method + " " + req.originalUrl)}</p>` +
        `<p>This is the <code>@training/realtime</code> API (port ${PORT}).${hint}</p>` +
        `<p>UI: run <code>pnpm dev</code> in <code>apps/web</code> → <a href="http://localhost:5173/">http://localhost:5173/</a></p>` +
        `</body></html>`
    )
})

app.listen(PORT, () => {
  console.info(`[realtime] listening on http://localhost:${PORT}`)
})

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
