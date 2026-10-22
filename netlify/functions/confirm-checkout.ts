import { getStore } from '@netlify/blobs'
import { chargeMatchesPack } from '../../src/game/shopOffers.ts'
import { webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import { buildPurchaseRecord, PURCHASE_STORE } from '../lib/purchases.ts'
import { CHECKOUT_TEST_ONLY } from '../lib/coinPacks.ts'
import { gateResponse, requestCountry, requireCheckoutGate, userToken } from '../lib/payGate.ts'
import { isCheckoutSessionId, isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'


/**
 * Looks up the Checkout Session at Stripe. Coins are returned only when Stripe
 * says the payment is paid, and only once per session id.
 * A webhook is not used: coins live on the device, so they can only be added
 * when the player comes back to this browser.
 */
export default async function confirmCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key || (CHECKOUT_TEST_ONLY && isLiveStripeKey(key))) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  let sessionId: unknown
  try {
    const body = (await req.json()) as { sessionId?: unknown }
    sessionId = body.sessionId
  } catch {
    return json({ error: 'Missing session' }, 400)
  }
  if (!isCheckoutSessionId(sessionId)) return json({ error: 'Missing session' }, 400)

  const gate = await requireCheckoutGate({
    token: userToken(req),
    country: requestCountry(req),
    requireReauth: false,
  })
  if (!gate.ok) return gateResponse(gate)

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
    if (!chargeMatchesPack(pack, session.currency, session.amount_total)) {
      return json({ ok: false, reason: 'Payment did not match this pack. No coins were added.' })
    }

    const store = getStore({ name: PURCHASE_STORE, consistency: 'strong' })
    const { modified } = await store.setJSON(
      session.id,
      buildPurchaseRecord(session, pack),
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
