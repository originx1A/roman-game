import { getStore } from '@netlify/blobs'
import { AUDIO_GRANT_STORE, fulfillPaidSession, normalizeCheckoutSession, thanksView } from '../lib/audioGrant.ts'
import { json, PURCHASES_UNAVAILABLE } from '../lib/http.ts'
import { isCheckoutSessionId, readStripeKey, stripeClient } from '../lib/stripeServer.ts'

/** Confirms the Checkout Session with Stripe, then returns the download list for the thank-you page. */
export default async function storeThanks(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const sessionId = new URL(req.url).searchParams.get('session_id')
  if (!isCheckoutSessionId(sessionId)) return json({ error: 'Missing purchase.' }, 400)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const grant = await fulfillPaidSession(
      getStore({ name: AUDIO_GRANT_STORE, consistency: 'strong' }),
      normalizeCheckoutSession(session),
    )
    if (!grant) return json({ error: 'That payment is not a completed audiobook purchase.' }, 400)
    return json(thanksView(grant))
  } catch (err) {
    console.error('store-thanks failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
