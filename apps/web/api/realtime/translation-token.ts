import type { VercelRequest, VercelResponse } from "@vercel/node"

import { handleTranslationToken } from "../../server/handlers"

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed")
    return
  }
  await handleTranslationToken(req, res)
}
