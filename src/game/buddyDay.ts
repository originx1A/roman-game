/**
 * Buddy of the day (9.30-l). Each parade features one buddy, rotating through the ones you own
 * (a free-trial buddy counts). Its perk rides along for the next 3 boards: double coins on a win
 * (up to +60 a board) or one free hint a board. With no buddy at all, a guest silhouette is
 * featured (free hint). Pure: state in, state out; App keeps it in localStorage.
 */
import { PETS, type PetId } from './pets'

export type DayPerkKind = 'coins' | 'hint'
export const DAY_BOARDS = 3
/** double coins is capped so it stays small next to a normal day (about 225 coins a win) */
export const DAY_COIN_CAP = 60
export const BUDDYDAY_KEY = 'roman.buddyday.v1'

export interface BuddyDay {
  /** the featured buddy (null = a guest silhouette) */
  pet: PetId | null
  kind: DayPerkKind
  /** boards already used (0..DAY_BOARDS) */
  used: number
  /** last real buddy featured, so the next parade moves on to another one */
  last: PetId | null
}

export const EMPTY_DAY: BuddyDay = { pet: null, kind: 'hint', used: DAY_BOARDS, last: null }

/** hint buddies give a free hint; the coin buddies give double coins */
export function dayKindFor(pet: PetId | null): DayPerkKind {
  return pet === 'aquila' || pet === 'nox' || pet === null ? 'hint' : 'coins'
}

/** The next buddy to feature: the owned one after `last` in Stable order (wraps; one owned = that one; none = null) */
export function pickFeatured(ownedIds: readonly PetId[], last: PetId | null): PetId | null {
  const order = PETS.map((p) => p.id).filter((id) => ownedIds.includes(id))
  if (!order.length) return null
  if (order.length === 1) return order[0]
  const i = last ? order.indexOf(last) : -1
  return order[(i + 1) % order.length]
}

/** A parade begins: feature a buddy and start its 3 boards */
export function startBuddyDay(prev: BuddyDay, ownedIds: readonly PetId[]): BuddyDay {
  const pet = pickFeatured(ownedIds, prev.last)
  return { pet, kind: dayKindFor(pet), used: 0, last: pet ?? prev.last }
}

export function dayActive(d: BuddyDay): boolean {
  return d.used < DAY_BOARDS
}

/** A new board starts: it gets the perk and uses one of the 3 boards. `perk` = null when none is left. */
export function useDayBoard(d: BuddyDay): { day: BuddyDay; perk: { pet: PetId | null; kind: DayPerkKind; board: number } | null } {
  if (!dayActive(d)) return { day: d, perk: null }
  const board = d.used + 1
  return { day: { ...d, used: board }, perk: { pet: d.pet, kind: d.kind, board } }
}

export function dayCoins(baseCoins: number): number {
  return Math.max(0, Math.min(DAY_COIN_CAP, Math.floor(baseCoins)))
}

export function dayLabel(kind: DayPerkKind): string {
  return kind === 'coins' ? `Double coins (up to +${DAY_COIN_CAP} a board)` : 'A free hint every board'
}
export function dayShort(kind: DayPerkKind): string {
  return kind === 'coins' ? '2× coins' : 'free hint'
}

export function sanitizeDay(raw: unknown): BuddyDay {
  const r = (raw && typeof raw === 'object' ? raw : null) as Partial<BuddyDay> | null
  if (!r) return { ...EMPTY_DAY }
  const known = (x: unknown): PetId | null => (PETS.some((p) => p.id === x) ? (x as PetId) : null)
  const pet = known(r.pet)
  const used = Number.isFinite(r.used) ? Math.max(0, Math.min(DAY_BOARDS, Math.floor(r.used as number))) : DAY_BOARDS
  return { pet, kind: r.kind === 'coins' || r.kind === 'hint' ? r.kind : dayKindFor(pet), used, last: known(r.last) }
}

export function loadDay(store: Pick<Storage, 'getItem'> | null): BuddyDay {
  try {
    const raw = store?.getItem(BUDDYDAY_KEY)
    return sanitizeDay(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...EMPTY_DAY }
  }
}
export function saveDay(store: Pick<Storage, 'setItem'> | null, d: BuddyDay): void {
  try {
    store?.setItem(BUDDYDAY_KEY, JSON.stringify(d))
  } catch {
    /* blocked or full: the perk just isn't remembered */
  }
}
