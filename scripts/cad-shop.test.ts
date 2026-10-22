import assert from 'node:assert/strict'
import { test } from 'node:test'
import { savingsCents, SHOP_OFFERS, shopOfferById, starterPriceCents, SUPPORT_ADDRESS } from '../src/game/shopOffers.ts'

test('the starter pack can be bought again at a stepped price with the same contents', () => {
  const starter = shopOfferById('starter')
  assert.ok(starter)
  assert.equal(starter.once, false)
  assert.equal(starter.coins, 8000)
  assert.equal(starter.treats, 5)
  assert.deepEqual([...starter.pets], [])
  assert.deepEqual([...starter.contents], ['8,000 coins', '5 treats'])
  assert.equal(starterPriceCents('cad', 0), 299)
  assert.equal(starterPriceCents('cad', 1), 349)
  assert.equal(starterPriceCents('cad', 2), 449)
  assert.equal(starterPriceCents('cad', 8), 449)
  assert.equal(starterPriceCents('usd', 0), 149)
  assert.equal(starterPriceCents('usd', 1), 199)
  assert.equal(starterPriceCents('usd', 4), 249)
  assert.ok(savingsCents(starter) > 0)
  assert.deepEqual(SHOP_OFFERS.map((o) => o.cadCents), [199, 499, 999, 299, 699, 1499])
  assert.equal(SUPPORT_ADDRESS, 'Funderwood, 6-2160 Highway 7, Suite 639, Vaughan, ON L4K 1W6, Canada')
})

test('checkout refuses a live Stripe key and coin-credit claims on the server', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_live_not_for_this_preview'
  const checkout = await import('../netlify/functions/create-checkout.ts')
  const res = await checkout.default(new Request('https://play.romansgame.com/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packId: 'coins_500' }),
  }))
  assert.equal(res.status, 503)
  const body = await res.json() as { error?: string }
  assert.match(body.error || '', /test mode/)

  const credit = await import('../netlify/functions/coin-credit.ts')
  const claim = await credit.default(new Request('https://play.romansgame.com/api/coin-credit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'cs_live_abc123' }),
  }))
  assert.equal(claim.status, 400)
  delete process.env.STRIPE_SECRET_KEY
})
