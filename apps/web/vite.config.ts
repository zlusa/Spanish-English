import path from "node:path"
import basicSsl from "@vitejs/plugin-basic-ssl"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const realtimeTarget = process.env.VITE_REALTIME_PROXY ?? "http://127.0.0.1:8787"

export default defineConfig({
  /** Self-signed HTTPS so phones on LAN get a secure context for `navigator.mediaDevices`. */
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    /** Listen on LAN as well so other devices can open the printed "Network" URL. */
    host: true,
    proxy: {
      "/api": {
        target: realtimeTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
