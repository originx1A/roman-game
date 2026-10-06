import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { OWNER_KEY_ENV, ownerKeyConfigured, ownerKeyMatches } from '../lib/gifts.ts'
import { ANALYTICS_STORE, aggregate, loadEvents } from '../lib/analytics.ts'

/** Owner only: POST {key, days?} → totals. */
export default async function analyticsStats(req: Request): Promise<Response> {
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
  const days = Math.max(1, Math.min(90, Math.floor(Number(body.days) || 30)))
  try {
    const events = await loadEvents(getStore({ name: ANALYTICS_STORE, consistency: 'strong' }), days)
    return json({ ok: true, stats: aggregate(events, days), generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('analytics-stats failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not read the stats. Try again.' }, 502)
  }
}
