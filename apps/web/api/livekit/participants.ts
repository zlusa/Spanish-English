import type { VercelRequest, VercelResponse } from "@vercel/node"

import { handleLiveKitParticipants } from "../lib/handlers.js"

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).send("Method not allowed")
    return
  }
  await handleLiveKitParticipants(req, res)
}
