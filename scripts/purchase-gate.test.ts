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

test('purchase gate: guests are faded, signed-in buyers enter a PIN, the cap blocks checkout', () => {
  const guest = G.purchaseGate({ signedIn: false })
  assert.equal(guest.mode, 'sign-in')
  assert.equal(guest.label, 'Sign in to buy')
  assert.equal(guest.faded, true)
  assert.equal(guest.canCheckout, false)

  const signedIn = G.purchaseGate({ signedIn: true, priceCadCents: 699 })
  assert.equal(signedIn.mode, 'pin')
  assert.equal(signedIn.label, 'Buy')
  assert.equal(signedIn.faded, false)
  assert.equal(signedIn.canCheckout, false)

  const capped = G.purchaseGate({ signedIn: true, spentCadCents: 4500, priceCadCents: 699 })
  assert.equal(capped.mode, 'capped')
  assert.equal(capped.faded, true)
  assert.equal(capped.label, 'Weekly limit reached')
  assert.equal(capped.canCheckout, false)
})

test('buy buttons and checkout require sign-in, the purchase PIN, and the weekly cap', () => {
  assert.match(shortfall, /Sign in to buy|buyLabel/)
  assert.match(shortfall, /is-faded/)
  assert.match(app, /purchaseGate\(/)
  assert.match(app, /roman:open-sign-in/)
  assert.match(app, /PurchasePinSheet/)
  assert.doesNotMatch(app, /ParentalGate/)
  assert.match(checkout, /userIdFromRequest/)
  assert.match(checkout, /pinGrant/)
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
