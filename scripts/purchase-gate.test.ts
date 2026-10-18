import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

register('./ts-resolve.mjs', import.meta.url)
const G = await import('../src/game/purchaseGate.ts')
const K = await import('../src/game/perkBadges.ts')

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const shortfall = readFileSync(new URL('../src/components/ShortfallSheet.tsx', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('../netlify/functions/create-checkout.ts', import.meta.url), 'utf8')

test('purchase gate: guests are faded, grown-ups go first, the cap blocks checkout', () => {
  const guest = G.purchaseGate({ signedIn: false, grownUpOk: false })
  assert.equal(guest.label, 'Sign in to buy')
  assert.equal(guest.faded, true)
  assert.equal(guest.canCheckout, false)

  const kid = G.purchaseGate({ signedIn: true, grownUpOk: false, priceCadCents: 699 })
  assert.equal(kid.mode, 'grown-up')
  assert.equal(kid.label, 'Ask a grown-up')
  assert.equal(kid.canCheckout, false)

  const ready = G.purchaseGate({ signedIn: true, grownUpOk: true, spentCadCents: 0, priceCadCents: 699 })
  assert.equal(ready.canCheckout, true)
  assert.equal(ready.label, 'Buy')

  const capped = G.purchaseGate({ signedIn: true, grownUpOk: true, spentCadCents: 4500, priceCadCents: 699 })
  assert.equal(capped.mode, 'capped')
  assert.equal(capped.faded, true)
  assert.equal(capped.label, 'Weekly limit reached')
})

test('grown-up check is a real question and expires', () => {
  const q = G.grownUpQuestion(7)
  assert.equal(q.answer, q.a * q.b)
  assert.equal(G.checkGrownUp(q, String(q.answer), true), true)
  assert.equal(G.checkGrownUp(q, String(q.answer), false), false)
  assert.equal(G.checkGrownUp(q, 'nope', true), false)
  const now = 1_000_000
  assert.equal(G.grownUpStillOk(now, now + G.GROWN_UP_MS - 1), true)
  assert.equal(G.grownUpStillOk(now, now + G.GROWN_UP_MS), false)
  assert.equal(G.grownUpStillOk(null, now), false)
})

test('buy buttons and checkout require sign-in, a grown-up, and the weekly cap', () => {
  assert.match(shortfall, /Sign in to buy|buyLabel/)
  assert.match(shortfall, /is-faded/)
  assert.match(app, /purchaseGate\(/)
  assert.match(app, /roman:open-sign-in/)
  assert.match(app, /ParentalGate/)
  assert.match(checkout, /userIdFromRequest/)
  assert.match(checkout, /grownUp/)
  assert.match(checkout, /canSpend/)
  assert.match(checkout, /Weekly spending limit|cap\.reason/)
})

test('perk badges are paid only and flag a run assisted', () => {
  const granted = K.grantPerk(K.emptyPerks(), 'lucky_laurel', 'coins', 1)
  assert.equal(granted.ok, false)
  const paid = K.grantPerk(K.emptyPerks(), 'lucky_laurel', 'purchase', 1)
  assert.equal(paid.ok, true)
  assert.equal(K.runIsAssisted({ hintsUsed: 0, rescuesUsed: 0 }), false)
  assert.equal(K.runIsAssisted({ perkBadgeActive: true }), true)
  assert.equal(K.runIsAssisted({ hintsUsed: 1 }), true)
  assert.match(app, /runIsAssisted\(/)
})
