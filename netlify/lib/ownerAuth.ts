import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches } from './gifts.ts'

/**
 * 10.09 admin lock (server side). The owner password is the Netlify env var ROMAN_OWNER_KEY (never in the
 * client bundle). A correct password returns a signed session token the owner page keeps on that device, so
 * Tony is not asked every time. Tokens are HMAC-signed with a secret derived from the password itself, so
 * changing ROMAN_OWNER_KEY in Netlify logs every device out. "Log out everywhere" bumps a not-before time.
 *
 * Every owner endpoint calls ownerAuthorized(): it accepts the password (older owner pages send {key}) or a
 * valid token (sent as {token}, as {key}, or as an Authorization: Bearer header).
 */
export { OWNER_KEY_ENV, ownerKeyConfigured }
export const OWNER_SESSION_STORE = 'roman-owner-session'
export const TOKEN_PREFIX = 'rot1.'
export const TOKEN_DAYS = 30
const DAY_MS = 86_400_000

type Env = Record<string, string | undefined>

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

function signingKey(env: Env): Buffer | null {
  const real = env[OWNER_KEY_ENV]?.trim()
  if (!real) return null
  return createHash('sha256').update(`roman-owner-session-v1:${real}`).digest()
}

export interface TokenPayload {
  v: 1
  iat: number
  exp: number
}

export function makeOwnerToken(env: Env = process.env, now = Date.now(), days = TOKEN_DAYS): { token: string; expiresAt: string } | null {
  const k = signingKey(env)
  if (!k) return null
  const payload: TokenPayload = { v: 1, iat: now, exp: now + days * DAY_MS }
  const body = b64u(JSON.stringify(payload))
  const sig = b64u(createHmac('sha256', k).update(body).digest())
  return { token: `${TOKEN_PREFIX}${body}.${sig}`, expiresAt: new Date(payload.exp).toISOString() }
}

/** Returns the payload when the token is genuine, unexpired and issued after notBefore (ms). */
export function verifyOwnerToken(token: unknown, env: Env = process.env, now = Date.now(), notBefore = 0): TokenPayload | null {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX) || token.length > 400) return null
  const k = signingKey(env)
  if (!k) return null
  const [body, sig] = token.slice(TOKEN_PREFIX.length).split('.')
  if (!body || !sig) return null
  const want = createHmac('sha256', k).update(body).digest()
  let got: Buffer
  try {
    got = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
    if (p.v !== 1 || typeof p.exp !== 'number' || typeof p.iat !== 'number') return null
    if (p.exp <= now || p.iat < notBefore) return null
    return p
  } catch {
    return null
  }
}

/** What a request offers as proof: body.token, body.key, or an Authorization: Bearer header. */
export function credentialsOf(req: Request | null, body: unknown): string[] {
  const out: string[] = []
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.token === 'string' && b.token) out.push(b.token)
    if (typeof b.key === 'string' && b.key) out.push(b.key)
  }
  const h = req?.headers?.get?.('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (m) out.push(m[1].trim())
  return out
}

export interface NotBeforeStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<unknown>
}

export async function readNotBefore(store: NotBeforeStore | null): Promise<number> {
  if (!store) return 0
  try {
    const j = (await store.get('notBefore', { type: 'json' })) as { t?: number } | null
    return j && typeof j.t === 'number' ? j.t : 0
  } catch {
    return 0
  }
}

/** True when any offered credential is the owner password or a valid owner token. */
export function credentialsOk(creds: string[], env: Env = process.env, now = Date.now(), notBefore = 0): boolean {
  if (!ownerKeyConfigured(env)) return false
  for (const c of creds) {
    if (c.startsWith(TOKEN_PREFIX)) {
      if (verifyOwnerToken(c, env, now, notBefore)) return true
    } else if (ownerKeyMatches(c, env)) return true
  }
  return false
}

export const slowNo = () => new Promise((r) => setTimeout(r, 600))
