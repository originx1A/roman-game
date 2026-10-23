import { createHash } from 'node:crypto'

export type HibpVerdict = 'pwned' | 'clear' | 'unknown'

/**
 * k-anonymity range check. Only the first 5 hex characters of the SHA-1
 * leave the server. Fail-open when HIBP is down or the response is unusable.
 */
export async function hibpRange(password: string, fetchImpl: typeof fetch = fetch): Promise<HibpVerdict> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'add-padding': 'true' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return 'unknown'
    const text = await res.text()
    const hit = text.split('\n').some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix)
    return hit ? 'pwned' : 'clear'
  } catch {
    return 'unknown'
  }
}
