import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const LOGIN_DOMAIN = 'players.romansgame.invalid'

const CARD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function loginEmail(normalized: string): string {
  return `${normalized}@${LOGIN_DOMAIN}`
}

export function authPepper(): string {
  return process.env.AUTH_PEPPER?.trim() || 'rg-auth-v1'
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashIp(ip: string): string | null {
  if (!ip) return null
  return sha256(`${authPepper()}:ip:${ip}`)
}

export function hashUa(ua: string): string {
  return sha256(`${authPepper()}:ua:${ua || 'unknown'}`)
}

export function hashCode(code: string): string {
  return sha256(`${authPepper()}:code:${code}`)
}

export function hashCard(token: string): string {
  return sha256(token)
}

export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function sixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Unambiguous alphabet, 12 characters, shown once. Only the SHA-256 is stored. */
export function newCardToken(): string {
  const bytes = randomBytes(12)
  let raw = ''
  for (const byte of bytes) raw += CARD_ALPHABET[byte % CARD_ALPHABET.length]
  return `CARD-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

const SECRET_KEYS = new Set([
  'password',
  'current_password',
  'new_password',
  'code',
  'token',
  'card_token',
  'turnstile_token',
  'captchatoken',
  'captcha_token',
  'access_token',
  'refresh_token',
  'reauth_token',
  'authorization',
  'recovery_email',
  'email',
  'secret',
])

/** Audit metadata keeps plain flags only. Passwords, codes, tokens, and emails are dropped. */
export function scrubMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEYS.has(key.toLowerCase())) continue
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  }
  return out
}
