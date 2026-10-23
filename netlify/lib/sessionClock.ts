/** Supabase Free cannot time-box sessions. These limits are enforced here. */

export const IDLE_MS = 30 * 24 * 60 * 60 * 1000
export const ABSOLUTE_STAY_MS = 90 * 24 * 60 * 60 * 1000
export const ABSOLUTE_SHORT_MS = 12 * 60 * 60 * 1000

export type DeviceClock = {
  stay: boolean
  createdAt: number
  lastSeenAt: number
  absoluteUntil: number
}

/** Idle applies only when the player asked to stay signed in. The absolute cap always applies. */
export function sessionExpired(device: DeviceClock, now: number): 'idle' | 'absolute' | null {
  const cap = device.createdAt + (device.stay ? ABSOLUTE_STAY_MS : ABSOLUTE_SHORT_MS)
  if (now >= device.absoluteUntil || now >= cap) return 'absolute'
  if (device.stay && now - device.lastSeenAt >= IDLE_MS) return 'idle'
  return null
}

/** Reads the GoTrue session id. Returns null when the token is not one of ours. */
export function sessionIdFromAccessToken(token: string): string | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { session_id?: unknown }
    if (typeof json.session_id !== 'string') return null
    const id = json.session_id.trim()
    if (id.length < 8 || id.length > 128) return null
    return id
  } catch {
    return null
  }
}

/** Test helper and the in-memory backend. GoTrue issues the real tokens in production. */
export function accessTokenForSession(sessionId: string, playerId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify({ sub: playerId, session_id: sessionId })).toString('base64url')
  return `${header}.${body}.x`
}
