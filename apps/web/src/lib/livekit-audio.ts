import type { Participant } from "livekit-client"
import { Track } from "livekit-client"

export function getParticipantAudioMediaStreamTrack(
  participant: Participant
): MediaStreamTrack | null {
  const publication = participant.getTrackPublication(Track.Source.Microphone)
  const audio = publication?.audioTrack
  return audio?.mediaStreamTrack ?? null
}
