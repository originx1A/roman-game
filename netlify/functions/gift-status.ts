import { json } from '../lib/http.ts'
import { OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches } from '../lib/gifts.ts'

/**
 * GET: is the owner passphrase set up? (never returns the passphrase)
 * POST {key}: does the typed passphrase match? Used to unlock the owner page.
 */
export default async function giftStatus(req: Request): Promise<Response> {
  const configured = ownerKeyConfigured()
  if (req.method === 'GET') return json({ configured, env: OWNER_KEY_ENV })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!configured) return json({ configured: false, env: OWNER_KEY_ENV, ok: false }, 503)
  let key: unknown
  try {
    key = ((await req.json()) as { key?: unknown }).key
  } catch {
    return json({ ok: false }, 400)
  }
  const ok = ownerKeyMatches(key)
  if (!ok) await new Promise((r) => setTimeout(r, 600))
  return json({ configured: true, ok }, ok ? 200 : 401)
}
