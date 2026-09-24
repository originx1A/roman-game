import Stripe from 'stripe'

const KEY_RE = /^(sk|rk)_(test|live)_/

export function readStripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key || !KEY_RE.test(key)) return null
  return key
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
