import { webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from '../lib/http.ts'
import { reserveSpend, spentCadCents } from '../lib/accountMoney.ts'
import { readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { userIdFromRequest } from '../lib/supabaseUser.ts'
import { canSpend, packCadCents } from '../../src/game/economy.ts'

const SIGN_IN = 'Sign in to buy'
const GROWN_UP = 'Ask a grown-up before buying.'
const CAP = 'Weekly spending limit reached (CA$50). Try again next week.'

/** Hosted Stripe Checkout. The price and coin count come from the server list. */
export default async function createCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  let packId: string | undefined
  let grownUp = false
  try {
    const body = (await req.json()) as { packId?: unknown; grownUp?: unknown }
    packId = typeof body.packId === 'string' ? body.packId : undefined
    grownUp = body.grownUp === true
  } catch {
    return json({ error: 'Missing pack' }, 400)
  }

  const userId = await userIdFromRequest(req)
  if (!userId) return json({ error: SIGN_IN }, 401)
  if (!grownUp) return json({ error: GROWN_UP }, 403)

  const pack = webPackById(packId)
  if (!pack) return json({ error: 'That pack is not sold on the website.' }, 400)

  try {
    const spent = await spentCadCents(userId)
    const cap = canSpend(spent, packCadCents(pack.id))
    if (!cap.ok) return json({ error: cap.reason || CAP }, 403)
  } catch (err) {
    console.error('spend-cap read failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 503)
  }

  const base = siteBase()
  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: pack.id,
      metadata: {
        packId: pack.id,
        productId: pack.productId,
        userId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: pack.unitAmount,
            product_data: {
              name: `${pack.label} (${pack.coins} coins)`,
              description: "Coins for Roman's Game",
            },
          },
        },
      ],
      success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancel`,
      integration_identifier: 'roman-web-coins-wqbzrnkt',
    })
    if (!session.url || !session.id) return json({ error: PURCHASES_UNAVAILABLE }, 502)
    try {
      const held = await reserveSpend(userId, session.id, pack.id)
      if (!held.ok) return json({ error: held.reason }, 403)
    } catch (err) {
      console.error('spend-cap write failed', err instanceof Error ? err.message : 'error')
      return json({ error: PURCHASES_UNAVAILABLE }, 503)
    }
    return json({ url: session.url })
  } catch (err) {
    console.error('create-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
