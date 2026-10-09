import { getStore } from '@netlify/blobs'
import { json } from './http.ts'
import { OWNER_KEY_ENV, OWNER_SESSION_STORE, credentialsOf, credentialsOk, ownerKeyConfigured, readNotBefore, slowNo } from './ownerAuth.ts'

/**
 * Shared guard for owner-only functions. Returns {body} when the caller is the owner, or {res} (503/400/401) to
 * send back as is. Without the password or a valid token nothing behind it runs.
 */
export async function ownerGate(req: Request): Promise<{ body: Record<string, unknown>; res?: undefined } | { res: Response; body?: undefined }> {
  if (req.method !== 'POST') return { res: json({ error: 'Method not allowed' }, 405) }
  if (!ownerKeyConfigured()) return { res: json({ error: `Add ${OWNER_KEY_ENV} in Netlify first.`, configured: false }, 503) }
  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return { res: json({ error: 'Bad request' }, 400) }
  }
  let store = null
  try {
    store = getStore({ name: OWNER_SESSION_STORE, consistency: 'strong' })
  } catch {
    store = null
  }
  const nb = await readNotBefore(store)
  if (!credentialsOk(credentialsOf(req, body), process.env, Date.now(), nb)) {
    await slowNo()
    return { res: json({ error: 'Owner password needed.', auth: false }, 401) }
  }
  return { body }
}
