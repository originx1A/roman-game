import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { handleCart, type CartDeps, type CartSessionInput } from '../netlify/lib/cartHandler.ts'
import { validateCart } from '../netlify/lib/cartValidate.ts'
import { PRODUCT_CATALOG, type Catalog } from '../netlify/lib/productCatalog.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

function decisionError(body: unknown, country: string | null, held = false): string | null {
  const decision = validateCart(body, PRODUCT_CATALOG, country, held)
  return decision.ok ? null : decision.error
}

test('the price file has empty USD and CAD lists and matches the bundled copy', () => {
  const parsed = JSON.parse(read('../config/products.json')) as Catalog
  assert.equal(parsed.adaptivePricing, true)
  assert.deepEqual(parsed, PRODUCT_CATALOG)
  assert.equal(parsed.lists.usd.currency, 'usd')
  assert.equal(parsed.lists.usd.buyers, 'US')
  assert.equal(parsed.lists.cad.currency, 'cad')
  assert.equal(parsed.lists.cad.buyers, 'everyone_else')
  for (const list of [parsed.lists.usd, parsed.lists.cad]) {
    for (const product of list.products) {
      assert.equal(product.unitAmount, null)
      assert.equal(product.stripePriceId, '')
    }
  }
  assert.equal(/"unitAmount":\s*[0-9]/.test(read('../config/products.json')), false)
})

test('cart rules reject a bad quantity, an unknown SKU, and a second starter', () => {
  assert.equal(decisionError({ items: [{ sku: 'coins_500', qty: 6 }] }, 'CA'), 'bad_qty')
  assert.equal(decisionError({ items: [{ sku: 'made-up', qty: 1 }] }, 'CA'), 'unknown_sku')
  assert.equal(decisionError({ items: [{ sku: 'starter_bundle', qty: 2 }] }, 'CA'), 'starter_qty')
  assert.equal(decisionError({ items: [{ sku: 'starter_bundle', qty: 1 }] }, 'CA', true), 'starter_owned')
  assert.equal(decisionError({ items: Array.from({ length: 11 }, () => ({ sku: 'coins_500', qty: 1 })) }, 'US'), 'too_many_lines')
  const priced = validateCart(
    { items: [{ sku: 'coins_500', qty: 1, price: 1, currency: 'eur', unitAmount: 1 }] },
    PRODUCT_CATALOG,
    'US',
    false,
  )
  assert.equal(priced.ok, false)
  if (!priced.ok) assert.equal(priced.currency, 'usd')
  assert.equal(JSON.stringify(priced).includes('eur'), false)
  const canada = validateCart({ items: [{ sku: 'coins_500', qty: 1 }] }, PRODUCT_CATALOG, null, false)
  assert.equal(canada.ok, false)
  if (!canada.ok) {
    assert.equal(canada.error, 'prices_not_ready')
    assert.equal(canada.currency, 'cad')
  }
})

function pricedCatalog(): Catalog {
  return {
    adaptivePricing: true,
    lists: {
      usd: {
        currency: 'usd',
        buyers: 'US',
        products: [{ sku: 'coins_500', stripePriceId: 'price_usd_500', unitAmount: 250 }],
      },
      cad: {
        currency: 'cad',
        buyers: 'everyone_else',
        products: [{ sku: 'coins_500', stripePriceId: 'price_cad_500', unitAmount: 300 }],
      },
    },
  }
}

function deps(catalog: Catalog, country: string | null): { auth: CartDeps; sessions: CartSessionInput[] } {
  const sessions: CartSessionInput[] = []
  return {
    sessions,
    auth: {
      now: () => Date.parse('2026-10-21T16:00:00.000Z'),
      catalog,
      country: () => country,
      userId: async () => 'player-1',
      payRow: async () => ({
        ok: true,
        row: { paymentsEnabled: true, parentLocked: false, age13Plus: true, email: null },
      }),
      starterHeld: async () => false,
      consumeReauth: async () => true,
      readKey: () => 'sk_test_123',
      isLive: () => false,
      testOnly: true,
      saveCart: async () => ({ id: 'cart-1' }),
      cancelCart: async () => undefined,
      createSession: async (input) => {
        sessions.push(input)
        return { url: 'https://checkout.stripe.test/session' }
      },
    },
  }
}

test('an unpriced cart does not open Stripe', async () => {
  const { auth, sessions } = deps(PRODUCT_CATALOG, 'CA')
  const res = await handleCart(post({ items: [{ sku: 'coins_500', qty: 1, price: 50 }] }, 'CA'), auth)
  assert.equal(res.status, 409)
  const body = (await res.json()) as { error: string; currency: string }
  assert.equal(body.error, 'prices_not_ready')
  assert.equal(body.currency, 'cad')
  assert.equal(sessions.length, 0)
})

test('a priced cart uses the config price id and Adaptive Pricing', async () => {
  const { auth, sessions } = deps(pricedCatalog(), 'US')
  const res = await handleCart(
    post({ items: [{ sku: 'coins_500', qty: 2, price: 1 }], reauth_token: 'reauth-token-value-ok' }, 'US'),
    auth,
  )
  assert.equal(res.status, 200)
  const body = (await res.json()) as { cart_id: string; currency: string; url: string }
  assert.equal(body.cart_id, 'cart-1')
  assert.equal(body.currency, 'usd')
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0]?.plan.adaptivePricing, true)
  assert.equal(sessions[0]?.plan.items[0]?.stripePriceId, 'price_usd_500')
  assert.equal(sessions[0]?.plan.items[0]?.unitAmount, 250)
  assert.equal(sessions[0]?.plan.currency, 'usd')
})

function post(body: unknown, country: string): Request {
  return new Request('https://play.romansgame.com/api/cart', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer access-token',
      'x-country': country,
    },
    body: JSON.stringify(body),
  })
}
