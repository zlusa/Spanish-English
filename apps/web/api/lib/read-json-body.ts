import type { VercelRequest } from "@vercel/node"

/** Vercel may pass `req.body` as object, string, or Buffer depending on version and Content-Type. */
export function readJsonBody(req: VercelRequest): Record<string, unknown> {
  let b: unknown
  try {
    b = req.body as unknown
  } catch {
    return {}
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString("utf8")) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (b && typeof b === "object" && !Array.isArray(b)) {
    return b as Record<string, unknown>
  }
  return {}
}
