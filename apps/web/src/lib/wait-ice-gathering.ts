/**
 * After `setLocalDescription(offer)`, browsers gather ICE candidates asynchronously.
 * Sending the SDP to the signaling server before gathering completes often yields an
 * SDP with no (or few) candidates → ICE checks time out (~10–30s) then `disconnected`/`failed`.
 */
export function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs: number
): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      pc.removeEventListener("icegatheringstatechange", onGatheringState)
      resolve()
    }

    const timer = setTimeout(finish, timeoutMs)

    const onGatheringState = () => {
      if (pc.iceGatheringState === "complete") {
        finish()
      }
    }

    pc.addEventListener("icegatheringstatechange", onGatheringState)
  })
}
