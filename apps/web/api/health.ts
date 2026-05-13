import type { VercelRequest, VercelResponse } from "@vercel/node"

export default function handler(
  req: VercelRequest,
  res: VercelResponse
): void {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed")
    return
  }
  res.status(200).json({ ok: true })
}
