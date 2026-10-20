import { CHECKOUT_TEST_ONLY, webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from '../lib/http.ts'
import { bearer, supabaseAdmin, supabaseAsUser } from '../lib/supabaseAdmin.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'

/** Hosted Stripe Checkout. The price and coin count come from the server list. Test keys only. */
export default async function createCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = readStripeKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)
  if (CHECKOUT_TEST_ONLY && isLiveStripeKey(key)) {
    return json({ error: 'Checkout is in test mode. A live key is not accepted yet.' }, 503)
  }

  let packId: string | undefined
  try {
    const body = (await req.json()) as { packId?: unknown }
    packId = typeof body.packId === 'string' ? body.packId : undefined
  } catch {
    return json({ error: 'Missing pack' }, 400)
  }

  const pack = webPackById(packId)
  if (!pack) return json({ error: 'That pack is not sold on the website.' }, 400)

  if (pack.once) {
    const token = bearer(req)
    if (!token) return json({ error: 'Sign in first. The Starter Pack is once per account.' }, 401)
    const admin = supabaseAdmin()
    if (!admin) return json({ error: PURCHASES_UNAVAILABLE }, 503)
    const userClient = supabaseAsUser(token)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    const uid = userData.user?.id
    if (userError || !uid) return json({ error: 'Sign in first. The Starter Pack is once per account.' }, 401)
    const { data: owned } = await admin
      .from('player_items')
      .select('item_id')
      .eq('player_id', uid)
      .eq('item_type', 'bundle')
      .eq('item_id', pack.id)
      .maybeSingle()
    if (owned) return json({ error: 'You already have the Starter Pack.' }, 409)
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
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pack.currency,
            unit_amount: pack.unitAmount,
            product_data: {
              name: pack.label,
              description: pack.contents.join(', '),
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
