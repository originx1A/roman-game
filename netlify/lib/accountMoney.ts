/**
 * Account-backed purchase coins and the weekly spend cap.
 * The working store is Netlify Blobs (no Supabase write).
 * A SQL copy runs only when ACCOUNT_LEDGER_ENABLED=1 and a service role key is set.
 * That flag is off until the owner applies supabase/migration-005-coin-ledger.sql.
 * This file never logs secrets.
 */
import { getStore } from '@netlify/blobs'
import { canSpend, packCadCents, spentInWindow, type SpendCharge } from '../../src/game/economy.ts'

export const SPEND_STORE = 'roman-spend-cap'
export const LEDGER_STORE = 'roman-coin-ledger'
const HOLD_MS = 2 * 3_600_000
const WEEK_MS = 7 * 86_400_000

export interface SpendEntry extends SpendCharge {
  state: 'hold' | 'paid'
}

interface SpendBook {
  charges: SpendEntry[]
}

export interface LedgerCredit {
  sessionId: string
  userId: string
  packId: string
  coins: number
  at: string
  /** CAD list used for the weekly cap. Stripe still charges USD. */
  cadCents: number
  /** What Stripe charged, in the charge currency's cents. */
  usdCents: number
}

type BlobStore = {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean }): Promise<{ modified?: boolean }>
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>
}

function spendStore(): BlobStore {
  return getStore({ name: SPEND_STORE, consistency: 'strong' }) as unknown as BlobStore
}

function ledgerStore(): BlobStore {
  return getStore({ name: LEDGER_STORE, consistency: 'strong' }) as unknown as BlobStore
}

function bookKey(userId: string): string {
  return `spend/${userId}`
}

function asBook(raw: unknown): SpendBook {
  const charges = (raw && typeof raw === 'object' && Array.isArray((raw as SpendBook).charges) ? (raw as SpendBook).charges : [])
    .filter((c) => c && typeof c.id === 'string' && typeof c.at === 'number' && typeof c.cadCents === 'number')
    .map((c) => ({ id: c.id, at: c.at, cadCents: Math.max(0, Math.floor(c.cadCents)), state: c.state === 'paid' ? 'paid' as const : 'hold' as const }))
  return { charges: charges.slice(-80) }
}

/** Holds older than 2 hours do not count. Paid charges count for 7 days. */
export function countable(charges: readonly SpendEntry[], now: number): SpendCharge[] {
  return charges.filter((c) => {
    if (now < c.at || now - c.at >= WEEK_MS) return false
    if (c.state === 'paid') return true
    return now - c.at < HOLD_MS
  })
}

export async function spentCadCents(userId: string, now = Date.now()): Promise<number> {
  const raw = await spendStore().get(bookKey(userId), { type: 'json' })
  return spentInWindow(countable(asBook(raw).charges, now), now)
}

export async function reserveSpend(userId: string, sessionId: string, packId: string, now = Date.now()): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cad = packCadCents(packId)
  const store = spendStore()
  const key = bookKey(userId)
  const book = asBook(await store.get(key, { type: 'json' }))
  const spent = spentInWindow(countable(book.charges, now), now)
  const cap = canSpend(spent, cad)
  if (!cap.ok) return { ok: false, reason: cap.reason || 'Weekly spending limit reached (CA$50). Try again next week.' }
  const charges = book.charges.filter((c) => c.id !== sessionId)
  charges.push({ id: sessionId, at: now, cadCents: cad, state: 'hold' })
  await store.setJSON(key, { charges: charges.slice(-80) })
  return { ok: true }
}

export async function markSpendPaid(userId: string, sessionId: string, packId: string, now = Date.now()): Promise<void> {
  const store = spendStore()
  const key = bookKey(userId)
  const book = asBook(await store.get(key, { type: 'json' }))
  const cad = packCadCents(packId)
  const charges = book.charges.filter((c) => c.id !== sessionId)
  charges.push({ id: sessionId, at: now, cadCents: cad, state: 'paid' })
  await store.setJSON(key, { charges: charges.slice(-80) })
}

export function ledgerKey(userId: string, sessionId: string): string {
  return `user/${userId}/${sessionId}`
}

export async function writeLedgerCredit(credit: LedgerCredit): Promise<void> {
  await ledgerStore().setJSON(ledgerKey(credit.userId, credit.sessionId), credit, { onlyIfNew: true })
  await writeSqlCredit(credit)
}

export async function listLedgerCredits(userId: string): Promise<LedgerCredit[]> {
  const store = ledgerStore()
  const { blobs } = await store.list({ prefix: `user/${userId}/` })
  const out: LedgerCredit[] = []
  for (const blob of blobs.slice(0, 100)) {
    const raw = (await store.get(blob.key, { type: 'json' })) as Partial<LedgerCredit> | null
    if (!raw || raw.userId !== userId || typeof raw.sessionId !== 'string' || typeof raw.coins !== 'number') continue
    out.push({
      sessionId: raw.sessionId,
      userId,
      packId: typeof raw.packId === 'string' ? raw.packId : '',
      coins: Math.max(0, Math.floor(raw.coins)),
      at: typeof raw.at === 'string' ? raw.at : '',
      cadCents: typeof raw.cadCents === 'number' ? raw.cadCents : 0,
      usdCents: typeof raw.usdCents === 'number' ? raw.usdCents : 0,
    })
  }
  return out
}

/**
 * Optional SQL copy. Off unless ACCOUNT_LEDGER_ENABLED=1.
 * The table is in supabase/migration-005-coin-ledger.sql, which is NOT APPLIED.
 */
export async function writeSqlCredit(credit: LedgerCredit): Promise<void> {
  if (process.env.ACCOUNT_LEDGER_ENABLED !== '1') return
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return
  try {
    await fetch('https://oelsglmfkpzbueqysvdm.supabase.co/rest/v1/coin_ledger', {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({
        user_id: credit.userId,
        delta: credit.coins,
        reason: 'stripe_checkout',
        stripe_session_id: credit.sessionId,
        amount_cents: credit.usdCents,
        currency: 'usd',
      }),
    })
  } catch {
    /* Blob ledger already holds the credit. The SQL copy can be retried after the migration. */
  }
}
