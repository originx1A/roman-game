/*
 * Defender Boards (build 9.33-a).
 *
 * The five Stable buddies ARE the Defenders. Some boards are "branded" to one Defender:
 * if the player holds calls (activations) for that Defender, the Defender steps in and
 * does its one thing, once, and one call is spent. No match or no calls = nothing fires,
 * nothing is spent. Max one activation per board, ever.
 *
 * Calls are bought with game coins only, in packs of 10 at 150 coins each — the same
 * price for every Defender. Balance comes from the boards: the stronger the help,
 * the rarer its branded board (see BRAND_WEIGHTS).
 *
 * Pure functions (state in, state out) like pets.ts; App saves the state.
 */
import { hasPet, petById, type PetId, type PetState } from './pets'

// ---------- calls: prices ----------
/** Coins per single call (calls are sold in packs, this is the unit price) */
export const CALL_PRICE = 150
/** Calls per pack */
export const CALL_PACK_SIZE = 10
/** Coins per pack of 10 calls — the same for every Defender */
export const CALL_PACK_PRICE = CALL_PRICE * CALL_PACK_SIZE
/** Calls the free first-pick Defender arrives with */
export const FREE_PICK_CALLS = 10
/** Most calls a player can bank per Defender */
export const MAX_CALLS = 999

export function callsFor(s: PetState, id: PetId): number {
  return Math.max(0, Math.floor(s.calls[id] ?? 0))
}

/** Add calls to a Defender's bank (no charge). */
export function grantCalls(s: PetState, id: PetId, n: number): PetState {
  const add = Math.max(0, Math.floor(n))
  if (!add) return s
  return { ...s, calls: { ...s.calls, [id]: Math.min(MAX_CALLS, callsFor(s, id) + add) } }
}

/** Spend exactly one call. Returns the new state, or null when the bank is empty. */
export function spendCall(s: PetState, id: PetId): PetState | null {
  const n = callsFor(s, id)
  if (n <= 0) return null
  return { ...s, calls: { ...s.calls, [id]: n - 1 } }
}

export type BuyCallsResult =
  | { ok: true; state: PetState; coins: number; spent: number; calls: number }
  | { ok: false; reason: string }

/** Buy one pack of 10 calls for a Defender the player has. Coins only. */
export function buyCalls(s: PetState, coins: number, id: PetId, now: number): BuyCallsResult {
  const p = petById(id)
  if (!p) return { ok: false, reason: 'Unknown Defender' }
  if (!hasPet(s, id, now)) return { ok: false, reason: `${p.name} is not in your Stable yet` }
  if (callsFor(s, id) + CALL_PACK_SIZE > MAX_CALLS) return { ok: false, reason: `${p.name}'s call bank is full` }
  if (coins < CALL_PACK_PRICE) return { ok: false, reason: `Need ${CALL_PACK_PRICE - coins} more coins` }
  const state = grantCalls(s, id, CALL_PACK_SIZE)
  return { ok: true, state, coins: coins - CALL_PACK_PRICE, spent: CALL_PACK_PRICE, calls: callsFor(state, id) }
}

// ---------- branded boards ----------
/** Share of fresh boards that come up branded to a Defender */
export const BRAND_CHANCE = 0.25
/**
 * Brand mix, by help strength — the strongest help is the rarest board:
 * Leo (one mistake forgiven) is the gentlest, Lupa (places a buddy) the strongest.
 */
export const BRAND_WEIGHTS: Readonly<Record<PetId, number>> = {
  leo: 30,
  aquila: 25,
  nox: 20,
  invictus: 15,
  lupa: 10,
}
export const DEFENDER_IDS: readonly PetId[] = ['lupa', 'aquila', 'leo', 'invictus', 'nox']

/**
 * Roll the brand for a fresh board. ~1 in 4 boards is branded; the same Defender
 * never brands two boards in a row (`last` is the previous board's brand).
 */
export function rollBrand(rng: () => number = Math.random, last: PetId | null = null): PetId | null {
  if (rng() >= BRAND_CHANCE) return null
  const pool = DEFENDER_IDS.filter((id) => id !== last)
  const total = pool.reduce((sum, id) => sum + BRAND_WEIGHTS[id], 0)
  let roll = rng() * total
  for (const id of pool) {
    roll -= BRAND_WEIGHTS[id]
    if (roll < 0) return id
  }
  return pool[pool.length - 1]
}

// ---------- presentation: each Defender's colour and board flavour ----------
export interface DefenderTheme {
  /** CSS-friendly deep colour for the board backdrop wash */
  deep: string
  /** Bright accent (banner, badges, the icon ring) */
  accent: string
  /** One plain line for the board-start banner, e.g. what this Defender does */
  job: string
}

export const DEFENDER_THEME: Readonly<Record<PetId, DefenderTheme>> = {
  leo: {
    deep: '#4a3208',
    accent: '#e8b64c',
    job: 'Leo roars off your first mistake — it costs no heart.',
  },
  aquila: {
    deep: '#3d2c10',
    accent: '#d99a3d',
    job: 'Aquila drops feathers on squares with no buddy — safe ground.',
  },
  nox: {
    deep: '#241d4d',
    accent: '#9d8cff',
    job: 'Nox lights 6 squares. A buddy hides in one of them.',
  },
  invictus: {
    deep: '#47201a',
    accent: '#e2703a',
    job: 'Invictus charges a row and reveals a buddy in it.',
  },
  lupa: {
    deep: '#26343c',
    accent: '#b9c8d2',
    job: 'Lupa follows the paw prints and places a buddy for you.',
  },
}

/** Aquila's feather share of the empty (no-buddy) squares: grows with board size. */
export function aquilaFeatherCount(size: number, emptySquares: number): number {
  const pct = Math.min(0.4, 0.04 * size + 0.04) // 5x5 → 24%, 6x6 → 28%, 7x7 → 32%, 8x8 → 36%
  return Math.max(1, Math.min(emptySquares, Math.round(emptySquares * pct)))
}

/** Nox lights this many squares (one of them holds a buddy). */
export const NOX_LIGHT_COUNT = 6
