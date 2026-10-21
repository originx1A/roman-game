import type { Catalog, CatalogProduct, PriceList } from './productCatalog.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CartError =
  | 'empty'
  | 'too_many_lines'
  | 'unknown_sku'
  | 'bad_qty'
  | 'duplicate_sku'
  | 'starter_qty'
  | 'starter_owned'
  | 'prices_not_ready'
  | 'bad_gift'

export type PricedLine = {
  sku: string
  qty: number
  stripePriceId: string
  unitAmount: number
}

export type CartPlan = {
  currency: 'usd' | 'cad'
  adaptivePricing: boolean
  holdsStarter: boolean
  giftMode: 'linked_child' | 'code' | null
  giftChildId: string | null
  items: PricedLine[]
}

export type CartDecision = { ok: true; plan: CartPlan } | { ok: false; error: CartError; currency: 'usd' | 'cad' }

/** US buyers get the USD list. Everyone else, including a missing country, gets CAD. */
export function listForCountry(catalog: Catalog, country: string | null | undefined): PriceList {
  if ((country ?? '').trim().toUpperCase() === 'US') return catalog.lists.usd
  return catalog.lists.cad
}

/**
 * Check a cart against one price list. Client price and currency fields are ignored.
 * A line is priced only when config has a positive amount and a Stripe price id.
 */
export function validateCart(
  body: unknown,
  catalog: Catalog,
  country: string | null,
  starterHeld: boolean,
): CartDecision {
  const list = listForCountry(catalog, country)
  const currency = list.currency
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'empty', currency }
  const record = body as Record<string, unknown>
  const gift = readGift(record.gift)
  if (gift === 'bad') return { ok: false, error: 'bad_gift', currency }
  const rawItems = record.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { ok: false, error: 'empty', currency }
  if (rawItems.length > 10) return { ok: false, error: 'too_many_lines', currency }

  const bySku = new Map<string, CatalogProduct>()
  for (const product of list.products) bySku.set(product.sku, product)

  const seen = new Set<string>()
  const items: PricedLine[] = []
  let holdsStarter = false
  let pricesReady = true
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'bad_qty', currency }
    const line = raw as Record<string, unknown>
    const sku = typeof line.sku === 'string' ? line.sku.trim() : ''
    const product = bySku.get(sku)
    if (!sku || !product) return { ok: false, error: 'unknown_sku', currency }
    if (seen.has(sku)) return { ok: false, error: 'duplicate_sku', currency }
    seen.add(sku)
    if (typeof line.qty !== 'number' || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 5) {
      return { ok: false, error: 'bad_qty', currency }
    }
    if (product.once && line.qty !== 1) return { ok: false, error: 'starter_qty', currency }
    if (product.once) holdsStarter = true
    const amount = product.unitAmount
    const priceId = product.stripePriceId.trim()
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || !priceId) pricesReady = false
    items.push({
      sku,
      qty: line.qty,
      stripePriceId: priceId,
      unitAmount: typeof amount === 'number' ? amount : 0,
    })
  }
  if (holdsStarter && starterHeld) return { ok: false, error: 'starter_owned', currency }
  if (!pricesReady) return { ok: false, error: 'prices_not_ready', currency }
  return {
    ok: true,
    plan: {
      currency,
      adaptivePricing: catalog.adaptivePricing,
      holdsStarter,
      giftMode: gift?.mode ?? null,
      giftChildId: gift?.childId ?? null,
      items,
    },
  }
}

function readGift(value: unknown): { mode: 'linked_child' | 'code'; childId: string | null } | null | 'bad' {
  if (value == null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'bad'
  const gift = value as Record<string, unknown>
  if (gift.mode === 'code') return { mode: 'code', childId: null }
  if (gift.mode === 'linked_child') {
    const childId = typeof gift.child_user_id === 'string' ? gift.child_user_id : ''
    if (!UUID.test(childId)) return 'bad'
    return { mode: 'linked_child', childId }
  }
  return 'bad'
}
