import { hashIp, hashUa } from '../lib/authCrypto.ts'
import { CHECKOUT_TEST_ONLY, webPackById } from '../lib/coinPacks.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from '../lib/http.ts'
import { checkoutAllowed, loadPayRow, requestCountry, requireUser, type PayRow } from '../lib/payGate.ts'
import { consumeReauth as burnReauth } from '../lib/reauth.ts'
import { starterPriceCents, type StarterCurrency } from '../../src/game/shopOffers.ts'
import { countStarterReceipts } from '../lib/starterReceipts.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from '../lib/stripeServer.ts'
import { supabaseAdmin } from '../lib/supabaseAdmin.ts'

export interface CheckoutSessionInput {
  packId: string
  productId: string
  playerId: string
  purpose: 'self' | 'gift'
  unitAmount: number
  currency: string
  label: string
  description: string
  email: string | null
  deviceUaHash?: string
  ipHash?: string | null
}

export interface CheckoutDeps {
  readKey(): string | null
  isLive(key: string): boolean
  testOnly: boolean
  userId(token: string): Promise<string | null>
  payRow(playerId: string): Promise<{ ok: true; row: PayRow } | { ok: false; status: number; error: string }>
  consumeReauth(playerId: string, token: string): Promise<boolean>
  /** Starters already received by this account. Unavailable means the count could not be read. */
  starterCount(playerId: string): Promise<number | 'unavailable'>
  createSession(input: CheckoutSessionInput, urls: { success: string; cancel: string }): Promise<{ url: string | null }>
}

const defaultDeps = (): CheckoutDeps => ({
  readKey: readStripeKey,
  isLive: isLiveStripeKey,
  testOnly: CHECKOUT_TEST_ONLY,
  userId: requireUser,
  payRow: loadPayRow,
  async consumeReauth(playerId, token) {
    const admin = supabaseAdmin()
    if (!admin) return false
    return burnReauth(admin, playerId, token)
  },
  async starterCount(playerId) {
    const admin = supabaseAdmin()
    if (!admin) return 0
    return countStarterReceipts(admin, playerId)
  },
  async createSession(input, urls) {
    const key = readStripeKey()
    if (!key) return { url: null }
    const stripe = stripeClient(key)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: input.packId,
      // Payment methods stay on the dashboard's automatic list (card, Apple Pay, Google Pay
      // once romansgame.com is verified). This session does not name a method list of its own.
      // Link is turned off for this session. The card is saved on the Stripe customer
      // so a later removal can return the account to kid mode.
      excluded_payment_method_types: ['link'],
      wallet_options: { link: { display: 'never' } },
      payment_method_options: { card: { request_three_d_secure: 'any' } },
      payment_intent_data: { setup_future_usage: 'off_session' },
      billing_address_collection: 'required',
      customer_email: input.email || undefined,
      customer_creation: 'always',
      metadata: {
        packId: input.packId,
        productId: input.productId,
        playerId: input.playerId,
        user_id: input.playerId,
        purpose: input.purpose,
        device_ua_hash: input.deviceUaHash || '',
        ip_hash: input.ipHash || '',
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.unitAmount,
            product_data: { name: input.label, description: input.description },
          },
        },
      ],
      success_url: urls.success,
      cancel_url: urls.cancel,
      integration_identifier: 'roman-web-coins-wqbzrnkt',
    })
    return { url: session.url }
  },
})

function bearer(req: Request): string {
  const header = req.headers.get('authorization') || ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

/**
 * Hosted Stripe Checkout for a signed-in account with payments on.
 * Refuses a live key while test mode is on. Price comes from the server list.
 * The per-purchase re-auth token is required and cannot be skipped.
 */
export async function handleCreateCheckout(req: Request, deps: CheckoutDeps = defaultDeps()): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = deps.readKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)
  if (deps.testOnly && deps.isLive(key)) {
    return json({ error: 'Checkout is in test mode. A live key is not accepted yet.' }, 503)
  }

  let packId = ''
  let reauthToken = ''
  let purpose: 'self' | 'gift' = 'self'
  try {
    const body = (await req.json()) as { packId?: unknown; reauthToken?: unknown; gift?: unknown; skipReauth?: unknown }
    packId = typeof body.packId === 'string' ? body.packId : ''
    reauthToken = typeof body.reauthToken === 'string' ? body.reauthToken : ''
    purpose = body.gift === true ? 'gift' : 'self'
    // skipReauth is ignored. The check stays on.
    void body.skipReauth
  } catch {
    return json({ error: 'Missing pack' }, 400)
  }

  const playerId = await deps.userId(bearer(req))
  const loaded = playerId ? await deps.payRow(playerId) : { ok: false as const, status: 401, error: 'Sign in first.' }
  if (!playerId || !loaded.ok) {
    const failure = loaded.ok ? { status: 401, error: 'Sign in first.' } : loaded
    return json({ ok: false, error: failure.error }, failure.status)
  }
  const gate = checkoutAllowed({
    signedIn: true,
    paymentsEnabled: loaded.row.paymentsEnabled,
    parentLocked: loaded.row.parentLocked,
    age13Plus: loaded.row.age13Plus,
    ownerAdult: loaded.row.ownerAdult,
    reauthOk: reauthToken.length >= 20,
    country: requestCountry(req),
    requireReauth: true,
  })
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status)

  const pack = webPackById(packId)
  if (!pack) return json({ error: 'That pack is not sold on the website.' }, 400)
  const country = requestCountry(req)
  const starterCurrency: StarterCurrency = country === 'US' ? 'usd' : 'cad'
  let unitAmount = pack.unitAmount
  let currency: string = pack.currency
  if (pack.id === 'starter') {
    // A gift code has no receiving account until it is redeemed, so it uses the first price.
    // A pack for this account uses how many Starters this account already holds.
    const prior = purpose === 'self' ? await deps.starterCount(playerId) : 0
    if (prior === 'unavailable') return json({ error: PURCHASES_UNAVAILABLE }, 503)
    unitAmount = starterPriceCents(starterCurrency, prior)
    currency = starterCurrency
  }
  if (!await deps.consumeReauth(playerId, reauthToken)) {
    return json({ ok: false, error: 'Enter your password, PIN, or passkey to buy.' }, 401)
  }

  const base = siteBase()
  try {
    const session = await deps.createSession(
      {
        packId: pack.id,
        productId: pack.productId,
        playerId,
        purpose,
        unitAmount,
        currency,
        label: pack.label,
        description: pack.contents.join(', '),
        email: loaded.row.email,
        deviceUaHash: hashUa(req.headers.get('user-agent') ?? ''),
        ipHash: hashIp(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || ''),
      },
      {
        success: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel: `${base}/?checkout=cancel`,
      },
    )
    if (!session.url) return json({ error: PURCHASES_UNAVAILABLE }, 502)
    return json({ url: session.url })
  } catch (err) {
    console.error('create-checkout failed', err instanceof Error ? err.message : 'error')
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}

export default function createCheckout(req: Request): Promise<Response> {
  return handleCreateCheckout(req)
}
