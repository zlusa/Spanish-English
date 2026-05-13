import * as React from "react"

/**
 * Browsers only expose `navigator.mediaDevices` in a **secure context**:
 * `https://`, or `http://localhost` / `http://127.0.0.1`.
 * Plain `http://192.168.x.x` on a phone → `mediaDevices` is undefined → LiveKit mic fails.
 */
export function MicSecureContextBanner() {
  const [blocked, setBlocked] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const hasApi =
      typeof navigator.mediaDevices?.getUserMedia === "function"
    setBlocked(!window.isSecureContext || !hasApi)
  }, [])

  if (!blocked) {
    return null
  }

  return (
    <div
      className="card"
      style={{
        borderColor: "#b45309",
        background: "#fffbeb",
        marginBottom: "1rem",
      }}
    >
      <p style={{ margin: "0 0 0.5rem" }}>
        <strong>Microphone is blocked on this URL.</strong> Browsers only allow{" "}
        <code>getUserMedia</code> on <strong>HTTPS</strong> (or on{" "}
        <code>localhost</code>). A plain <code>http://192.168…</code> link on a phone
        leaves <code>navigator.mediaDevices</code> undefined.
      </p>
      <p className="muted" style={{ margin: 0 }}>
        Use the <strong>https://</strong> address printed in the terminal when you run{" "}
        <code>pnpm dev</code> (tap “Advanced” / “Show details” and proceed past the
        certificate warning on first open). Deploying the app behind real HTTPS also
        fixes this.
      </p>
    </div>
  )
}
