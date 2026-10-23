import { hashIp, hashUa } from '../lib/authCrypto.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from '../lib/http.ts'
import { PAYMENTS_BLOCKED_COUNTRIES, loadPayRow, requestCountry, requireUser } from '../lib/payGate.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { CHECKOUT_TEST_ONLY } from '../lib/coinPacks.ts'

export interface SetupDeps {
  userId(token: string): Promise<string | null>
  payRow: typeof loadPayRow
  country(req: Request): string | null
  createSetup(input: { playerId: string; email: string | null; deviceUaHash: string; ipHash: string | null }): Promise<{ url: string | null }>
}

function bearer(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

function productionDeps(): SetupDeps | null {
  return {
    userId: requireUser,
    payRow: loadPayRow,
    country: requestCountry,
    async createSetup(input) {
      const key = readStripeKey()
      if (!key || (CHECKOUT_TEST_ONLY && isLiveStripeKey(key))) return { url: null }
      const stripe = stripeClient(key)
      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer_email: input.email || undefined,
        customer_creation: 'always',
        metadata: {
          user_id: input.playerId,
          device_ua_hash: input.deviceUaHash,
          ip_hash: input.ipHash || '',
        },
        success_url: `${siteBase()}/?card=saved`,
        cancel_url: `${siteBase()}/?card=cancel`,
      })
      return { url: session.url }
    },
  }
}

/**
 * Starts a Stripe Checkout in setup mode so a card can be verified and attached.
 * This does not charge the account and does not by itself mark the owner.
 * The webhook does that after Stripe confirms the payment method.
 */
export async function handlePaymentSetup(req: Request, deps: SetupDeps | null = productionDeps()): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!deps) return json({ error: 'unavailable' }, 503)
  const playerId = await deps.userId(bearer(req))
  if (!playerId) return json({ ok: false, error: 'Sign in first.' }, 401)
  const loaded = await deps.payRow(playerId)
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status)
  if (loaded.row.parentLocked) {
    return json({ ok: false, error: 'A parent turned payments off. They have to turn them back on.' }, 403)
  }
  const country = (deps.country(req) || '').toUpperCase()
  if (country && PAYMENTS_BLOCKED_COUNTRIES.has(country)) {
    return json({ ok: false, error: "Purchases aren't available in this country yet." }, 403)
  }
  try {
    const session = await deps.createSetup({
      playerId,
      email: loaded.row.email,
      deviceUaHash: hashUa(req.headers.get('user-agent') ?? ''),
      ipHash: hashIp(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || ''),
    })
    if (!session.url) return json({ error: PURCHASES_UNAVAILABLE }, 502)
    return json({ url: session.url })
  } catch (err) {
    console.error('payments-setup failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}

export default function paymentsSetup(req: Request): Promise<Response> {
  return handlePaymentSetup(req)
}
