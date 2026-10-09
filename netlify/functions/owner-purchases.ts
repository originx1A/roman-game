import { getStore } from '@netlify/blobs'
import { json } from '../lib/http.ts'
import { ownerGate } from '../lib/ownerGate.ts'
import { loadPurchases, PURCHASE_STORE } from '../lib/purchases.ts'

/** Owner only (9.30-u): POST {key, days?} → paid web coin orders of the last days (read only; never touches Stripe). */
export default async function ownerPurchases(req: Request): Promise<Response> {
  const gate = await ownerGate(req)
  if (gate.res) return gate.res
  const body = gate.body as { key?: unknown; days?: unknown }
  const days = Math.max(1, Math.min(365, Math.floor(Number(body.days) || 30)))
  try {
    const purchases = await loadPurchases(getStore({ name: PURCHASE_STORE, consistency: 'strong' }), days)
    return json({ ok: true, purchases, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('owner-purchases failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Could not read the purchases. Try again.' }, 502)
  }
}
