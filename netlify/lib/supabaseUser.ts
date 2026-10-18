/**
 * Reads the signed-in user id from a Bearer token.
 * Uses the publishable key only. Never logs the token or the response body.
 * This is a read of the auth API at request time. It is not a database migration.
 */
import { emailIsVerified } from '../../src/game/purchasePin.ts'

const SUPABASE_URL = 'https://oelsglmfkpzbueqysvdm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_-lwtjOa1ekpRv6bdjOoTmg_lL3Tmne8'

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  if (!token || token.length > 8000) return null
  return token
}

export interface AuthUser {
  id: string
  /** Sign-in address. Empty when the token has none. Never log this. */
  email: string
  /** True only after the player has opened the sign-in email. */
  emailVerified: boolean
  lastSignInAt: number | null
}

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  const token = bearerToken(req)
  if (!token) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      id?: unknown
      email?: unknown
      last_sign_in_at?: unknown
      confirmed_at?: unknown
      email_confirmed_at?: unknown
    }
    if (typeof data.id !== 'string' || !/^[0-9a-f-]{16,80}$/i.test(data.id)) return null
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    const parsed = typeof data.last_sign_in_at === 'string' ? Date.parse(data.last_sign_in_at) : NaN
    const safeEmail = email.includes('@') && email.length <= 320 ? email : ''
    return {
      id: data.id,
      email: safeEmail,
      emailVerified: emailIsVerified(safeEmail, data.confirmed_at, data.email_confirmed_at),
      lastSignInAt: Number.isFinite(parsed) ? parsed : null,
    }
  } catch {
    return null
  }
}

export async function userIdFromRequest(req: Request): Promise<string | null> {
  const user = await userFromRequest(req)
  return user?.id ?? null
}

/**
 * Sends the existing sign-in email (magic link) to this account only.
 * Uses the publishable key, the same way the game already signs people in.
 * Does not log the address or the response body.
 */
export async function sendSignInLink(email: string, redirectTo: string): Promise<boolean> {
  if (!email || !redirectTo.startsWith('https://')) return false
  try {
    const url = new URL(`${SUPABASE_URL}/auth/v1/otp`)
    url.searchParams.set('redirect_to', redirectTo)
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, create_user: false, data: {} }),
    })
    return res.ok
  } catch {
    return false
  }
}
