/**
 * Throne ladder. Counts total wins over all play.
 * Add a row to THRONES to insert a new named throne. Past the list, the ladder keeps going.
 * Thresholds are a placeholder until Tony measures them.
 */

export interface Throne {
  id: number
  name: string
  nameFr: string
  /** Total wins required to hold this throne. */
  wins: number
  /** 0 easy, 1 medium, 2 hard. Later thrones push boards harder. */
  difficulty: 0 | 1 | 2
  /** Board size this throne prefers in Survival. */
  size: 5 | 6 | 7 | 8
  line: string
  lineFr: string
}

export const THRONES: Throne[] = [
  { id: 1, name: 'First Seat', nameFr: 'Premier siège', wins: 1, difficulty: 0, size: 5, line: 'Your host pet takes the first seat.', lineFr: 'Ton animal hôte prend le premier siège.' },
  { id: 2, name: 'Stone Seat', nameFr: 'Siège de pierre', wins: 3, difficulty: 0, size: 5, line: 'A stone seat. Status only.', lineFr: 'Un siège de pierre. Statut seulement.' },
  { id: 3, name: 'Cedar Seat', nameFr: 'Siège de cèdre', wins: 6, difficulty: 0, size: 6, line: 'Boards grow a little.', lineFr: 'Les plateaux grandissent un peu.' },
  { id: 4, name: 'River Seat', nameFr: 'Siège de la rivière', wins: 10, difficulty: 1, size: 6, line: 'The next boards are a bit harder.', lineFr: 'Les prochains plateaux sont un peu plus durs.' },
  { id: 5, name: 'Amber Seat', nameFr: 'Siège d’ambre', wins: 15, difficulty: 1, size: 6, line: 'Your highest throne shows beside your name.', lineFr: 'Ton plus haut trône s’affiche près de ton nom.' },
  { id: 6, name: 'Harbor Seat', nameFr: 'Siège du port', wins: 21, difficulty: 1, size: 7, line: 'Seven across, from here.', lineFr: 'Sept de large, à partir d’ici.' },
  { id: 7, name: 'Iron Seat', nameFr: 'Siège de fer', wins: 28, difficulty: 1, size: 7, line: 'Iron seat. Still status only.', lineFr: 'Siège de fer. Toujours un statut seulement.' },
  { id: 8, name: 'Silver Seat', nameFr: 'Siège d’argent', wins: 36, difficulty: 2, size: 7, line: 'Harder regions from this seat.', lineFr: 'Des régions plus dures à partir de ce siège.' },
  { id: 9, name: 'Lantern Seat', nameFr: 'Siège de la lanterne', wins: 45, difficulty: 2, size: 8, line: 'The wide boards open.', lineFr: 'Les grands plateaux s’ouvrent.' },
  { id: 10, name: 'Gold Seat', nameFr: 'Siège d’or', wins: 55, difficulty: 2, size: 8, line: 'Gold seat. Thrones are not team points.', lineFr: 'Siège d’or. Les trônes ne sont pas des points d’équipe.' },
  { id: 11, name: 'Crown Seat', nameFr: 'Siège de la couronne', wins: 66, difficulty: 2, size: 8, line: 'A higher seat. The ladder continues.', lineFr: 'Un siège plus haut. L’échelle continue.' },
  { id: 12, name: 'Dawn Seat', nameFr: 'Siège de l’aube', wins: 78, difficulty: 2, size: 8, line: 'Named seats end here. The ladder does not.', lineFr: 'Les sièges nommés s’arrêtent ici. L’échelle, non.' },
]

/** Throne number `index` starting at 0. Unlimited. */
export function throneAt(index: number): Throne {
  if (index < 0) throw new Error('throne index')
  if (index < THRONES.length) return THRONES[index]
  const last = THRONES[THRONES.length - 1]
  const extra = index - THRONES.length + 1
  const size = (5 + (extra % 4)) as 5 | 6 | 7 | 8
  const difficulty = Math.min(2, 1 + Math.floor(extra / 3)) as 0 | 1 | 2
  const wins = last.wins + (extra * (8 + extra)) / 2
  return {
    id: index + 1,
    name: `Seat ${index + 1}`,
    nameFr: `Siège ${index + 1}`,
    wins: Math.round(wins),
    difficulty,
    size,
    line: 'A further seat on the same ladder.',
    lineFr: 'Un siège de plus sur la même échelle.',
  }
}

export function throneForWins(wins: number): Throne | null {
  let held: Throne | null = null
  for (let i = 0; i < 500 && throneAt(i).wins <= wins; i++) held = throneAt(i)
  return held
}

export function nextThrone(wins: number): Throne {
  for (let i = 0; i < 500; i++) {
    const throne = throneAt(i)
    if (throne.wins > wins) return throne
  }
  return throneAt(500)
}

export function throneProgress(wins: number): { held: Throne | null; next: Throne; into: number; need: number } {
  const held = throneForWins(wins)
  const next = nextThrone(wins)
  const base = held?.wins ?? 0
  return { held, next, into: Math.max(0, wins - base), need: next.wins - base }
}
