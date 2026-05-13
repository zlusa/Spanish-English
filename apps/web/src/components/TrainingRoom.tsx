import * as React from "react"
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
} from "livekit-client"

import { useRemoteTranslation } from "@/hooks/useRemoteTranslation"
import { getParticipantAudioMediaStreamTrack } from "@/lib/livekit-audio"

export type Role = "trainer" | "trainee"

const MAX_CONCURRENT_TRANSLATIONS = 6

type ConnectionDetails = {
  serverUrl: string
  roomName: string
  participantName: string
  participantToken: string
}

type JoinState = "setup" | "connecting" | "connected"

function tokenUrl(
  roomName: string,
  participantName: string,
  joinCode: string
): string {
  const u = new URL("/api/livekit/token", window.location.origin)
  u.searchParams.set("roomName", roomName)
  u.searchParams.set("participantName", participantName)
  if (joinCode.trim()) {
    u.searchParams.set("joinCode", joinCode.trim())
  }
  return u.toString()
}

function outputLanguageForRole(role: Role): "en" | "es" {
  return role === "trainer" ? "en" : "es"
}

function typingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) {
    return false
  }
  const tag = el.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  )
}

type RemoteTileProps = {
  participant: Participant
  outputLanguage: string
  translationActive: boolean
  translatedVolume: number
  sourceTranscription: boolean
  noiseReduction: boolean
  overConcurrencyCap: boolean
  joinCode: string
}

function RemoteSpeakerTile({
  participant,
  outputLanguage,
  translationActive,
  translatedVolume,
  sourceTranscription,
  noiseReduction,
  overConcurrencyCap,
  joinCode,
}: RemoteTileProps) {
  // Do not memoize on `participant` only — the same object gains `audioTrack` after
  // subscribe; memo would cache `null` and translation would never start.
  const sourceTrack = getParticipantAudioMediaStreamTrack(participant)

  const translation = useRemoteTranslation({
    enabled: translationActive && Boolean(sourceTrack),
    sourceTrack,
    language: outputLanguage,
    sourceTranscriptionEnabled: sourceTranscription,
    noiseReductionEnabled: noiseReduction,
    translatedVolume,
    joinCode,
  })

  const label = participant.name || participant.identity

  return (
    <div className="card tile">
      <h3>{label}</h3>
      {overConcurrencyCap ? (
        <p className="muted">
          Translation paused for this speaker (concurrency cap{" "}
          {MAX_CONCURRENT_TRANSLATIONS}). Others must leave or disable
          translation globally to free a slot.
        </p>
      ) : null}
      <p className="muted">
        Mic track: {sourceTrack ? "received (subscribed)" : "waiting…"}
        {" · "}
        Sidecar: {translation.status}
        {translation.error ? (
          <span className="error"> — {translation.error}</span>
        ) : null}
      </p>
      <div className="stack" style={{ marginTop: "0.5rem" }}>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Source (original room audio + transcript)
          </div>
          <div className="caption-box">
            {translation.sourceSubtitle || "…"}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Translated ({outputLanguage.toUpperCase()})
          </div>
          <div className="caption-box">
            {translation.translatedSubtitle || "…"}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TrainingRoom() {
  const [role, setRole] = React.useState<Role>("trainee")
  const [roomName, setRoomName] = React.useState("training-room")
  const [displayName, setDisplayName] = React.useState("")
  const [cameraOn, setCameraOn] = React.useState(false)
  const [micOn, setMicOn] = React.useState(true)
  const [pttMode, setPttMode] = React.useState(false)
  const [pttDown, setPttDown] = React.useState(false)
  const [joinState, setJoinState] = React.useState<JoinState>("setup")
  const [room, setRoom] = React.useState<Room | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [, bump] = React.useState(0)
  const [translationEnabled, setTranslationEnabled] = React.useState(true)
  const [translatedVolume, setTranslatedVolume] = React.useState(0.92)
  const [sourceTranscription, setSourceTranscription] = React.useState(true)
  const [noiseReduction, setNoiseReduction] = React.useState(true)
  const [activeRoomLabel, setActiveRoomLabel] = React.useState("")
  const [joinCode, setJoinCode] = React.useState("")

  const outputLanguage = outputLanguageForRole(role)

  const refresh = React.useCallback(() => {
    bump((n) => n + 1)
  }, [])

  React.useEffect(() => {
    const r = room
    if (!r || !pttMode) {
      return
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) {
        return
      }
      if (typingTarget(e.target)) {
        return
      }
      e.preventDefault()
      setPttDown(true)
      void r!.localParticipant.setMicrophoneEnabled(true)
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") {
        return
      }
      if (typingTarget(e.target)) {
        return
      }
      e.preventDefault()
      setPttDown(false)
      void r!.localParticipant.setMicrophoneEnabled(false)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [room, pttMode])

  React.useEffect(() => {
    if (!room || !pttMode) {
      return
    }
    void room.localParticipant.setMicrophoneEnabled(false)
  }, [room, pttMode])

  React.useEffect(() => {
    if (!room || pttMode) {
      return
    }
    void room.localParticipant.setMicrophoneEnabled(micOn)
  }, [room, micOn, pttMode])

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const name =
      displayName.trim() ||
      (role === "trainer" ? "Trainer" : "Trainee")
    const rname = roomName.trim() || "training-room"
    setJoinState("connecting")
    setError(null)

    try {
      const res = await fetch(tokenUrl(rname, `${name} (${role})`, joinCode))
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const details = (await res.json()) as ConnectionDetails

      const nextRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      nextRoom
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackPublished, refresh)
        .on(RoomEvent.TrackSubscribed, refresh)
        .on(RoomEvent.TrackUnsubscribed, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.Disconnected, refresh)

      setRoom(nextRoom)
      await nextRoom.connect(details.serverUrl, details.participantToken, {
        autoSubscribe: true,
      })

      const startMic = pttMode ? false : micOn
      await nextRoom.localParticipant.setMicrophoneEnabled(startMic)
      await nextRoom.localParticipant.setCameraEnabled(cameraOn)

      setActiveRoomLabel(details.roomName)
      setJoinState("connected")
      refresh()
    } catch (err) {
      setRoom((prev) => {
        prev?.disconnect()
        return null
      })
      setError(err instanceof Error ? err.message : "Join failed")
      setJoinState("setup")
    }
  }

  async function leave() {
    room?.disconnect()
    setRoom(null)
    setActiveRoomLabel("")
    setJoinState("setup")
  }

  const remoteParticipants = room
    ? Array.from(room.remoteParticipants.values())
    : []

  const overflow = Math.max(
    0,
    remoteParticipants.length - MAX_CONCURRENT_TRANSLATIONS
  )

  return (
    <div className="stack">
      <header>
        <h1>Same-room training — LiveKit + OpenAI Realtime Translation</h1>
        <p className="muted">
          Pattern from the OpenAI cookbook LiveKit demo: each device runs a
          translation sidecar per remote speaker. Use{" "}
          <strong>headphones</strong> to avoid echo.
        </p>
      </header>

      {joinState === "setup" ? (
        <form className="card stack" onSubmit={join}>
          <div className="row">
            <span className="badge">OpenAI gpt-realtime-translate</span>
            <span className="badge">LiveKit SFU</span>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <label className="field">
            Role
            <select
              className="select"
              value={role}
              onChange={(ev) => setRole(ev.target.value as Role)}
            >
              <option value="trainer">Trainer (I speak English; I read/hear English from trainees)</option>
              <option value="trainee">Trainee (I speak Spanish; I hear Spanish from the trainer)</option>
            </select>
          </label>
          <label className="field">
            Room code
            <input
              className="text"
              value={roomName}
              onChange={(ev) => setRoomName(ev.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            Your name
            <input
              className="text"
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
              placeholder={role === "trainer" ? "Alex" : "María"}
            />
          </label>
          <label className="field">
            Team code (optional)
            <input
              className="text"
              value={joinCode}
              onChange={(ev) => setJoinCode(ev.target.value)}
              placeholder="Same secret for everyone in the session"
              autoComplete="off"
            />
            <span className="muted" style={{ fontWeight: 400 }}>
              If the host set <code>TRAINING_JOIN_CODE</code> on the server (e.g. in Vercel
              env), everyone must enter the same value here.
            </span>
          </label>
          <div className="row">
            <label className="row">
              <input
                type="checkbox"
                checked={micOn}
                onChange={(ev) => setMicOn(ev.target.checked)}
                disabled={pttMode}
              />
              Microphone on when joined
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={cameraOn}
                onChange={(ev) => setCameraOn(ev.target.checked)}
              />
              Camera (optional)
            </label>
          </div>
          <label className="row">
            <input
              type="checkbox"
              checked={pttMode}
              onChange={(ev) => setPttMode(ev.target.checked)}
            />
            Push-to-talk — hold <kbd>Space</kbd> (desktop) or the on-screen button
            (phone) to transmit; mic stays off otherwise
          </label>
          <button className="btn btn-primary" type="submit">
            Join room
          </button>
        </form>
      ) : null}

      {joinState === "connecting" ? (
        <p className="muted">Connecting to LiveKit…</p>
      ) : null}

      {joinState === "connected" && room ? (
        <div className="stack">
          <div className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{activeRoomLabel || room.name || "room"}</strong> —{" "}
              {role === "trainer" ? "Trainer" : "Trainee"}{" "}
              · output language <code>{outputLanguage}</code>
              {pttMode ? (
                <span>
                  {" "}
                  · PTT {pttDown ? "(speaking)" : "(hold Space or button)"}
                </span>
              ) : null}
              <div className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                Your mic:{" "}
                {room.localParticipant.isMicrophoneEnabled ? "on" : "off"}
                {room.localParticipant.getTrackPublication(Track.Source.Microphone)
                  ?.audioTrack
                  ? " · audio sending to room"
                  : " · no audio track yet (check browser permission)"}
              </div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => void leave()}>
              Leave
            </button>
          </div>

          {pttMode ? (
            <div className="card stack">
              <p className="muted" style={{ margin: 0 }}>
                <strong>Push-to-talk:</strong> hold the button below (phone/tablet) or{" "}
                <kbd>Space</kbd> on a physical keyboard. Release to mute.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  width: "100%",
                  padding: "1.25rem",
                  fontSize: "1.15rem",
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  if (!room) {
                    return
                  }
                  ;(e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId)
                  setPttDown(true)
                  void room.localParticipant.setMicrophoneEnabled(true)
                }}
                onPointerUp={(e) => {
                  if (!room) {
                    return
                  }
                  setPttDown(false)
                  void room.localParticipant.setMicrophoneEnabled(false)
                  try {
                    ;(e.currentTarget as HTMLButtonElement).releasePointerCapture(
                      e.pointerId
                    )
                  } catch {
                    /* already released */
                  }
                }}
                onPointerCancel={() => {
                  if (!room) {
                    return
                  }
                  setPttDown(false)
                  void room.localParticipant.setMicrophoneEnabled(false)
                }}
              >
                {pttDown ? "Speaking — release to mute" : "Hold to speak"}
              </button>
            </div>
          ) : null}

          {remoteParticipants.length === 0 ? (
            <div className="card" style={{ borderColor: "#0369a1", background: "#f0f9ff" }}>
              <p style={{ margin: 0 }}>
                <strong>You are alone in this room.</strong> OpenAI translation only runs on{" "}
                <em>other people’s microphones</em>, not your own. Join again from a{" "}
                <strong>second browser tab</strong>, <strong>another browser</strong>, or{" "}
                <strong>another phone/laptop</strong> using the <strong>same room code</strong>.
              </p>
              <p className="muted" style={{ margin: "0.75rem 0 0" }}>
                With <strong>Push-to-talk</strong> enabled, hold <kbd>Space</kbd> or the
                green <strong>Hold to speak</strong> button to transmit.
              </p>
            </div>
          ) : null}

          <div className="card stack">
            <h2>Translation sidecars (OpenAI WebRTC)</h2>
            <p className="muted">
              Target language for all remote mics:{" "}
              <strong>{outputLanguage === "en" ? "English" : "Spanish"}</strong>.
              Each remote speaker uses a separate Realtime Translation session
              (best-effort when many talk at once).
            </p>
            {overflow > 0 ? (
              <p className="error">
                {overflow} remote participant(s) exceed the concurrency cap (
                {MAX_CONCURRENT_TRANSLATIONS}). Later joiners will not receive new
                translation sessions until others leave or you disable some
                streams.
              </p>
            ) : null}
            <label className="row">
              <input
                type="checkbox"
                checked={translationEnabled}
                onChange={(ev) => setTranslationEnabled(ev.target.checked)}
              />
              Enable translation sidecars
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={sourceTranscription}
                onChange={(ev) => setSourceTranscription(ev.target.checked)}
              />
              Source-language transcription (OpenAI whisper on translation input)
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={noiseReduction}
                onChange={(ev) => setNoiseReduction(ev.target.checked)}
              />
              Near-field noise reduction (translation input)
            </label>
            <label className="field" style={{ maxWidth: "320px" }}>
              Translated speech volume ({Math.round(translatedVolume * 100)}%)
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(translatedVolume * 100)}
                onChange={(ev) =>
                  setTranslatedVolume(Number(ev.target.value) / 100)
                }
              />
            </label>
          </div>

          <h2>Remote speakers</h2>
          {remoteParticipants.length === 0 ? (
            <p className="muted">No one else in the room yet.</p>
          ) : (
            <div className="grid-tiles">
              {remoteParticipants.map((p, index) => (
                <RemoteSpeakerTile
                  key={p.identity}
                  participant={p}
                  outputLanguage={outputLanguage}
                  translationActive={
                    translationEnabled && index < MAX_CONCURRENT_TRANSLATIONS
                  }
                  translatedVolume={translatedVolume}
                  sourceTranscription={sourceTranscription}
                  noiseReduction={noiseReduction}
                  overConcurrencyCap={index >= MAX_CONCURRENT_TRANSLATIONS}
                  joinCode={joinCode}
                />
              ))}
            </div>
          )}

          <p className="muted">
            Room audio still plays through LiveKit as usual; translated audio is
            played locally from the OpenAI sidecar. Adjust the trainer/trainee
            role before joining so the correct output language is used.
          </p>
        </div>
      ) : null}
    </div>
  )
}
