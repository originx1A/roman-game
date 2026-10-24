import { idx, regionConnected, type Puzzle } from './logic.ts'

export type Difficulty = 0 | 1 | 2 | 3

export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * America/Toronto calendar day, so the daily board is shared.
 * Sheet 05 draws that board as 6×6. That is the size on the frame, not a separate rule.
 */
export function torontoDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** One column per row. Adjacent rows stay at least two columns apart so buddies cannot touch. */
function placeColumns(size: number, rng: () => number): number[] | null {
  const col = Array<number>(size).fill(-1)
  const used = Array<boolean>(size).fill(false)
  const go = (row: number): boolean => {
    const options = shuffle(
      Array.from({ length: size }, (_, c) => c).filter((c) => !used[c]),
      rng,
    )
    for (const c of options) {
      if (row > 0 && Math.abs(col[row - 1] - c) <= 1) continue
      col[row] = c
      used[c] = true
      if (row === size - 1 || go(row + 1)) return true
      used[c] = false
      col[row] = -1
    }
    return false
  }
  return go(0) ? col : null
}

function growRegions(size: number, columns: number[], rng: () => number, difficulty: Difficulty): number[] {
  const regions = Array<number>(size * size).fill(-1)
  columns.forEach((col, row) => {
    regions[idx(row, col, size)] = row
  })
  const open: number[] = []
  for (let i = 0; i < regions.length; i++) if (regions[i] < 0) open.push(i)
  let guard = 0
  while (open.length && guard < size * size * 40) {
    guard++
    let placed = false
    for (let k = open.length - 1; k >= 0; k--) {
      const i = open[k]
      const row = Math.floor(i / size)
      const col = i % size
      const neighbors: number[] = []
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nr = row + dr
        const nc = col + dc
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue
        const region = regions[idx(nr, nc, size)]
        if (region >= 0) neighbors.push(region)
      }
      if (!neighbors.length) continue
      const pick =
        difficulty === 0
          ? neighbors.sort((a, b) => count(regions, a) - count(regions, b))[0]
          : difficulty >= 2
            ? neighbors[Math.floor(rng() * neighbors.length)]
            : neighbors.sort((a, b) => count(regions, b) - count(regions, a))[0]
      regions[i] = pick
      open.splice(k, 1)
      placed = true
    }
    if (!placed) break
  }
  return regions
}

function count(regions: number[], id: number): number {
  let n = 0
  for (const region of regions) if (region === id) n++
  return n
}

export function makePuzzle(size: number, difficulty: Difficulty, seedText: string): Puzzle {
  const safeSize = Math.min(8, Math.max(5, size))
  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = mulberry32(hashSeed(`${seedText}:${attempt}`))
    const columns = placeColumns(safeSize, rng)
    if (!columns) continue
    const regions = growRegions(safeSize, columns, rng, difficulty)
    if (regions.some((region) => region < 0)) continue
    if (!regionConnected(safeSize, regions)) continue
    const solution = columns.map((col, row) => idx(row, col, safeSize))
    return {
      id: `${safeSize}.${difficulty}.${seedText}`,
      size: safeSize,
      regions,
      solution,
    }
  }
  throw new Error(`Could not build a ${safeSize} board`)
}

export function dailyPuzzle(now = new Date()): Puzzle {
  return makePuzzle(6, 1, `daily-${torontoDate(now)}`)
}

/** Rebuild the board from its id. A made-up id does not count. */
export function puzzleFromId(puzzleId: string): Puzzle | null {
  const match = /^([5-8])\.([0-3])\.(.{1,100})$/.exec(puzzleId)
  if (!match) return null
  const size = Number(match[1])
  const difficulty = Number(match[2]) as Difficulty
  try {
    const puzzle = makePuzzle(size, difficulty, match[3])
    return puzzle.id === puzzleId ? puzzle : null
  } catch {
    return null
  }
}
