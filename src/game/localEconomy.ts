/**
 * Device-side timers for the free refill, the daily gift, field-treat caps, and Unseen pointers.
 * Purchased coins are not stored here.
 */
import {
  emptyGiftCalendar,
  emptyTreatDay,
  sanitizeFountain,
  sanitizeGiftCalendar,
  sanitizeTreatDay,
  type FountainState,
  type GiftCalendar,
  type TreatDay,
} from './economy'
import { emptyPointerMemory, rollPointerDay, type PointerMemory } from './unseenPointers'
import { emptyPerks, sanitizePerks, type PerkState } from './perkBadges'

const FOUNTAIN_KEY = 'roman.fountain.v1'
const GIFT_KEY = 'roman.giftcal.v1'
const TREAT_KEY = 'roman.treatday.v1'
const POINTER_KEY = 'roman.pointers.v1'
const PERK_KEY = 'roman.perks.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode */
  }
}

export function loadFountain(now: number): FountainState {
  return sanitizeFountain(read(FOUNTAIN_KEY), now)
}

export function saveFountain(state: FountainState) {
  write(FOUNTAIN_KEY, state)
}

export function loadGiftCalendar(): GiftCalendar {
  return sanitizeGiftCalendar(read(GIFT_KEY) ?? emptyGiftCalendar())
}

export function saveGiftCalendar(state: GiftCalendar) {
  write(GIFT_KEY, state)
}

export function loadTreatDay(today: string): TreatDay {
  return sanitizeTreatDay(read(TREAT_KEY) ?? emptyTreatDay(today), today)
}

export function saveTreatDay(day: TreatDay) {
  write(TREAT_KEY, day)
}

export function loadPointerMemory(day: string): PointerMemory {
  const raw = read<PointerMemory>(POINTER_KEY)
  if (!raw || typeof raw !== 'object') return emptyPointerMemory(day)
  const recent = Array.isArray(raw.recent)
    ? raw.recent.filter((r) => r && typeof r.id === 'string' && typeof r.at === 'number').slice(-40)
    : []
  return rollPointerDay(
    {
      day: typeof raw.day === 'string' ? raw.day : day,
      shown: typeof raw.shown === 'number' ? Math.max(0, Math.floor(raw.shown)) : 0,
      runsSince: typeof raw.runsSince === 'number' ? Math.max(0, Math.floor(raw.runsSince)) : 0,
      recent,
    },
    day,
  )
}

export function savePointerMemory(memory: PointerMemory) {
  write(POINTER_KEY, memory)
}

export function loadPerkState(): PerkState {
  return sanitizePerks(read(PERK_KEY) ?? emptyPerks())
}

export function savePerkState(state: PerkState) {
  write(PERK_KEY, state)
}
