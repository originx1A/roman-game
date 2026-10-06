import { webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from '../lib/http.ts'
import { readStripeKey, stripeClient } from '../lib/stripeServer.ts'

/** Hosted Stripe Checkout. The price and coin count come from the server list. */
export default async function createCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)

  let packId: string | undefined
  try {
    const body = (await req.json()) as { packId?: unknown }
    packId = typeof body.packId === 'string' ? body.packId : undefined
  } catch {
    return json({ error: 'Missing pack' }, 400)
  }

  const pack = webPackById(packId)
  if (!pack) return json({ error: 'That pack is not sold on the website.' }, 400)

  const base = siteBase()
  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: pack.id,
      metadata: {
        packId: pack.id,
        productId: pack.productId,
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
    if (!session.url) return json({ error: PURCHASES_UNAVAILABLE }, 502)
    return json({ url: session.url })
  } catch (err) {
    console.error('create-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
