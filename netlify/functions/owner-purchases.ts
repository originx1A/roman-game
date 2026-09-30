import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches } from '../lib/gifts.ts'
import { loadPurchases, PURCHASE_STORE } from '../lib/purchases.ts'

/** Owner only (9.30-u): POST {key, days?} → paid web coin orders of the last days (read only; never touches Stripe). */
export default async function ownerPurchases(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ownerKeyConfigured()) return json({ error: `Add ${OWNER_KEY_ENV} in Netlify first.` }, 503)
  let body: { key?: unknown; days?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  if (!ownerKeyMatches(body.key)) {
    await new Promise((r) => setTimeout(r, 600))
    return json({ error: 'Wrong owner passphrase.' }, 401)
  }
  const days = Math.max(1, Math.min(365, Math.floor(Number(body.days) || 30)))
  try {
    const purchases = await loadPurchases(getStore({ name: PURCHASE_STORE, consistency: 'strong' }), days)
    return json({ ok: true, purchases, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('owner-purchases failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not read the purchases. Try again.' }, 502)
  }
}
