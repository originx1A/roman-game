import { webPackById } from './coinPacks.ts'

/**
 * 9.30-u: the owner's "Purchases" list. One record per paid web coin order, written by confirm-checkout at the moment the
 * coins are handed out (the same write that stops a session being redeemed twice, key = Checkout Session id).
 * What is kept: UTC time, which pack, amount, currency, status, test/live, the last 8 characters of the Stripe session id
 * (so it can be matched in the Stripe dashboard). NOT kept: card data, name, email, address, IP.
 * Older records (before 9.30-u) only have packId + coins + at; the amount is filled in from the price list.
 */
export const PURCHASE_STORE = 'roman-stripe-redeemed'

export interface PurchaseRecord {
  packId: string
  coins: number
  /** UTC ISO time the coins were handed out */
  at: string
  amountCents?: number
  currency?: string
  status?: 'paid'
  live?: boolean
  ref?: string
}

export interface PurchaseRow {
  at: string
  item: string
  coins: number
  amountCents: number
  currency: string
  status: string
  live: boolean | null
  ref: string
}

export interface PurchaseStats {
  days: number
  /** totals by real (live) money, and by Stripe test mode, so test clicks are never mistaken for sales */
  live: { orders: number; cents: number; currency: string }
  test: { orders: number; cents: number; currency: string }
  /** records from before 9.30-u don't say whether they were test or live */
  unknown: { orders: number; cents: number; currency: string }
  rows: PurchaseRow[]
}

export interface PurchaseStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>
}

/** What confirm-checkout stores for one paid session (no personal or card data). */
export function buildPurchaseRecord(
  s: { id: string; amount_total: number | null; currency: string | null; livemode?: boolean },
  pack: { id: string; coins: number },
  now: Date = new Date(),
): PurchaseRecord {
  return {
    packId: pack.id,
    coins: pack.coins,
    at: now.toISOString(),
    amountCents: s.amount_total ?? undefined,
    currency: s.currency ?? undefined,
    status: 'paid',
    live: s.livemode === true,
    ref: s.id.slice(-8),
  }
}

function toRow(key: string, raw: unknown): PurchaseRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PurchaseRecord>
  if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at)) || typeof r.packId !== 'string') return null
  const pack = webPackById(r.packId)
  const amountCents = typeof r.amountCents === 'number' ? r.amountCents : pack?.unitAmount ?? 0
  return {
    at: r.at,
    item: pack ? `${pack.label} (${pack.coins} coins)` : r.packId.slice(0, 40),
    coins: typeof r.coins === 'number' ? r.coins : pack?.coins ?? 0,
    amountCents,
    currency: typeof r.currency === 'string' ? r.currency.toLowerCase().slice(0, 3) : pack?.currency ?? 'usd',
    status: r.status === 'paid' ? 'paid' : 'paid (older record)',
    live: typeof r.live === 'boolean' ? r.live : null,
    ref: typeof r.ref === 'string' ? r.ref.slice(0, 8) : key.slice(-8),
  }
}

/** Last `days` days of orders, newest first, plus totals. Bounded: at most `cap` records are read. */
export async function loadPurchases(store: PurchaseStore, days: number, now: Date = new Date(), cap = 500): Promise<PurchaseStats> {
  const since = now.getTime() - days * 86_400_000
  const { blobs } = await store.list()
  const rows: PurchaseRow[] = []
  const keys = blobs.map((b) => b.key).slice(0, cap)
  for (let j = 0; j < keys.length; j += 40) {
    const got = await Promise.all(keys.slice(j, j + 40).map((k) => store.get(k, { type: 'json' }).then((v) => toRow(k, v)).catch(() => null)))
    for (const g of got) if (g && Date.parse(g.at) >= since) rows.push(g)
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : -1))
  const sum = (pick: (r: PurchaseRow) => boolean) => {
    const m = rows.filter(pick)
    return { orders: m.length, cents: m.reduce((a, r) => a + r.amountCents, 0), currency: 'usd' }
  }
  return {
    days,
    live: sum((r) => r.live === true),
    test: sum((r) => r.live === false),
    unknown: sum((r) => r.live === null),
    rows: rows.slice(0, 50),
  }
}

export const usd = (cents: number) => `US$${(cents / 100).toFixed(2)}`

export function memoryPurchaseStore(): PurchaseStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null
    },
    async list() {
      return { blobs: [...data.keys()].map((key) => ({ key })) }
    },
  }
}
