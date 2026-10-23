import { hashIp, hashUa } from './authCrypto.ts'
import { receivingAccount, validateCart, type CartPlan } from './cartValidate.ts'
import { json, PURCHASES_UNAVAILABLE, siteBase } from './http.ts'
import { checkoutAllowed, loadPayRow, requestCountry, requireUser } from './payGate.ts'
import { PRODUCT_CATALOG, type Catalog } from './productCatalog.ts'
import { consumeReauth } from './reauth.ts'
import { CHECKOUT_TEST_ONLY } from './coinPacks.ts'
import { isLiveStripeKey, readStripeKey, stripeClient } from './stripeServer.ts'
import { countStarterReceipts } from './starterReceipts.ts'
import { supabaseAdmin } from './supabaseAdmin.ts'

const CART_TTL_MS = 30 * 60_000

const STATUS: Record<string, number> = {
  empty: 422,
  too_many_lines: 422,
  unknown_sku: 422,
  bad_qty: 422,
  duplicate_sku: 422,
  starter_qty: 422,
  bad_gift: 422,
  prices_not_ready: 409,
}

export type SavedCart = {
  playerId: string
  holdsStarter: boolean
  giftMode: 'linked_child' | 'code' | null
  giftChildId: string | null
  expiresAt: string
  items: { sku: string; qty: number }[]
}

export type CartSessionInput = {
  cartId: string
  playerId: string
  plan: CartPlan
  email: string | null
  expiresAt: string
  deviceUaHash?: string
  ipHash?: string | null
}

export type CartDeps = {
  now: () => number
  catalog: Catalog
  country: (req: Request) => string | null
  userId: (token: string) => Promise<string | null>
  payRow: (playerId: string) => Promise<{ ok: true; row: { paymentsEnabled: boolean; parentLocked: boolean; age13Plus: boolean | null; email: string | null; ownerAdult?: boolean } } | { ok: false; status: number; error: string }>
  starterCount: (accountId: string) => Promise<number | 'unavailable'>
  consumeReauth: (playerId: string, token: string) => Promise<boolean>
  readKey: () => string | null
  isLive: (key: string) => boolean
  testOnly: boolean
  saveCart: (row: SavedCart) => Promise<{ id: string } | 'unavailable'>
  cancelCart: (id: string) => Promise<void>
  createSession: (input: CartSessionInput) => Promise<{ url: string | null }>
}

function bearer(req: Request): string {
  const header = req.headers.get('authorization') ?? ''
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

export function productionCartDeps(): CartDeps | null {
  const admin = supabaseAdmin()
  if (!admin) return null
  return {
    now: () => Date.now(),
    catalog: PRODUCT_CATALOG,
    country: requestCountry,
    userId: requireUser,
    payRow: loadPayRow,
    async starterCount(accountId) {
      return countStarterReceipts(admin, accountId)
    },
    async consumeReauth(playerId, token) {
      return consumeReauth(admin, playerId, token, Date.now())
    },
    readKey: readStripeKey,
    isLive: isLiveStripeKey,
    testOnly: CHECKOUT_TEST_ONLY,
    async saveCart(row) {
      const { data, error } = await admin
        .from('carts')
        .insert({
          player_id: row.playerId,
          status: 'pending',
          holds_starter: row.holdsStarter,
          gift_mode: row.giftMode,
          gift_child_id: row.giftChildId,
          expires_at: row.expiresAt,
        })
        .select('id')
        .single()
      if (error || !data) return 'unavailable'
      const id = String((data as { id: string }).id)
      const { error: itemError } = await admin.from('cart_items').insert(
        row.items.map((item) => ({ cart_id: id, sku: item.sku, qty: item.qty })),
      )
      if (itemError) {
        await admin.from('carts').update({ status: 'cancelled' }).eq('id', id)
        return 'unavailable'
      }
      return { id }
    },
    async cancelCart(id) {
      await admin.from('carts').update({ status: 'cancelled' }).eq('id', id)
    },
    async createSession(input) {
      const key = readStripeKey()
      if (!key) return { url: null }
      const stripe = stripeClient(key)
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          client_reference_id: input.cartId,
          adaptive_pricing: { enabled: input.plan.adaptivePricing },
          line_items: input.plan.items.map((item) => (
            item.stripePriceId
              ? { price: item.stripePriceId, quantity: item.qty }
              : {
                  quantity: item.qty,
                  price_data: {
                    currency: input.plan.currency,
                    unit_amount: item.unitAmount,
                    product_data: { name: 'Starter Pack', description: '8,000 coins and 5 treats' },
                  },
                }
          )),
          metadata: {
            cart_id: input.cartId,
            user_id: input.playerId,
            device_ua_hash: input.deviceUaHash || '',
            ip_hash: input.ipHash || '',
          },
          customer_email: input.email || undefined,
          success_url: `${siteBase()}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteBase()}/?checkout=cancel`,
          expires_at: Math.floor(Date.parse(input.expiresAt) / 1000),
        },
        { idempotencyKey: input.cartId },
      )
      return { url: session.url }
    },
  }
}

export async function handleCart(req: Request, deps: CartDeps | null = productionCartDeps()): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const catalog = deps?.catalog ?? PRODUCT_CATALOG
  const country = deps ? deps.country(req) : requestCountry(req)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const structural = validateCart(body, catalog, country, 0)
  if (!structural.ok) {
    return json({ error: structural.error, currency: structural.currency }, STATUS[structural.error] ?? 422)
  }
  if (!deps) return json({ error: 'unavailable' }, 503)

  const playerId = await deps.userId(bearer(req))
  if (!playerId) return json({ error: 'Sign in first.' }, 401)
  const recipient = receivingAccount(playerId, structural.plan)
  const prior = recipient ? await deps.starterCount(recipient) : 0
  if (prior === 'unavailable') return json({ error: 'unavailable' }, 503)
  const owned = validateCart(body, catalog, country, prior)
  if (!owned.ok) return json({ error: owned.error, currency: owned.currency }, STATUS[owned.error] ?? 422)

  const loaded = await deps.payRow(playerId)
  if (!loaded.ok) return json({ ok: false, error: loaded.error }, loaded.status)
  const reauthToken = typeof (body as { reauth_token?: unknown }).reauth_token === 'string'
    ? (body as { reauth_token: string }).reauth_token
    : ''
  const gate = checkoutAllowed({
    signedIn: true,
    paymentsEnabled: loaded.row.paymentsEnabled,
    parentLocked: loaded.row.parentLocked,
    age13Plus: loaded.row.age13Plus,
    ownerAdult: loaded.row.ownerAdult,
    reauthOk: reauthToken.length >= 20,
    country,
    requireReauth: true,
  })
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status)

  const key = deps.readKey()
  if (!key) return json({ error: PURCHASES_UNAVAILABLE }, 503)
  if (deps.testOnly && deps.isLive(key)) return json({ error: 'Checkout is in test mode. A live key is not accepted yet.' }, 503)
  if (!(await deps.consumeReauth(playerId, reauthToken))) {
    return json({ ok: false, error: 'Enter your password, PIN, or passkey to buy.' }, 401)
  }

  const expiresAt = new Date(deps.now() + CART_TTL_MS).toISOString()
  const saved = await deps.saveCart({
    playerId,
    holdsStarter: owned.plan.holdsStarter,
    giftMode: owned.plan.giftMode,
    giftChildId: owned.plan.giftChildId,
    expiresAt,
    items: owned.plan.items.map((item) => ({ sku: item.sku, qty: item.qty })),
  })
  if (saved === 'unavailable') return json({ error: 'unavailable' }, 503)
  try {
    const session = await deps.createSession({
      cartId: saved.id,
      playerId,
      plan: owned.plan,
      email: loaded.row.email,
      expiresAt,
      deviceUaHash: hashUa(req.headers.get('user-agent') ?? ''),
      ipHash: hashIp(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || ''),
    })
    if (!session.url) {
      await deps.cancelCart(saved.id)
      return json({ error: PURCHASES_UNAVAILABLE }, 502)
    }
    return json({ cart_id: saved.id, url: session.url, currency: owned.plan.currency })
  } catch {
    await deps.cancelCart(saved.id)
    return json({ error: PURCHASES_UNAVAILABLE }, 502)
  }
}
