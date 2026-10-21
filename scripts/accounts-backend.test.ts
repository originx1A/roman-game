import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  cancelGiftCode,
  grantCheckout,
  memoryLedger,
  redeemGiftCode,
  revokeCharge,
  STRIPE_TEST_ROMAN_PRODUCTS,
  type CompletedSession,
} from '../netlify/lib/accountsLedger.ts'
import { enablePaymentsDecision, parentSlotsLeft, parentSwitch, parseSaveBody } from '../netlify/lib/accountsRules.ts'
import { webPackById } from '../netlify/lib/coinPacks.ts'
import { checkoutAllowed } from '../netlify/lib/payGate.ts'
import { PASSKEY_RP_ID, passkeyRequest } from '../netlify/lib/passkeyRp.ts'
import { handleCreateCheckout, type CheckoutDeps, type CheckoutSessionInput } from '../netlify/functions/create-checkout.ts'
import { handleSaveProgress } from '../netlify/functions/save-progress.ts'
import { handleStripeWebhook, type InboundEvent } from '../netlify/functions/stripe-webhook.ts'
import { migrateLegacySaveKeys, namespacedStorageKey, DEVICE_WIDE_KEYS } from '../src/game/namespacedSave.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

function session(over: Partial<CompletedSession> = {}): CompletedSession {
  const pack = webPackById('coins_500')!
  return {
    id: 'cs_test_session123',
    livemode: false,
    payment_status: 'paid',
    amount_total: pack.unitAmount,
    currency: pack.currency,
    payment_intent: 'pi_test_123',
    metadata: { packId: pack.id, productId: pack.productId, playerId: 'player-1', purpose: 'self' },
    ...over,
  }
}

const openGate = {
  signedIn: true,
  paymentsEnabled: true,
  parentLocked: false,
  age13Plus: true as boolean | null,
  reauthOk: true,
  country: 'CA',
  requireReauth: true,
}

test('payments stay closed until the account is on, an adult, and not parent-locked', () => {
  assert.equal(checkoutAllowed({ ...openGate, signedIn: false }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, paymentsEnabled: false }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, age13Plus: false }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, age13Plus: null }).ok, false)
  const locked = checkoutAllowed({ ...openGate, parentLocked: true })
  assert.equal(locked.ok, false)
  if (!locked.ok) assert.equal(locked.status, 403)
  const missing = checkoutAllowed({ ...openGate, reauthOk: false })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.status, 401)
  assert.equal(checkoutAllowed({ ...openGate, country: 'FR' }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, country: 'GB' }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, country: null }).ok, true)
  assert.equal(checkoutAllowed({ ...openGate, requireReauth: false, reauthOk: false }).ok, true)
  assert.equal(checkoutAllowed(openGate).ok, true)
})

test('a parent lock is sticky and there is no spending cap on an open account', () => {
  assert.deepEqual(parentSwitch({ callerIsParent: false, action: 'off', attested: true }).ok, false)
  assert.deepEqual(parentSwitch({ callerIsParent: true, action: 'off', attested: true }), {
    ok: true,
    parentLocked: true,
    paymentsEnabled: false,
  })
  assert.deepEqual(parentSwitch({ callerIsParent: true, action: 'on', attested: true }), {
    ok: true,
    parentLocked: false,
    paymentsEnabled: true,
  })
  assert.deepEqual(parentSwitch({ callerIsParent: true, action: 'on', attested: false }), {
    ok: true,
    parentLocked: false,
    paymentsEnabled: false,
  })
  const kid = enablePaymentsDecision({
    adult: true,
    terms: true,
    email: 'parent@example.com',
    age13Plus: true,
    parentLocked: true,
  })
  assert.equal(kid.ok, false)
  assert.equal(enablePaymentsDecision({ adult: false, terms: true, email: 'a@b.co', age13Plus: true, parentLocked: false }).ok, false)
  assert.equal(enablePaymentsDecision({ adult: true, terms: true, email: 'kid@link.romansgame.invalid', age13Plus: true, parentLocked: false }).ok, false)
  assert.equal(enablePaymentsDecision({ adult: true, terms: true, email: 'parent@example.com', age13Plus: true, parentLocked: false }).ok, true)
  assert.equal(parentSlotsLeft(2), false)
  assert.equal(parentSlotsLeft(1), true)
  const gateSrc = read('../netlify/lib/payGate.ts')
  assert.doesNotMatch(gateSrc, /spending cap|dailyCap|daily_cap/i)
})

test('checkout refuses a closed account before it asks Stripe, and a live key stays refused', async () => {
  const calls: CheckoutSessionInput[] = []
  const deps = (row: CheckoutDeps['payRow']): CheckoutDeps => ({
    readKey: () => 'sk_test_example',
    isLive: () => false,
    testOnly: true,
    userId: async () => 'player-1',
    payRow: row,
    consumeReauth: async () => true,
    ownsPack: async () => false,
    async createSession(input) {
      calls.push(input)
      return { url: 'https://checkout.stripe.com/c/pay/cs_test_ok' }
    },
  })
  const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://play.romansgame.com/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token', ...headers },
    body: JSON.stringify(body),
  })
  const closed = await handleCreateCheckout(post({ packId: 'coins_500', reauthToken: 'x'.repeat(24), skipReauth: true }), deps(async () => ({
    ok: true,
    row: { paymentsEnabled: false, parentLocked: false, age13Plus: true, email: 'a@b.co', attested: false },
  })))
  assert.equal(closed.status, 403)
  assert.equal(calls.length, 0)

  const locked = await handleCreateCheckout(post({ packId: 'coins_3200', reauthToken: 'x'.repeat(24) }), deps(async () => ({
    ok: true,
    row: { paymentsEnabled: true, parentLocked: true, age13Plus: true, email: 'a@b.co', attested: true },
  })))
  assert.equal(locked.status, 403)
  assert.equal(calls.length, 0)

  const blockedCountry = await handleCreateCheckout(post({ packId: 'coins_500', reauthToken: 'x'.repeat(24) }, { 'x-country': 'DE' }), deps(async () => ({
    ok: true,
    row: { paymentsEnabled: true, parentLocked: false, age13Plus: true, email: 'a@b.co', attested: true },
  })))
  assert.equal(blockedCountry.status, 403)

  const bought = await handleCreateCheckout(post({ packId: 'coins_500', reauthToken: 'x'.repeat(24), unitAmount: 1 }), deps(async () => ({
    ok: true,
    row: { paymentsEnabled: true, parentLocked: false, age13Plus: true, email: 'parent@example.com', attested: true },
  })))
  assert.equal(bought.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].unitAmount, 199)
  assert.equal(calls[0].currency, 'cad')
  assert.equal(calls[0].purpose, 'self')
  const src = read('../netlify/functions/create-checkout.ts')
  assert.match(src, /excluded_payment_method_types:\s*\['link'\]/)
  assert.match(src, /display:\s*'never'/)
  assert.match(src, /request_three_d_secure:\s*'any'/)
  assert.match(src, /billing_address_collection:\s*'required'/)
  assert.doesNotMatch(src, /(?<!excluded_)payment_method_types/)
  assert.match(read('../netlify/functions/confirm-checkout.ts'), /requireCheckoutGate/)
  assert.match(read('../netlify/functions/coin-credit.ts'), /requireCheckoutGate/)

  const live = await handleCreateCheckout(post({ packId: 'coins_500' }), {
    ...deps(async () => ({ ok: true, row: { paymentsEnabled: true, parentLocked: false, age13Plus: true, email: null, attested: true } })),
    readKey: () => 'sk_live_not_for_this_preview',
    isLive: () => true,
  })
  assert.equal(live.status, 503)
  const body = await live.json() as { error?: string }
  assert.match(body.error || '', /test mode/)
})

test('a paid checkout grants once, a refund and a dispute take it back', async () => {
  const ledger = memoryLedger()
  const paid = session()
  const first = await grantCheckout(ledger, paid)
  assert.equal(first.ok, true)
  if (first.ok) assert.equal(first.coins, 500)
  assert.equal(ledger.balances.get('player-1'), 500)
  assert.equal(ledger.entitlements.filter((row) => !row.revokedAt).length, 1)
  const again = await grantCheckout(ledger, paid)
  assert.equal(again.ok && again.duplicate, true)
  assert.equal(ledger.balances.get('player-1'), 500)

  const mismatch = await grantCheckout(ledger, session({ id: 'cs_test_badamount', amount_total: 1, payment_intent: 'pi_bad' }))
  assert.equal(mismatch.ok, false)
  const live = await grantCheckout(ledger, session({ id: 'cs_test_liveignored', livemode: true, payment_intent: 'pi_live' }))
  assert.equal(live.ok && live.ignored, 'live')

  const revoked = await revokeCharge(ledger, { id: 'ch_1', payment_intent: 'pi_test_123', livemode: false })
  assert.equal(revoked.ok, true)
  assert.equal(ledger.purchases[0].status, 'revoked')
  assert.equal(ledger.entitlements[0].revokedAt == null, false)
  assert.equal(ledger.balances.get('player-1'), 0)

  const giftSession = session({
    id: 'cs_test_gift1',
    payment_intent: 'pi_gift',
    metadata: { packId: 'coins_1400', productId: 'roman.cad.coins.1400', playerId: 'buyer', purpose: 'gift' },
    amount_total: webPackById('coins_1400')!.unitAmount,
  })
  const minted = await grantCheckout(ledger, giftSession)
  assert.equal(minted.ok, true)
  if (!minted.ok || !minted.giftCode) throw new Error('expected a gift code')
  assert.equal(ledger.balances.get('buyer') ?? 0, 0)
  const old = ledger.gifts[0]
  old.createdAt = '2020-01-01T00:00:00.000Z'
  const redeemed = await redeemGiftCode(ledger, minted.giftCode, 'kid-1')
  assert.equal(redeemed.ok, true)
  if (redeemed.ok) assert.equal(redeemed.coins, 1400)
  assert.equal(ledger.gifts[0].redeemedBy, 'kid-1')
  const second = await redeemGiftCode(ledger, minted.giftCode, 'kid-2')
  assert.equal(second.ok, false)
  if (!second.ok) assert.equal(second.status, 409)
  assert.equal(ledger.gifts[0].redeemedBy, 'kid-1')
  const taken = await revokeCharge(ledger, { id: 'ch_gift', payment_intent: 'pi_gift', livemode: false })
  assert.equal(taken.ok, true)
  assert.equal(ledger.gifts[0].status, 'void')
  assert.equal(ledger.balances.get('kid-1'), 0)

  const fresh = memoryLedger()
  const unused = await grantCheckout(fresh, session({
    id: 'cs_test_gift2',
    payment_intent: 'pi_gift2',
    metadata: { packId: 'starter', productId: 'roman.cad.bundle.starter', playerId: 'buyer-2', purpose: 'gift' },
    amount_total: webPackById('starter')!.unitAmount,
  }))
  if (!unused.ok || !unused.giftCode) throw new Error('expected a code')
  await revokeCharge(fresh, { id: 'ch_2', payment_intent: 'pi_gift2', livemode: false })
  const afterVoid = await redeemGiftCode(fresh, unused.giftCode, 'kid-3')
  assert.equal(afterVoid.ok, false)
  const cancelled = memoryLedger()
  const another = await grantCheckout(cancelled, session({
    id: 'cs_test_gift3',
    payment_intent: 'pi_gift3',
    metadata: { packId: 'coins_500', productId: 'roman.cad.coins.500', playerId: 'buyer-3', purpose: 'gift' },
  }))
  if (!another.ok || !another.giftCode) throw new Error('expected a code')
  assert.equal((await cancelGiftCode(cancelled, another.giftCode, 'buyer-3')).ok, true)
  assert.equal((await redeemGiftCode(cancelled, another.giftCode, 'kid-4')).ok, false)
})

test('the webhook grants and revokes, and a bad signature is rejected', async () => {
  const ledger = memoryLedger()
  const paid = session({ id: 'cs_test_hook1', payment_intent: 'pi_hook' })
  const event: InboundEvent = { id: 'evt_1', type: 'checkout.session.completed', livemode: false, session: paid }
  const deps = {
    secret: 'whsec_test',
    testOnly: true,
    readKey: () => 'sk_test_example',
    isLive: () => false,
    construct: () => event,
    ledger: () => ledger,
  }
  const ok = await handleStripeWebhook(new Request('https://play.romansgame.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=abc' },
    body: '{}',
  }), deps)
  assert.equal(ok.status, 200)
  assert.equal(ledger.balances.get('player-1'), 500)
  const dup = await handleStripeWebhook(new Request('https://play.romansgame.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=abc' },
    body: '{}',
  }), deps)
  assert.equal(dup.status, 200)
  assert.equal(ledger.balances.get('player-1'), 500)

  const dispute = await handleStripeWebhook(new Request('https://play.romansgame.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=abc' },
    body: '{}',
  }), {
    ...deps,
    construct: () => ({ id: 'evt_2', type: 'charge.dispute.created', livemode: false, charge: { id: 'dp_1', payment_intent: 'pi_hook', livemode: false } }),
  })
  assert.equal(dispute.status, 200)
  assert.equal(ledger.purchases[0].status, 'revoked')
  assert.equal(ledger.balances.get('player-1'), 0)

  const bad = await handleStripeWebhook(new Request('https://play.romansgame.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'nope' },
    body: '{}',
  }), { ...deps, construct: () => { throw new Error('bad signature') } })
  assert.equal(bad.status, 400)
})

test('migration 008 adds saves and payments without touching players or PR 59 functions', () => {
  const sql = read('../supabase/migration-008-accounts-payments.sql')
  assert.match(sql, /migration-005-leaderboard\.sql/)
  assert.match(sql, /migration-006-social\.sql/)
  assert.match(sql, /migration-007-cad-shop\.sql/)
  assert.doesNotMatch(sql, /alter table public\.players/i)
  assert.doesNotMatch(sql, /update public\.players/i)
  assert.doesNotMatch(sql, /delete from public\./i)
  assert.doesNotMatch(sql, /create or replace function public\.apply_stripe_credit/)
  assert.doesNotMatch(sql, /create or replace view public\.public_scores/)
  assert.doesNotMatch(sql, /function public\.submit_score/)
  assert.match(sql, /proname = 'save_progress'/)
  assert.match(sql, /left unchanged/)
  assert.match(sql, /player_saves/)
  assert.match(sql, /primary key \(player_id, profile_id\)/)
  assert.match(sql, /site_progress/)
  assert.match(sql, /profile_id/)
  assert.match(sql, /if n >= 2 then/)
  assert.match(sql, /parent_locked/)
  const gift = sql.slice(sql.indexOf('-- 6. Gift codes'), sql.indexOf('-- 7. Recovery'))
  assert.doesNotMatch(gift, /expir/i)
  assert.match(gift, /redeemed_by/)
  assert.match(sql, /revoke_stripe_coins/)
})

test('passkeys use the romansgame.com relying party on every subdomain', () => {
  assert.equal(PASSKEY_RP_ID, 'romansgame.com')
  const play = passkeyRequest(new Request('https://play.romansgame.com/api/passkey', { headers: { host: 'play.romansgame.com' } }))
  const root = passkeyRequest(new Request('https://romansgame.com/api/passkey', { headers: { host: 'romansgame.com' } }))
  assert.equal(play?.rpID, 'romansgame.com')
  assert.equal(play?.origin, 'https://play.romansgame.com')
  assert.equal(root?.rpID, 'romansgame.com')
  assert.equal(passkeyRequest(new Request('https://evil.example/api/passkey', { headers: { host: 'evil.example' } })), null)
  const src = read('../netlify/functions/passkey.ts')
  assert.match(src, /PASSKEY_RP_ID/)
  assert.doesNotMatch(src, /rpID:\s*hostname/)
  assert.doesNotMatch(src, /play\.romansgame\.com/)
})

test('the CAD catalog does not use the inactive USD Stripe test products', () => {
  const bag = STRIPE_TEST_ROMAN_PRODUCTS[0]
  const vault = STRIPE_TEST_ROMAN_PRODUCTS[1]
  const small = webPackById('coins_500')!
  assert.equal(bag.active, false)
  assert.equal(bag.currency, 'usd')
  assert.notEqual(small.unitAmount, bag.unitAmount)
  assert.equal(small.currency, 'cad')
  assert.equal(vault.coins, 3000)
  assert.equal(webPackById('coins_3200')!.coins, 3200)
  const checkout = read('../netlify/functions/create-checkout.ts')
  for (const product of STRIPE_TEST_ROMAN_PRODUCTS) {
    assert.doesNotMatch(checkout, new RegExp(product.priceId))
    assert.doesNotMatch(checkout, new RegExp(product.id))
  }
})

test('legacy device keys move under roman.<player>.<profile> and do not follow the next sibling', () => {
  const data = new Map<string, string>([
    ['roman.wallet.v1', '{"coins":40}'],
    ['roman.pets.v1', '{"owned":{}}'],
    ['rg.profiles.v1', '[{"userId":"p1"}]'],
    ['rg.profiles.active', 'p1'],
  ])
  const store = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
  const moved = migrateLegacySaveKeys(store, 'player-1', 'main', ['roman.wallet.v1', 'roman.pets.v1', ...DEVICE_WIDE_KEYS])
  assert.deepEqual(moved.sort(), ['roman.pets.v1', 'roman.wallet.v1'])
  assert.equal(data.get(namespacedStorageKey('player-1', 'main', 'roman.wallet.v1')), '{"coins":40}')
  assert.equal(data.has('roman.wallet.v1'), false)
  assert.equal(data.get('rg.profiles.v1'), '[{"userId":"p1"}]')
  migrateLegacySaveKeys(store, 'player-2', 'main', ['roman.wallet.v1', 'roman.pets.v1'])
  assert.equal(data.has(namespacedStorageKey('player-2', 'main', 'roman.wallet.v1')), false)
  assert.equal(data.get(namespacedStorageKey('player-1', 'main', 'roman.wallet.v1')), '{"coins":40}')
})

test('save-progress keeps email out of the blob and writes only this player', async () => {
  assert.equal(parseSaveBody({ profileId: 'main', blob: { note: 'hi@example.com' }, chapters: [], videos: [], cards: [] }).ok, false)
  const saved = new Map<string, { blob: Record<string, unknown>; chapters: string[] }>()
  const res = await handleSaveProgress(new Request('https://play.romansgame.com/api/save-progress', {
    method: 'POST',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify({ profileId: 'main', blob: { coins: 3 }, chapters: ['harbor'], videos: [], cards: ['unseen'] }),
  }), {
    userId: async () => 'player-1',
    async write(playerId, profileId, blob, chapters) {
      saved.set(`${playerId}:${profileId}`, { blob, chapters })
      return true
    },
    async read() {
      return null
    },
  })
  assert.equal(res.status, 200)
  assert.equal(saved.get('player-1:main')?.chapters[0], 'harbor')
  const anon = await handleSaveProgress(new Request('https://play.romansgame.com/api/save-progress', { method: 'GET' }), {
    userId: async () => null,
    async write() { return false },
    async read() { return null },
  })
  assert.equal(anon.status, 401)
})
