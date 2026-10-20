import Stripe from 'stripe'

/** Secret keys (sk_), restricted keys (rk_), and sandbox restricted keys (rkcs_). */
const KEY_RE = /^(sk|rk|rkcs)_(test|live)_/

export function readStripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key || !KEY_RE.test(key)) return null
  return key
}

/** A live secret would charge real cards. The shop stays on test keys until Tony says otherwise. */
export function isLiveStripeKey(key: string): boolean {
  return key.includes('_live_')
}

export function stripeClient(key: string): Stripe {
  return new Stripe(key, {
    apiVersion: '2026-07-29.dahlia',
    typescript: true,
  })
}

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^cs_(test|live)_[A-Za-z0-9]+$/.test(value)
}

export function isTestCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^cs_test_[A-Za-z0-9]+$/.test(value)
}
