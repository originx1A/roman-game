/**
 * Throne ladder. Status only. Not team points. The ladder does not stop.
 *
 * Model (Tony, round 3):
 * Wins are kept on the board they were won on: one count per size and
 * difficulty. They are not pooled into a single total for the throne.
 *
 * On the smallest, easiest board (5×5, easy) the thresholds are
 * 10, 20, 30, 40… — plus 10 each throne, with nothing taken off.
 *
 * A step up is either one size larger (5→6→7→8) or one difficulty harder
 * (easy→medium→hard→expert). Steps add. A board one step up needs
 * 9, 19, 29… A board two steps up needs 8, 18, 28… In general throne n
 * on a board `steps` up needs `10 × n − steps` wins on that same board.
 *
 * The throne you hold is the highest one any single board has reached.
 * Nine wins on the easy board plus eight on a one-step board is still
 * no throne. An older save that only has a total is treated as wins on
 * the 5×5 easy board.
 *
 * Daily is the drawn 6×6 medium board, which is two steps up (8, 18, 28…).
 */

export interface Throne {
  id: number
  name: string
  nameFr: string
  /** Wins this throne takes on the 5×5 easy board. 10, 20, 30, 40… */
  wins: number
  line: string
  lineFr: string
}

export type WinMap = Record<string, number>

const NAMED: { name: string; nameFr: string; line: string; lineFr: string }[] = [
  { name: 'First Seat', nameFr: 'Premier siège', line: 'Ten wins on the small easy board.', lineFr: 'Dix victoires sur le petit plateau facile.' },
  { name: 'Stone Seat', nameFr: 'Siège de pierre', line: 'Twenty on the small easy board.', lineFr: 'Vingt sur le petit plateau facile.' },
  { name: 'Cedar Seat', nameFr: 'Siège de cèdre', line: 'Thirty on the small easy board.', lineFr: 'Trente sur le petit plateau facile.' },
  { name: 'River Seat', nameFr: 'Siège de la rivière', line: 'A river seat. Status only.', lineFr: 'Un siège de rivière. Statut seulement.' },
  { name: 'Amber Seat', nameFr: 'Siège d’ambre', line: 'Your highest throne shows beside your name.', lineFr: 'Ton plus haut trône s’affiche près de ton nom.' },
  { name: 'Harbor Seat', nameFr: 'Siège du port', line: 'A harbor seat. The ladder continues.', lineFr: 'Un siège du port. L’échelle continue.' },
  { name: 'Iron Seat', nameFr: 'Siège de fer', line: 'Iron seat. Still status only.', lineFr: 'Siège de fer. Toujours un statut seulement.' },
  { name: 'Silver Seat', nameFr: 'Siège d’argent', line: 'Silver seat. Wins stay on their own board.', lineFr: 'Siège d’argent. Les victoires restent sur leur plateau.' },
  { name: 'Lantern Seat', nameFr: 'Siège de la lanterne', line: 'A lantern seat.', lineFr: 'Un siège de la lanterne.' },
  { name: 'Gold Seat', nameFr: 'Siège d’or', line: 'Gold seat. Thrones are not team points.', lineFr: 'Siège d’or. Les trônes ne sont pas des points d’équipe.' },
  { name: 'Crown Seat', nameFr: 'Siège de la couronne', line: 'A higher seat. The ladder continues.', lineFr: 'Un siège plus haut. L’échelle continue.' },
  { name: 'Dawn Seat', nameFr: 'Siège de l’aube', line: 'Named seats end here. The ladder does not.', lineFr: 'Les sièges nommés s’arrêtent ici. L’échelle, non.' },
]

const LINES = [
  { line: 'A further seat on the same ladder.', lineFr: 'Un siège de plus sur la même échelle.' },
  { line: 'Status only.', lineFr: 'Statut seulement.' },
  { line: 'The count keeps climbing.', lineFr: 'Le compte continue.' },
]

/** Steps up from 5×5 easy. One size larger and one difficulty harder each count as one. */
export function boardSteps(size: number, difficulty: number): number {
  const sizeSteps = Math.max(0, Math.min(8, Math.floor(size)) - 5)
  const diffSteps = Math.max(0, Math.min(3, Math.floor(difficulty)))
  return sizeSteps + diffSteps
}

/** Wins required for throne `id` (1-based) on a board that many steps up. */
export function winsNeeded(id: number, steps = 0): number {
  return Math.max(1, 10 * id - Math.max(0, steps))
}

export function boardKey(size: number, difficulty: number): string {
  const safeSize = Math.min(8, Math.max(5, Math.floor(size)))
  const safeDiff = Math.min(3, Math.max(0, Math.floor(difficulty)))
  return `${safeSize}:${safeDiff}`
}

export function parseBoardKey(key: string): { size: number; difficulty: number } | null {
  const match = /^([5-8]):([0-3])$/.exec(key)
  if (!match) return null
  return { size: Number(match[1]), difficulty: Number(match[2]) }
}

/** Read size and difficulty from a puzzle id (`6.1.daily-…`). Unknown ids count as that size on easy. */
export function boardFromPuzzleId(puzzleId: string, size: number): { size: number; difficulty: number; key: string } {
  const safeSize = Math.min(8, Math.max(5, Math.floor(size)))
  const match = /^([5-8])\.([0-3])\./.exec(puzzleId)
  if (match && Number(match[1]) === safeSize) {
    const difficulty = Number(match[2])
    return { size: safeSize, difficulty, key: boardKey(safeSize, difficulty) }
  }
  return { size: safeSize, difficulty: 0, key: boardKey(safeSize, 0) }
}

/** Highest throne a single board's wins have reached. 0 if none. */
export function throneIdForBoard(wins: number, steps: number): number {
  if (wins <= 0) return 0
  let id = Math.floor((wins + Math.max(0, steps)) / 10)
  while (id > 0 && wins < winsNeeded(id, steps)) id -= 1
  return id
}

/** A bare total, or a missing breakdown, counts as wins on 5×5 easy. */
export function winMap(input: { wins?: number; winsByBoard?: WinMap | null }): WinMap {
  const raw = input.winsByBoard
  if (raw) {
    const out: WinMap = {}
    for (const [key, count] of Object.entries(raw)) {
      if (parseBoardKey(key) && typeof count === 'number' && count > 0) out[key] = Math.floor(count)
    }
    if (Object.keys(out).length) return out
  }
  const wins = input.wins ?? 0
  return wins > 0 ? { '5:0': wins } : {}
}

export function throneForBoards(map: WinMap): Throne | null {
  let best = 0
  for (const [key, count] of Object.entries(map)) {
    const board = parseBoardKey(key)
    if (!board) continue
    best = Math.max(best, throneIdForBoard(count, boardSteps(board.size, board.difficulty)))
  }
  return best > 0 ? throneAt(best - 1) : null
}

/** Throne number `index` starting at 0. Unlimited. `wins` is the easy-board threshold. */
export function throneAt(index: number): Throne {
  if (index < 0) throw new Error('throne index')
  const id = index + 1
  const named = NAMED[index]
  const extra = LINES[index % LINES.length]
  return {
    id,
    name: named?.name ?? `Seat ${id}`,
    nameFr: named?.nameFr ?? `Siège ${id}`,
    wins: winsNeeded(id),
    line: named?.line ?? extra.line,
    lineFr: named?.lineFr ?? extra.lineFr,
  }
}

export const THRONES: Throne[] = Array.from({ length: NAMED.length }, (_, index) => throneAt(index))

/** Treat a single total as wins on the smallest easy board. */
export function throneForWins(wins: number): Throne | null {
  return throneForBoards(winMap({ wins }))
}

export function throneProgress(winsOnBoard: number, steps = 0): { held: Throne | null; next: Throne; into: number; need: number; left: number } {
  const id = throneIdForBoard(winsOnBoard, steps)
  const held = id > 0 ? throneAt(id - 1) : null
  const next = throneAt(id)
  const heldAt = id === 0 ? 0 : winsNeeded(id, steps)
  const nextAt = winsNeeded(id + 1, steps)
  return { held, next, into: Math.max(0, winsOnBoard - heldAt), need: nextAt - heldAt, left: Math.max(0, nextAt - winsOnBoard) }
}
