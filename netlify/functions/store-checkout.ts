import { AUDIO_PRODUCTS } from '../../src/store/catalog.ts'
import { audiobookCheckoutParams, audioSalesEnabled, automaticTaxEnabled } from '../lib/audioSales.ts'
import { json, siteBase } from '../lib/http.ts'
import { readStripeKey, stripeClient } from '../lib/stripeServer.ts'

/** Hosted Stripe Checkout in CAD. The price is copied from the catalog. No Stripe Price objects. */
export default async function storeCheckout(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!audioSalesEnabled()) return json({ error: 'Audiobook sales are not open yet.' }, 503)

  const key = readStripeKey()
  if (!key) return json({ error: 'Audiobook sales are not open yet.' }, 503)

  let slug: unknown
  try {
    const body = (await req.json()) as { slug?: unknown }
    slug = body.slug
  } catch {
    return json({ error: 'Missing audiobook.' }, 400)
  }
  if (typeof slug !== 'string') return json({ error: 'Missing audiobook.' }, 400)
  if (AUDIO_PRODUCTS.some((product) => product.slug === slug && product.priceCents === 0)) {
    return json({ error: 'That story is free.' }, 400)
  }

  const params = audiobookCheckoutParams({
    slug,
    siteBase: siteBase(),
    automaticTax: automaticTaxEnabled(),
  })
  if (!params) return json({ error: 'Unknown audiobook.' }, 400)

  try {
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.create(params)
    if (!session.url) return json({ error: 'Checkout is unavailable right now.' }, 502)
    return json({ url: session.url })
  } catch (err) {
    console.error('store-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: 'Checkout is unavailable right now.' }, 502)
  }
}
