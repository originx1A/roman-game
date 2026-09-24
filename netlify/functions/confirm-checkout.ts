import { getStore } from '@netlify/blobs'
import { webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import { isCheckoutSessionId, readStripeKey, stripeClient } from '../lib/stripeServer.ts'

const STORE = 'roman-stripe-redeemed'

/**
 * Looks up the Checkout Session at Stripe. Coins are returned only when Stripe
 * says the payment is paid, and only once per session id.
 * A webhook is not used: coins live on the device, so they can only be added
 * when the player comes back to this browser.
 */
export default async function confirmCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  let sessionId: unknown
  try {
    const body = (await req.json()) as { sessionId?: unknown }
    sessionId = body.sessionId
  } catch {
    return json({ error: 'Missing session' }, 400)
  }
  if (!isCheckoutSessionId(sessionId)) return json({ error: 'Missing session' }, 400)

  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return json({ ok: false, reason: 'Payment is not complete. No coins were added.' })
    }

    const pack = webPackById(session.metadata?.packId)
    if (!pack || session.metadata?.productId !== pack.productId) {
      return json({ ok: false, reason: 'That pack is not sold on the website.' })
    }
    if (session.currency !== pack.currency || session.amount_total !== pack.unitAmount) {
      return json({ ok: false, reason: 'Payment did not match this pack. No coins were added.' })
    }

    const store = getStore({ name: STORE, consistency: 'strong' })
    const { modified } = await store.setJSON(
      session.id,
      { packId: pack.id, coins: pack.coins, at: new Date().toISOString() },
      { onlyIfNew: true },
    )
    if (!modified) {
      return json({ ok: true, alreadyRedeemed: true, coins: 0, label: pack.label, packId: pack.id })
    }
    return json({
      ok: true,
      alreadyRedeemed: false,
      coins: pack.coins,
      label: pack.label,
      packId: pack.id,
    })
  } catch (err) {
    console.error('confirm-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
