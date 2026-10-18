import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

register('./ts-resolve.mjs', import.meta.url)
const P = await import('../src/game/purchasePin.ts')
const H = await import('../netlify/lib/pinHash.ts')
const W = await import('../netlify/lib/checkoutWallets.ts')

const checkout = readFileSync(new URL('../netlify/functions/create-checkout.ts', import.meta.url), 'utf8')
const pinFn = readFileSync(new URL('../netlify/functions/purchase-pin.ts', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('../src/components/PurchasePinSheet.tsx', import.meta.url), 'utf8')

test('a purchase PIN is 4 digits, locks after 5 misses, and a reset needs the email sign-in', () => {
  assert.equal(P.isFourDigitPin('1234'), true)
  assert.equal(P.isFourDigitPin('123'), false)
  assert.equal(P.isFourDigitPin('12a4'), false)
  assert.equal(P.isFourDigitPin('12345'), false)
  assert.equal(P.emailIsVerified('parent@example.com', null, '2026-10-18T12:00:00.000Z'), true)
  assert.equal(P.emailIsVerified('parent@example.com', '2026-10-18T12:00:00.000Z', null), true)
  assert.equal(P.emailIsVerified('parent@example.com', null, null), false)
  assert.equal(P.emailIsVerified('not-an-email', '2026-10-18T12:00:00.000Z', null), false)
  assert.equal(P.emailIsVerified('', null, '2026-10-18T12:00:00.000Z'), false)

  const now = 1_000_000
  let state = P.emptyPinFails()
  for (let i = 0; i < 4; i++) state = P.noteWrongPin(state, now)
  assert.equal(P.pinLocked(state, now).locked, false)
  state = P.noteWrongPin(state, now)
  const locked = P.pinLocked(state, now)
  assert.equal(locked.locked, true)
  assert.equal(locked.retryInMs, P.PIN_LOCK_MS)
  assert.match(P.lockMessage(locked.retryInMs), /15 minutes/)
  const again = P.noteWrongPin(state, now + 1000)
  assert.equal(again.lockedUntil, state.lockedUntil)
  const after = P.normalizePinFails(state, now + P.PIN_LOCK_MS)
  assert.equal(after.fails, 0)
  assert.equal(P.pinLocked(after, now + P.PIN_LOCK_MS).locked, false)
  assert.deepEqual(P.noteRightPin(), P.emptyPinFails())

  const asked = now
  assert.equal(P.resetUnlockedByEmail(asked, asked - 60_000, asked + 1000), false)
  assert.equal(P.resetUnlockedByEmail(asked, asked + 1000, asked + 1000), true)
  assert.equal(P.resetUnlockedByEmail(asked, asked + 1000, asked + P.PIN_RESET_MS), false)
})

test('the stored PIN is a salted hash, not the digits', async () => {
  const stored = await H.hashPin('2468')
  assert.notEqual(stored, '2468')
  assert.equal(stored.startsWith('scrypt$'), true)
  assert.equal(await H.pinMatches('2468', stored), true)
  assert.equal(await H.pinMatches('2469', stored), false)
  assert.equal(await H.pinMatches('2468', 'nope'), false)
})

test('checkout asks for the PIN grant and does not save a card or turn on Link', () => {
  assert.match(checkout, /pinGrant/)
  assert.match(checkout, /consumePinGrant/)
  assert.doesNotMatch(checkout, /grownUp/)
  assert.equal(W.CHECKOUT_WALLETS.payment_method_types[0], 'card')
  assert.equal(W.CHECKOUT_WALLETS.wallet_options.link.display, 'never')
  assert.equal(W.CHECKOUT_WALLETS.saved_payment_method_options.payment_method_save, 'disabled')
  assert.equal(W.CHECKOUT_WALLETS.payment_method_options.card.setup_future_usage, 'none')
  assert.equal('customer' in W.CHECKOUT_WALLETS, false)
  assert.match(checkout, /CHECKOUT_WALLETS/)
  assert.match(pinFn, /sendSignInLink/)
  assert.match(pinFn, /emailVerified/)
  assert.match(pinFn, /Confirm the sign-in email/)
  assert.match(sheet, /Email a reset link/)
  assert.doesNotMatch(sheet, /ParentalGate|grownUpQuestion/)
})
