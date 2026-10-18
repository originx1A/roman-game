import Stripe from 'stripe'

type Env = Record<string, string | undefined>

/** Secret keys (sk_), restricted keys (rk_), and sandbox restricted keys (rkcs_). */
const KEY_RE = /^(sk|rk|rkcs)_(test|live)_/

export function readStripeKey(env: Env = process.env): string | null {
  const key = env.STRIPE_SECRET_KEY?.trim()
  if (!key || !KEY_RE.test(key)) return null
  return key
}

/** Stripe webhook signing secret. Never hardcoded. */
export function readWebhookSecret(env: Env = process.env): string | null {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret || !secret.startsWith('whsec_')) return null
  return secret
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
