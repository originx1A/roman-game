/**
 * Reads the signed-in user id from a Bearer token.
 * Uses the publishable key only. Never logs the token or the response body.
 * This is a read of the auth API at request time. It is not a database migration.
 */
const SUPABASE_URL = 'https://oelsglmfkpzbueqysvdm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_-lwtjOa1ekpRv6bdjOoTmg_lL3Tmne8'

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  if (!token || token.length > 8000) return null
  return token
}

export async function userIdFromRequest(req: Request): Promise<string | null> {
  const token = bearerToken(req)
  if (!token) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: unknown }
    if (typeof data.id !== 'string') return null
    if (!/^[0-9a-f-]{16,80}$/i.test(data.id)) return null
    return data.id
  } catch {
    return null
  }
}
