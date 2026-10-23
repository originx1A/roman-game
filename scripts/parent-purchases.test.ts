import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { grantLinkedChild, type CompletedSession, type Ledger } from '../netlify/lib/accountsLedger.ts'
import { mergeAccountFlags, emptyAccountFlags } from '../netlify/lib/accountFlags.ts'
import { checkoutAllowed } from '../netlify/lib/payGate.ts'
import { attachOwner, clearOwner } from '../netlify/lib/paymentOwner.ts'
import { handlePaymentRemove } from '../netlify/functions/payments-remove.ts'
import { handlePaymentSetup } from '../netlify/functions/payments-setup.ts'
import { handleStripeWebhook, type InboundEvent } from '../netlify/functions/stripe-webhook.ts'
import { PURCHASE_OWNER_NOTICE } from '../src/game/purchaseNotice.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const openGate = {
  signedIn: true,
  paymentsEnabled: true,
  parentLocked: false,
  age13Plus: true as boolean | null,
  reauthOk: true,
  country: null,
  requireReauth: true,
}

test('kid mode cannot spend, and a verified card can', () => {
  assert.equal(checkoutAllowed({ ...openGate, ownerAdult: false }).ok, false)
  assert.equal(checkoutAllowed({ ...openGate, age13Plus: false, ownerAdult: false }).ok, false)
  const adult = checkoutAllowed({ ...openGate, age13Plus: false, paymentsEnabled: false, ownerAdult: true })
  assert.equal(adult.ok, true)
  assert.equal(checkoutAllowed(openGate).ok, true)
  const flags = mergeAccountFlags(emptyAccountFlags(), { email: 'parent@example.com', recovery_email: 'parent@example.com' }, '2026-10-22T00:00:00.000Z')
  assert.equal(flags.ownerRole, null)
  const first = attachOwner(emptyAccountFlags(), '2026-10-22T01:00:00.000Z', 'payer@example.com')
  const second = attachOwner(first, '2026-10-22T02:00:00.000Z', null)
  assert.equal(first.ownerRole, 'adult')
  assert.equal(first.ownerAssumedAt, '2026-10-22T01:00:00.000Z')
  assert.equal(second.ownerAssumedAt, first.ownerAssumedAt)
  assert.equal(clearOwner().ownerRole, null)
  assert.equal(clearOwner().ownerEmail, null)
})

test('the payment step shows one line and the terms draft matches it', () => {
  const notice = PURCHASE_OWNER_NOTICE
  assert.equal(notice, "This account is now yours. You're responsible for all purchases on it.")
  for (const path of ['../src/App.tsx', '../src/components/ShortfallSheet.tsx', '../src/components/CoinPackCard.tsx']) {
    assert.match(read(path), /PURCHASE_OWNER_NOTICE/)
  }
  const terms = read('../docs/terms-parent-purchases.md')
  assert.match(terms, /This account is now yours/)
  assert.match(terms, /Authorized use by anyone the owner lets use the device isn't refundable/)
  assert.match(terms, /recovery only/i)
  assert.match(terms, /kid mode/i)
  assert.match(terms, /device/i)
  assert.doesNotMatch(terms, /I'm the parent\/guardian/)
  assert.doesNotMatch(read('../public/privacy.html'), /PURCHASE_OWNER_NOTICE/)
  assert.doesNotMatch(read('../src/components/LegalLine.tsx'), /This account is now yours/)
  assert.doesNotMatch(read('../src/App.tsx'), /I'm the parent\/guardian/)
})

test('a linked-child cart credits that child and not the buyer', async () => {
  const balances = new Map<string, number>()
  const purchases: { sessionId: string; playerId: string; coins: number }[] = []
  const ledger = {
    async findPurchaseBySession(sessionId: string) {
      return purchases.find((row) => row.sessionId === sessionId) ?? null
    },
    async insertPurchase(row: { sessionId: string; playerId: string; coins: number }) {
      purchases.push({ sessionId: row.sessionId, playerId: row.playerId, coins: row.coins })
    },
    async creditCoins(playerId: string, _op: string, amount: number) {
      balances.set(playerId, (balances.get(playerId) ?? 0) + amount)
    },
  }
  const session: CompletedSession = {
    id: 'cs_test_cartkid',
    livemode: false,
    payment_status: 'paid',
    amount_total: 299,
    currency: 'cad',
    payment_intent: 'pi_cartkid',
    metadata: { cart_id: 'cart-1', user_id: 'buyer-1' },
  }
  const cart = { giftMode: 'linked_child', giftChildId: 'child-1', items: [{ sku: 'starter_bundle', qty: 1 }] }
  const granted = await grantLinkedChild(ledger as unknown as Ledger, session, cart, true)
  assert.equal(granted.ok, true)
  if (granted.ok) assert.equal(granted.coins, 8000)
  assert.equal(balances.get('child-1'), 8000)
  assert.equal(balances.has('buyer-1'), false)
  assert.equal(purchases[0].playerId, 'child-1')
  const refused = await grantLinkedChild(ledger as unknown as Ledger, { ...session, id: 'cs_test_cartno' }, cart, false)
  assert.equal(refused.ok && refused.ignored, 'not_parent')
  assert.equal(balances.get('child-1'), 8000)
})

test('setup does not charge, and removing the card returns kid mode', async () => {
  let setup: { playerId: string; deviceUaHash: string } | null = null
  const started = await handlePaymentSetup(new Request('https://play.romansgame.com/api/payments/setup', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'user-agent': 'KidTablet', 'content-type': 'application/json' },
    body: '{}',
  }), {
    userId: async () => 'kid-1',
    payRow: async () => ({ ok: true, row: { paymentsEnabled: false, parentLocked: false, age13Plus: false, email: 'parent@example.com', attested: false, ownerAdult: false } }),
    country: () => null,
    createSetup: async (input) => {
      setup = input
      return { url: 'https://checkout.stripe.com/c/pay/cs_test_setup' }
    },
  })
  assert.equal(started.status, 200)
  assert.equal(setup?.playerId, 'kid-1')
  assert.equal(typeof setup?.deviceUaHash, 'string')

  let cleared = false
  let evidence = ''
  const removed = await handlePaymentRemove(new Request('https://play.romansgame.com/api/payments/remove', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'user-agent': 'KidTablet' },
  }), {
    userId: async () => 'kid-1',
    clear: async () => {
      cleared = true
    },
    disablePayments: async () => undefined,
    record: async (row) => {
      evidence = `${row.action}:${row.deviceUa}`
    },
    detach: async () => undefined,
  })
  assert.equal(removed.status, 200)
  assert.equal(cleared, true)
  assert.match(evidence, /^detached:KidTablet/)
  const body = await removed.json() as { owner_role: string | null }
  assert.equal(body.owner_role, null)
})

test('a paid Stripe session records the owner from the card, not from an email on its own', async () => {
  const notes: { userId: string; email: string | null; device: string | null }[] = []
  const event: InboundEvent = {
    id: 'evt_owner',
    type: 'checkout.session.completed',
    livemode: false,
    session: {
      id: 'cs_test_owner',
      livemode: false,
      payment_status: 'paid',
      amount_total: 199,
      currency: 'cad',
      payment_intent: 'pi_owner',
      customer: 'cus_123',
      customerEmail: 'payer@example.com',
      metadata: {
        packId: 'coins_500',
        productId: 'roman.cad.coins.500',
        playerId: 'player-1',
        user_id: 'player-1',
        purpose: 'self',
        device_ua_hash: 'device-hash',
        ip_hash: 'ip-hash',
      },
    },
  }
  const balances = new Map<string, number>()
  const res = await handleStripeWebhook(new Request('https://play.romansgame.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1' },
    body: '{}',
  }), {
    secret: 'whsec_test',
    testOnly: true,
    readKey: () => 'sk_test_example',
    isLive: () => false,
    construct: () => event,
    ledger: () => ({
      async seenEvent() { return false },
      async markEvent() { return undefined },
      async findPurchaseBySession() { return null },
      async findPurchaseByPaymentIntent() { return null },
      async insertPurchase() { return undefined },
      async savePurchase() { return undefined },
      async activeEntitlement() { return false },
      async insertEntitlement() { return undefined },
      async revokeEntitlement() { return undefined },
      async insertGift() { return undefined },
      async findGiftByHash() { return null },
      async findGiftBySession() { return null },
      async saveGift() { return 'ok' as const },
      async creditCoins(playerId: string, _op: string, amount: number) {
        balances.set(playerId, amount)
      },
      async debitCoins() { return 0 },
    }),
    noteAttached: async (input) => {
      notes.push({ userId: input.userId, email: input.email, device: input.evidence.deviceUaHash })
    },
  })
  assert.equal(res.status, 200)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].userId, 'player-1')
  assert.equal(notes[0].email, 'payer@example.com')
  assert.equal(notes[0].device, 'device-hash')
  assert.equal(balances.get('player-1'), 500)
})
