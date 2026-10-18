import type Stripe from 'stripe'
import { purchaseBySlug } from '../../src/store/catalog.ts'
import { r2Settings } from './r2Sign.ts'
import { readStripeKey } from './stripeServer.ts'

type Env = Record<string, string | undefined>

/** Covers, samples, and the free saga can load once R2 credentials exist. The bucket stays private. */
export function audioMediaEnabled(env: Env = process.env): boolean {
  return r2Settings(env) !== null
}

/** Buy buttons stay hidden until this is true. */
export function audioSalesEnabled(env: Env = process.env): boolean {
  return env.STORE_AUDIO_SALES_ENABLED === 'true' && readStripeKey(env) !== null && r2Settings(env) !== null
}

export function automaticTaxEnabled(env: Env = process.env): boolean {
  return env.STRIPE_AUTOMATIC_TAX === 'true'
}

export function audiobookCheckoutParams(opts: {
  slug: string
  siteBase: string
  automaticTax: boolean
}): Stripe.Checkout.SessionCreateParams | null {
  const purchase = purchaseBySlug(opts.slug)
  if (!purchase) return null
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    client_reference_id: purchase.slug,
    metadata: { store: 'audiobook', slug: purchase.slug },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: purchase.priceCents,
          product_data: {
            name: purchase.title,
            description: "Audiobook from Roman's Game",
          },
          ...(opts.automaticTax ? { tax_behavior: 'exclusive' } : {}),
        },
      },
    ],
    success_url: `${opts.siteBase}/store/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.siteBase}/store/#audiobooks`,
  }
  if (opts.automaticTax) {
    params.automatic_tax = { enabled: true }
    params.billing_address_collection = 'required'
  }
  return params
}
