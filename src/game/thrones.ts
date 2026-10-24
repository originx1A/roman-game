/**
 * Throne ladder. Total wins over all play, not one run.
 * Tony's count, on the smallest / easiest board (5×5, easy):
 * throne 1 = 10 wins, throne 2 = 20, then +10 each throne.
 * Each throne steps the board up once (difficulty, then size). That step
 * takes one win off the +10, so the thresholds are 10, 19, 28, 37…
 * which is 9 × throne number + 1. The ladder does not stop.
 * Thrones are status only. They are not team points.
 */

export interface Throne {
  id: number
  name: string
  nameFr: string
  /** Total wins required when this throne's own board is the one being played. */
  wins: number
  /** 0 easy, 1 medium, 2 hard. */
  difficulty: 0 | 1 | 2
  size: 5 | 6 | 7 | 8
  line: string
  lineFr: string
}

const NAMED: { name: string; nameFr: string; line: string; lineFr: string }[] = [
  { name: 'First Seat', nameFr: 'Premier siège', line: 'Ten wins on the small easy board.', lineFr: 'Dix victoires sur le petit plateau facile.' },
  { name: 'Stone Seat', nameFr: 'Siège de pierre', line: 'A stone seat. Status only.', lineFr: 'Un siège de pierre. Statut seulement.' },
  { name: 'Cedar Seat', nameFr: 'Siège de cèdre', line: 'The board steps up.', lineFr: 'Le plateau monte d’un cran.' },
  { name: 'River Seat', nameFr: 'Siège de la rivière', line: 'A wider board from here.', lineFr: 'Un plateau plus large à partir d’ici.' },
  { name: 'Amber Seat', nameFr: 'Siège d’ambre', line: 'Your highest throne shows beside your name.', lineFr: 'Ton plus haut trône s’affiche près de ton nom.' },
  { name: 'Harbor Seat', nameFr: 'Siège du port', line: 'Seven across, when the ladder reaches it.', lineFr: 'Sept de large, quand l’échelle y arrive.' },
  { name: 'Iron Seat', nameFr: 'Siège de fer', line: 'Iron seat. Still status only.', lineFr: 'Siège de fer. Toujours un statut seulement.' },
  { name: 'Silver Seat', nameFr: 'Siège d’argent', line: 'Harder regions from this seat.', lineFr: 'Des régions plus dures à partir de ce siège.' },
  { name: 'Lantern Seat', nameFr: 'Siège de la lanterne', line: 'The wide boards are open.', lineFr: 'Les grands plateaux sont ouverts.' },
  { name: 'Gold Seat', nameFr: 'Siège d’or', line: 'Gold seat. Thrones are not team points.', lineFr: 'Siège d’or. Les trônes ne sont pas des points d’équipe.' },
  { name: 'Crown Seat', nameFr: 'Siège de la couronne', line: 'A higher seat. The ladder continues.', lineFr: 'Un siège plus haut. L’échelle continue.' },
  { name: 'Dawn Seat', nameFr: 'Siège de l’aube', line: 'Named seats end here. The ladder does not.', lineFr: 'Les sièges nommés s’arrêtent ici. L’échelle, non.' },
]

const LINES = [
  { line: 'A further seat on the same ladder.', lineFr: 'Un siège de plus sur la même échelle.' },
  { line: 'Status only, one step harder.', lineFr: 'Statut seulement, un cran plus dur.' },
  { line: 'The wide board stays. The count keeps climbing.', lineFr: 'Le grand plateau reste. Le compte continue.' },
]

/** Wins required for throne `id` (1-based). 10, 19, 28, 37… */
export function winsNeeded(id: number): number {
  return 9 * id + 1
}

function boardFor(id: number): { size: 5 | 6 | 7 | 8; difficulty: 0 | 1 | 2 } {
  const steps = Math.max(0, id - 1)
  const size = Math.min(8, 5 + Math.floor(steps / 3)) as 5 | 6 | 7 | 8
  const difficulty = (steps % 3) as 0 | 1 | 2
  return { size, difficulty }
}

/** Throne number `index` starting at 0. Unlimited. */
export function throneAt(index: number): Throne {
  if (index < 0) throw new Error('throne index')
  const id = index + 1
  const board = boardFor(id)
  const named = NAMED[index]
  const extra = LINES[index % LINES.length]
  return {
    id,
    name: named?.name ?? `Seat ${id}`,
    nameFr: named?.nameFr ?? `Siège ${id}`,
    wins: winsNeeded(id),
    difficulty: board.difficulty,
    size: board.size,
    line: named?.line ?? extra.line,
    lineFr: named?.lineFr ?? extra.lineFr,
  }
}

export const THRONES: Throne[] = Array.from({ length: NAMED.length }, (_, index) => throneAt(index))

export function throneForWins(wins: number): Throne | null {
  if (wins < 10) return null
  const id = Math.floor((wins - 1) / 9)
  if (id < 1) return null
  return throneAt(id - 1)
}

export function nextThrone(wins: number): Throne {
  const held = throneForWins(wins)
  return throneAt(held ? held.id : 0)
}

export function throneProgress(wins: number): { held: Throne | null; next: Throne; into: number; need: number } {
  const held = throneForWins(wins)
  const next = nextThrone(wins)
  const base = held?.wins ?? 0
  return { held, next, into: Math.max(0, wins - base), need: next.wins - base }
}
