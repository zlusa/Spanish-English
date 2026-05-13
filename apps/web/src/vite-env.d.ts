/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_URL?: string
  /** JSON array of RTCIceServer objects, e.g. [{"urls":"turns:…:443","username":"…","credential":"…"}] */
  readonly VITE_WEBRTC_ICE_SERVERS?: string
  /** Comma-separated turn:/turns: URLs (same credentials for all). */
  readonly VITE_TURN_URLS?: string
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
