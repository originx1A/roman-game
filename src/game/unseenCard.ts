/**
 * 9.32-b: the exclusive Unseen card (9.32-d: card back while locked, flips to the front when earned).
 * 50 pieces = 1 per hand-made board on its first clear (20) + 1 per daily puzzle won (1 a day, 30).
 * Signed out: counted on this device. Signed in: the server counts saved wins (claim_unseen_card).
 */
import { PUZZLES } from './puzzles'
import type { RecordsBlob } from './replay'

export const CARD_BOARDS = 20
export const CARD_DAYS = 30
export const CARD_PIECES = CARD_BOARDS + CARD_DAYS
const KEY = 'rg.unseen.v1'

export const HAND_MADE_IDS: string[] = PUZZLES.slice(0, CARD_BOARDS).map((p) => String(p.id))

interface Store { boards: string[]; days: string[] }
function read(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { boards: Array.isArray(s.boards) ? s.boards : [], days: Array.isArray(s.days) ? s.days : [] }
  } catch {
    return { boards: [], days: [] }
  }
}
function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
}

export interface LocalCard { boards: number; days: number; pieces: number }

/** Pieces on this device: our own list plus boards/dailies already in the records blob */
export function localCard(records?: RecordsBlob): LocalCard {
  const s = read()
  const boards = new Set(s.boards.filter((id) => HAND_MADE_IDS.includes(id)))
  const days = new Set(s.days)
  if (records) {
    for (const id of HAND_MADE_IDS) if ((records.levels[id]?.clears ?? 0) > 0 || records.levels[id]?.bestMs != null) boards.add(id)
    for (const [d, day] of Object.entries(records.daily.days)) if (day.status === 'won') days.add(d)
  }
  const b = Math.min(CARD_BOARDS, boards.size)
  const d = Math.min(CARD_DAYS, days.size)
  return { boards: b, days: d, pieces: b + d }
}

/** Record a win. Returns how many pieces this win added (0 for replays / extra dailies). */
export function noteCardWin(records: RecordsBlob, puzzleId: string, dailyDate?: string | null): { before: number; after: number } {
  const before = localCard(records).pieces
  const s = read()
  const id = String(puzzleId)
  if (HAND_MADE_IDS.includes(id) && !s.boards.includes(id)) s.boards.push(id)
  if (dailyDate && !s.days.includes(dailyDate)) s.days.push(dailyDate)
  write(s)
  return { before, after: localCard(records).pieces }
}
