import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { ownerGate } from '../lib/ownerGate.ts'
import { ANALYTICS_STORE, aggregate, loadEvents } from '../lib/analytics.ts'

/** Owner only: POST {key, days?} → totals. */
export default async function analyticsStats(req: Request): Promise<Response> {
  const gate = await ownerGate(req)
  if (gate.res) return gate.res
  const body = gate.body as { key?: unknown; days?: unknown }
  const days = Math.max(1, Math.min(90, Math.floor(Number(body.days) || 30)))
  try {
    const events = await loadEvents(getStore({ name: ANALYTICS_STORE, consistency: 'strong' }), days)
    return json({ ok: true, stats: aggregate(events, days), generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('analytics-stats failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not read the stats. Try again.' }, 502)
  }
}
