import { createHash, timingSafeEqual } from 'node:crypto'
import { GIFT_CODE_RE, normalizeGiftCode, PETS, type Gift, type PetId } from '../../src/game/pets.ts'

/**
 * Owner gift codes (web only). Tony makes a one-time code like ROMA-7K2P on the hidden owner
 * page; a player redeems it once in The Stable. The owner passphrase lives only in the Netlify
 * env var ROMAN_OWNER_KEY and is never sent back or logged.
 */
export const GIFT_STORE = 'roman-gifts'
export const OWNER_KEY_ENV = 'ROMAN_OWNER_KEY'
/** No 0/O, 1/I/L: easy to read out loud or type on a phone */
export const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** The part of a Netlify Blobs store we use (tests pass an in-memory one) */
export interface GiftStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean }): Promise<{ modified: boolean }>
}

export function ownerKeyConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env[OWNER_KEY_ENV]?.trim()
}

/** Constant-time check of the typed passphrase against the env var. */
export function ownerKeyMatches(typed: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const real = env[OWNER_KEY_ENV]?.trim()
  if (!real || typeof typed !== 'string' || !typed) return false
  const a = createHash('sha256').update(typed.trim()).digest()
  const b = createHash('sha256').update(real).digest()
  return timingSafeEqual(a, b)
}

export function makeGiftCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(4)
  let body = ''
  for (let i = 0; i < 4; i++) body += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return `ROMA-${body}`
}

/** Only well-formed gifts get stored. Returns null for anything else. */
export function parseGift(raw: unknown): Gift | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  const petIds = PETS.map((p) => p.id) as string[]
  if (g.kind === 'pet') return typeof g.pet === 'string' && petIds.includes(g.pet) ? { kind: 'pet', pet: g.pet as PetId } : null
  if (g.kind === 'coins') {
    const amount = Number(g.amount)
    return Number.isInteger(amount) && amount >= 10 && amount <= 5000 ? { kind: 'coins', amount } : null
  }
  if (g.kind === 'coupon') {
    const pct = Number(g.pct)
    const days = g.days == null ? 7 : Number(g.days)
    const pet = g.pet == null || g.pet === '' ? null : typeof g.pet === 'string' && petIds.includes(g.pet) ? g.pet : undefined
    if (pet === undefined || !Number.isInteger(pct) || pct < 5 || pct > 50 || !Number.isInteger(days) || days < 1 || days > 30) return null
    return { kind: 'coupon', pct, pet: pet as PetId | null, days }
  }
  return null
}

export interface GiftRecord {
  gift: Gift
  note: string
  createdAt: string
}

/** Store a new code (retries on the rare collision). */
export async function createGift(store: GiftStore, gift: Gift, note: string, rand?: (n: number) => Uint8Array): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = makeGiftCode(rand)
    const rec: GiftRecord = { gift, note: note.slice(0, 80), createdAt: new Date().toISOString() }
    const { modified } = await store.setJSON(`code/${code}`, rec, { onlyIfNew: true })
    if (modified) return code
  }
  throw new Error('Could not make a unique code')
}

export type RedeemOutcome = { ok: true; code: string; gift: Gift } | { ok: false; code: string; reason: string; status: number }

/** One-time redeem: the first request to write the "used" marker wins; everyone after is told no. */
export async function redeemGift(store: GiftStore, rawCode: unknown): Promise<RedeemOutcome> {
  const code = typeof rawCode === 'string' ? normalizeGiftCode(rawCode) : ''
  if (!GIFT_CODE_RE.test(code)) return { ok: false, code, reason: 'That doesn’t look like a gift code (like ROMA-7K2P).', status: 400 }
  const rec = (await store.get(`code/${code}`, { type: 'json' })) as GiftRecord | null
  const gift = rec ? parseGift(rec.gift) : null
  if (!gift) return { ok: false, code, reason: 'That gift code isn’t valid.', status: 404 }
  const { modified } = await store.setJSON(`used/${code}`, { at: new Date().toISOString() }, { onlyIfNew: true })
  if (!modified) return { ok: false, code, reason: 'That gift code was already used.', status: 409 }
  return { ok: true, code, gift }
}

/** In-memory store with the same onlyIfNew rule (tests / local) */
export function memoryGiftStore(): GiftStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null
    },
    async setJSON(key, value, opts) {
      if (opts?.onlyIfNew && data.has(key)) return { modified: false }
      data.set(key, structuredClone(value))
      return { modified: true }
    },
  }
}
