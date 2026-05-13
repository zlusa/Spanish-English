/** Optional shared secret: set `TRAINING_JOIN_CODE` on the server to require it for tokens. */

export function joinCodeRequired(): boolean {
  return Boolean(process.env.TRAINING_JOIN_CODE?.trim())
}

export function joinCodeMatches(sent: string | undefined | null): boolean {
  const expected = process.env.TRAINING_JOIN_CODE?.trim()
  if (!expected) {
    return true
  }
  return (sent ?? "").trim() === expected
}
