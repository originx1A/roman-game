import { createHash, randomBytes } from 'node:crypto'
import { chargeMatchesPack, SHOP_OFFERS } from '../../src/game/shopOffers.ts'
import { CHECKOUT_TEST_ONLY, webPackById, type WebCoinPack } from './coinPacks.ts'

/** Gift-code alphabet. No 0/O or 1/I/L. Codes are not dated. */
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export function makeCode(prefix: 'GIFT' | 'SAVE', rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(8)
  let body = ''
  for (let i = 0; i < 8; i++) body += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`
}

export interface Purchase {
  id: string
  sessionId: string
  paymentIntentId: string | null
  playerId: string
  itemType: 'pack'
  itemId: string
  purpose: 'self' | 'gift'
  status: 'paid' | 'revoked' | 'blocked'
  coins: number
  amountCents: number
  currency: string
  livemode: boolean
  giftCodeId: string | null
  deviceClaimedAt: string | null
}

export interface Entitlement {
  id: string
  playerId: string
  itemType: 'pack'
  itemId: string
  purchaseId: string
  giftCodeId: string | null
  revokedAt: string | null
}

export interface GiftCode {
  id: string
  codeHash: string
  hint: string
  reveal: string | null
  buyerId: string
  itemId: string
  status: 'open' | 'redeemed' | 'void' | 'cancelled'
  redeemedBy: string | null
  purchaseId: string
  sessionId: string
  createdAt: string
}

export interface Ledger {
  findPurchaseBySession(sessionId: string): Promise<Purchase | null>
  findPurchaseByPaymentIntent(paymentIntentId: string): Promise<Purchase | null>
  insertPurchase(row: Purchase): Promise<void>
  savePurchase(row: Purchase): Promise<void>
  activeEntitlement(playerId: string, itemId: string): Promise<boolean>
  insertEntitlement(row: Entitlement): Promise<void>
  revokeEntitlement(playerId: string, itemId: string, purchaseId: string, at: string): Promise<void>
  insertGift(row: GiftCode): Promise<void>
  findGiftByHash(codeHash: string): Promise<GiftCode | null>
  findGiftBySession(sessionId: string): Promise<GiftCode | null>
  /** 'lost' means a redeem lost the race and the code was no longer open. */
  saveGift(row: GiftCode): Promise<'ok' | 'lost'>
  creditCoins(playerId: string, op: string, amount: number): Promise<void>
  debitCoins(playerId: string, op: string, amount: number): Promise<number>
  seenEvent(eventId: string): Promise<boolean>
  markEvent(eventId: string, eventType: string): Promise<void>
}

export interface CompletedSession {
  id: string
  livemode: boolean
  payment_status: string
  amount_total: number | null
  currency: string | null
  payment_intent: string | null
  metadata: {
    packId?: string
    productId?: string
    playerId?: string
    purpose?: string
    cart_id?: string
    user_id?: string
    device_ua_hash?: string
    ip_hash?: string
  } | null
  mode?: string
  status?: string
  customer?: string | null
  customerEmail?: string | null
  paymentMethod?: string | null
}

export type GrantResult =
  | { ok: true; duplicate?: boolean; ignored?: 'live' | 'not_parent'; giftCode?: string; coins?: number }
  | { ok: false; error: string }

function newId(): string {
  return randomBytes(16).toString('hex')
}

export async function grantCheckout(ledger: Ledger, session: CompletedSession, now = new Date()): Promise<GrantResult> {
  if (session.livemode && CHECKOUT_TEST_ONLY) return { ok: true, ignored: 'live' }
  if (session.payment_status !== 'paid') return { ok: false, error: 'unpaid' }
  const pack = webPackById(session.metadata?.packId)
  if (!pack || session.metadata?.productId !== pack.productId) return { ok: false, error: 'unknown_pack' }
  if (!chargeMatchesPack(pack, session.currency, session.amount_total)) {
    return { ok: false, error: 'amount' }
  }
  const playerId = session.metadata?.playerId || ''
  if (!playerId) return { ok: false, error: 'no_player' }
  const existing = await ledger.findPurchaseBySession(session.id)
  if (existing) return { ok: true, duplicate: true, coins: existing.coins }
  const purpose = session.metadata?.purpose === 'gift' ? 'gift' : 'self'
  if (purpose === 'self' && pack.once && await ledger.activeEntitlement(playerId, pack.id)) {
    const blocked = purchaseFrom(session, pack, playerId, 'self', 'blocked', null)
    await ledger.insertPurchase(blocked)
    return { ok: true, duplicate: true, coins: 0 }
  }
  if (purpose === 'gift') {
    const code = makeCode('GIFT')
    const giftId = newId()
    const purchase = purchaseFrom(session, pack, playerId, 'gift', 'paid', giftId)
    purchase.coins = 0
    const gift: GiftCode = {
      id: giftId,
      codeHash: sha256Hex(normalizeCode(code)),
      hint: code.slice(-4),
      reveal: code,
      buyerId: playerId,
      itemId: pack.id,
      status: 'open',
      redeemedBy: null,
      purchaseId: purchase.id,
      sessionId: session.id,
      createdAt: now.toISOString(),
    }
    await ledger.insertPurchase(purchase)
    await ledger.insertGift(gift)
    return { ok: true, giftCode: code, coins: 0 }
  }
  const purchase = purchaseFrom(session, pack, playerId, 'self', 'paid', null)
  await ledger.insertPurchase(purchase)
  await ledger.insertEntitlement({
    id: newId(),
    playerId,
    itemType: 'pack',
    itemId: pack.id,
    purchaseId: purchase.id,
    giftCodeId: null,
    revokedAt: null,
  })
  if (pack.coins > 0) await ledger.creditCoins(playerId, session.id, pack.coins)
  return { ok: true, coins: pack.coins }
}

function purchaseFrom(
  session: CompletedSession,
  pack: WebCoinPack,
  playerId: string,
  purpose: 'self' | 'gift',
  status: Purchase['status'],
  giftCodeId: string | null,
): Purchase {
  return {
    id: newId(),
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
    playerId,
    itemType: 'pack',
    itemId: pack.id,
    purpose,
    status,
    coins: purpose === 'self' ? pack.coins : 0,
    amountCents: typeof session.amount_total === 'number' ? session.amount_total : pack.unitAmount,
    currency: pack.currency,
    livemode: session.livemode,
    giftCodeId,
    deviceClaimedAt: null,
  }
}

function starterGiftCoins(): number {
  return SHOP_OFFERS.find((offer) => offer.id === 'starter')?.coins ?? 0
}

/**
 * A priced cart line bought as a gift is credited to the linked child.
 * The buyer is not credited. Unpriced lines add nothing.
 */
export async function grantLinkedChild(
  ledger: Ledger,
  session: CompletedSession,
  cart: { giftMode: string | null; giftChildId: string | null; items: { sku: string; qty: number }[] },
  parentLinked: boolean,
): Promise<GrantResult> {
  if (session.livemode && CHECKOUT_TEST_ONLY) return { ok: true, ignored: 'live' }
  if (session.payment_status !== 'paid') return { ok: false, error: 'unpaid' }
  if (cart.giftMode !== 'linked_child' || !cart.giftChildId) return { ok: true, coins: 0 }
  if (!parentLinked) return { ok: true, ignored: 'not_parent' }
  const existing = await ledger.findPurchaseBySession(session.id)
  if (existing) return { ok: true, duplicate: true, coins: existing.coins }
  const per = starterGiftCoins()
  let coins = 0
  for (const item of cart.items) {
    if (item.sku === 'starter_bundle' && per > 0) coins += per * item.qty
  }
  const childId = cart.giftChildId
  const purchase = purchaseFrom(
    session,
    {
      id: 'starter',
      productId: 'roman.cad.bundle.starter',
      label: 'Starter Pack',
      coins,
      treats: 0,
      pets: [],
      once: false,
      currency: 'cad',
      unitAmount: typeof session.amount_total === 'number' ? session.amount_total : 0,
      priceLabel: '',
      contents: [],
    },
    childId,
    'self',
    'paid',
    null,
  )
  purchase.playerId = childId
  purchase.coins = coins
  await ledger.insertPurchase(purchase)
  if (coins > 0) await ledger.creditCoins(childId, session.id, coins)
  return { ok: true, coins }
}

export interface ChargeReversal {
  id: string
  payment_intent: string | null
  livemode: boolean
}

export async function revokeCharge(ledger: Ledger, charge: ChargeReversal, now = new Date()): Promise<GrantResult> {
  if (charge.livemode && CHECKOUT_TEST_ONLY) return { ok: true, ignored: 'live' }
  if (!charge.payment_intent) return { ok: false, error: 'no_payment' }
  const purchase = await ledger.findPurchaseByPaymentIntent(charge.payment_intent)
  if (!purchase) return { ok: false, error: 'unknown' }
  if (purchase.status === 'revoked') return { ok: true, duplicate: true }
  const at = now.toISOString()
  if (purchase.purpose === 'gift' && purchase.giftCodeId) {
    const gift = await findGiftForPurchase(ledger, purchase)
    if (gift && gift.status === 'open') {
      gift.status = 'void'
      gift.reveal = null
      await ledger.saveGift(gift)
    } else if (gift && gift.status === 'redeemed' && gift.redeemedBy) {
      gift.status = 'void'
      gift.reveal = null
      await ledger.saveGift(gift)
      await ledger.revokeEntitlement(gift.redeemedBy, gift.itemId, purchase.id, at)
      const pack = webPackById(gift.itemId)
      if (pack && pack.coins > 0) await ledger.debitCoins(gift.redeemedBy, `void:${charge.id}`, pack.coins)
    } else if (gift && gift.status !== 'void') {
      gift.status = 'void'
      gift.reveal = null
      await ledger.saveGift(gift)
    }
  } else {
    await ledger.revokeEntitlement(purchase.playerId, purchase.itemId, purchase.id, at)
    if (purchase.coins > 0) await ledger.debitCoins(purchase.playerId, `void:${charge.id}`, purchase.coins)
  }
  purchase.status = 'revoked'
  await ledger.savePurchase(purchase)
  return { ok: true }
}

async function findGiftForPurchase(ledger: Ledger, purchase: Purchase): Promise<GiftCode | null> {
  return ledger.findGiftBySession(purchase.sessionId)
}

export type RedeemResult =
  | { ok: true; itemId: string; coins: number; label: string }
  | { ok: false; status: number; error: string }

/**
 * One redeemer. The code is not checked against a date.
 * A refund or chargeback voids it. The buyer can cancel it before it is used.
 */
export async function redeemGiftCode(ledger: Ledger, rawCode: string, playerId: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode)
  if (!/^GIFT-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(code)) {
    return { ok: false, status: 400, error: "That code doesn't work." }
  }
  const gift = await ledger.findGiftByHash(sha256Hex(code))
  if (!gift) return { ok: false, status: 404, error: "That code doesn't work." }
  if (gift.status === 'redeemed') return { ok: false, status: 409, error: 'That code was already used.' }
  if (gift.status === 'void' || gift.status === 'cancelled') return { ok: false, status: 409, error: "That code doesn't work." }
  const pack = webPackById(gift.itemId)
  if (!pack) return { ok: false, status: 404, error: "That code doesn't work." }
  if (pack.once && await ledger.activeEntitlement(playerId, pack.id)) {
    return { ok: false, status: 409, error: 'You already have that.' }
  }
  gift.status = 'redeemed'
  gift.redeemedBy = playerId
  gift.reveal = null
  const saved = await ledger.saveGift(gift)
  if (saved === 'lost') return { ok: false, status: 409, error: 'That code was already used.' }
  await ledger.insertEntitlement({
    id: newId(),
    playerId,
    itemType: 'pack',
    itemId: pack.id,
    purchaseId: gift.purchaseId,
    giftCodeId: gift.id,
    revokedAt: null,
  })
  if (pack.coins > 0) await ledger.creditCoins(playerId, `gift:${gift.id}`, pack.coins)
  return { ok: true, itemId: pack.id, coins: pack.coins, label: pack.label }
}

export async function cancelGiftCode(ledger: Ledger, rawCode: string, buyerId: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode)
  const gift = await ledger.findGiftByHash(sha256Hex(code))
  if (!gift || gift.buyerId !== buyerId) return { ok: false, status: 404, error: "That code doesn't work." }
  if (gift.status === 'redeemed') return { ok: false, status: 409, error: 'That code was already used.' }
  if (gift.status === 'void' || gift.status === 'cancelled') return { ok: true, itemId: gift.itemId, coins: 0, label: '' }
  gift.status = 'cancelled'
  gift.reveal = null
  await ledger.saveGift(gift)
  return { ok: true, itemId: gift.itemId, coins: 0, label: '' }
}

export function memoryLedger(): Ledger & { purchases: Purchase[]; gifts: GiftCode[]; entitlements: Entitlement[]; balances: Map<string, number>; events: Set<string> } {
  const purchases: Purchase[] = []
  const gifts: GiftCode[] = []
  const entitlements: Entitlement[] = []
  const balances = new Map<string, number>()
  const events = new Set<string>()
  const ledger: Ledger & { purchases: Purchase[]; gifts: GiftCode[]; entitlements: Entitlement[]; balances: Map<string, number>; events: Set<string> } = {
    purchases,
    gifts,
    entitlements,
    balances,
    events,
    async findPurchaseBySession(sessionId) {
      return purchases.find((row) => row.sessionId === sessionId) ?? null
    },
    async findPurchaseByPaymentIntent(paymentIntentId) {
      return purchases.find((row) => row.paymentIntentId === paymentIntentId) ?? null
    },
    async insertPurchase(row) {
      if (purchases.some((item) => item.sessionId === row.sessionId)) throw new Error('duplicate session')
      purchases.push({ ...row })
    },
    async savePurchase(row) {
      const idx = purchases.findIndex((item) => item.id === row.id)
      if (idx >= 0) purchases[idx] = { ...row }
    },
    async activeEntitlement(playerId, itemId) {
      return entitlements.some((row) => row.playerId === playerId && row.itemId === itemId && !row.revokedAt)
    },
    async insertEntitlement(row) {
      entitlements.push({ ...row })
    },
    async revokeEntitlement(playerId, itemId, purchaseId, at) {
      for (const row of entitlements) {
        if (row.playerId === playerId && row.itemId === itemId && row.purchaseId === purchaseId && !row.revokedAt) row.revokedAt = at
      }
    },
    async insertGift(row) {
      gifts.push({ ...row })
    },
    async findGiftByHash(codeHash) {
      return gifts.find((row) => row.codeHash === codeHash) ?? null
    },
    async findGiftBySession(sessionId) {
      return gifts.find((row) => row.sessionId === sessionId) ?? null
    },
    async saveGift(row) {
      const idx = gifts.findIndex((item) => item.id === row.id)
      if (idx < 0) return 'lost'
      if (row.status === 'redeemed' && gifts[idx].status !== 'open' && gifts[idx].status !== 'redeemed') return 'lost'
      if (row.status === 'redeemed' && gifts[idx].status !== 'open' && gifts[idx].redeemedBy && gifts[idx].redeemedBy !== row.redeemedBy) return 'lost'
      gifts[idx] = { ...row }
      return 'ok'
    },
    async creditCoins(playerId, _op, amount) {
      balances.set(playerId, (balances.get(playerId) ?? 0) + amount)
    },
    async debitCoins(playerId, _op, amount) {
      const next = Math.max(0, (balances.get(playerId) ?? 0) - amount)
      const removed = (balances.get(playerId) ?? 0) - next
      balances.set(playerId, next)
      return removed
    },
    async seenEvent(eventId) {
      return events.has(eventId)
    },
    async markEvent(eventId) {
      events.add(eventId)
    },
  }
  return ledger
}

/** Stripe test-mode Roman products on acct_1UCGtsAn9Kkm2MZQ as of 2026-10-21. Both inactive. */
export const STRIPE_TEST_ROMAN_PRODUCTS = [
  {
    name: 'Coin Bag (500 coins)',
    id: 'prod_VJzgJyJa7SLxsp',
    priceId: 'price_1UJLh9An9Kkm2MZQtJMOL1aR',
    unitAmount: 499,
    currency: 'usd',
    coins: 500,
    active: false,
  },
  {
    name: 'Coin Vault (3000 coins)',
    id: 'prod_VJzkKFHyKMD9nv',
    priceId: 'price_1UJLkcAn9Kkm2MZQUd69PXd5',
    unitAmount: 1999,
    currency: 'usd',
    coins: 3000,
    active: false,
  },
] as const
