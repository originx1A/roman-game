import type { CellState, Puzzle } from './types'

export function idx(row: number, col: number, size: number): number {
  return row * size + col
}

export function rowOf(i: number, size: number): number {
  return Math.floor(i / size)
}

export function colOf(i: number, size: number): number {
  return i % size
}

export function neighbors8(i: number, size: number): number[] {
  const r = rowOf(i, size)
  const c = colOf(i, size)
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        out.push(idx(nr, nc, size))
      }
    }
  }
  return out
}

export function cycleCell(state: CellState): CellState {
  if (state === 'empty') return 'mark'
  if (state === 'mark') return 'stone'
  return 'empty'
}

export function stoneIndices(cells: CellState[]): number[] {
  const out: number[] = []
  cells.forEach((s, i) => {
    if (s === 'stone') out.push(i)
  })
  return out
}

export interface ConflictSet {
  cells: Set<number>
  reasons: string[]
  /** Primary conflict kinds for each bad cell index */
  kinds: Map<number, ConflictKind>
}

export type ConflictKind = 'touch' | 'row' | 'col' | 'region'

export function findConflicts(puzzle: Puzzle, cells: CellState[]): ConflictSet {
  const size = puzzle.size
  const stones = stoneIndices(cells)
  const bad = new Set<number>()
  const reasons: string[] = []
  const kinds = new Map<number, ConflictKind>()

  const mark = (i: number, kind: ConflictKind, reason: string) => {
    bad.add(i)
    if (!kinds.has(i)) kinds.set(i, kind)
    reasons.push(reason)
  }

  const byRow = new Map<number, number[]>()
  const byCol = new Map<number, number[]>()
  const byRegion = new Map<number, number[]>()

  for (const i of stones) {
    const r = rowOf(i, size)
    const c = colOf(i, size)
    const region = puzzle.regions[i]
    if (!byRow.has(r)) byRow.set(r, [])
    if (!byCol.has(c)) byCol.set(c, [])
    if (!byRegion.has(region)) byRegion.set(region, [])
    byRow.get(r)!.push(i)
    byCol.get(c)!.push(i)
    byRegion.get(region)!.push(i)
  }

  for (const [, list] of byRow) {
    if (list.length > 1) {
      list.forEach((i) => mark(i, 'row', 'More than one stone in a row'))
    }
  }
  for (const [, list] of byCol) {
    if (list.length > 1) {
      list.forEach((i) => mark(i, 'col', 'More than one stone in a column'))
    }
  }
  for (const [, list] of byRegion) {
    if (list.length > 1) {
      list.forEach((i) => mark(i, 'region', 'More than one stone in a region'))
    }
  }

  for (let a = 0; a < stones.length; a++) {
    for (let b = a + 1; b < stones.length; b++) {
      const i = stones[a]
      const j = stones[b]
      const dr = Math.abs(rowOf(i, size) - rowOf(j, size))
      const dc = Math.abs(colOf(i, size) - colOf(j, size))
      if (dr <= 1 && dc <= 1) {
        mark(i, 'touch', 'Stones are touching')
        mark(j, 'touch', 'Stones are touching')
      }
    }
  }

  return { cells: bad, reasons: [...new Set(reasons)], kinds }
}

/** Prefer touch > region > row/col for the placed cell */
export function conflictKindAt(
  puzzle: Puzzle,
  cells: CellState[],
  index: number,
): ConflictKind | null {
  const { cells: bad, kinds } = findConflicts(puzzle, cells)
  if (!bad.has(index)) return null
  return kinds.get(index) ?? 'touch'
}

export function isSolved(puzzle: Puzzle, cells: CellState[]): boolean {
  const stones = stoneIndices(cells)
  if (stones.length !== puzzle.size) return false
  if (findConflicts(puzzle, cells).cells.size > 0) return false

  const regions = new Set(puzzle.regions)
  for (const region of regions) {
    const count = stones.filter((i) => puzzle.regions[i] === region).length
    if (count !== 1) return false
  }
  return true
}

export function countFilled(cells: CellState[]): { stones: number; marks: number } {
  let stones = 0
  let marks = 0
  for (const s of cells) {
    if (s === 'stone') stones++
    else if (s === 'mark') marks++
  }
  return { stones, marks }
}

export function findHint(
  puzzle: Puzzle,
  cells: CellState[],
): { index: number; kind: 'stone' | 'mark'; explanation: string } | null {
  const size = puzzle.size
  const stones = stoneIndices(cells)
  // Guard: never throw if solution is missing/malformed
  const solutionSet = new Set(Array.isArray(puzzle.solution) ? puzzle.solution : [])
  const blocked = new Set<number>()

  cells.forEach((s, i) => {
    if (s === 'mark') blocked.add(i)
  })

  for (const s of stones) {
    const r = rowOf(s, size)
    const c = colOf(s, size)
    for (let i = 0; i < size * size; i++) {
      if (i === s) continue
      if (rowOf(i, size) === r || colOf(i, size) === c) blocked.add(i)
      if (puzzle.regions[i] === puzzle.regions[s]) blocked.add(i)
    }
    for (const n of neighbors8(s, size)) blocked.add(n)
  }

  const tryStone = (
    index: number,
    explanation: string,
  ): { index: number; kind: 'stone' | 'mark'; explanation: string } | null => {
    if (cells[index] !== 'empty') return null
    const trial = [...cells]
    trial[index] = 'stone'
    if (findConflicts(puzzle, trial).cells.size > 0) return null
    return { index, kind: 'stone', explanation }
  }

  const candidates = (filter: (i: number) => boolean): number[] => {
    const list: number[] = []
    for (let i = 0; i < size * size; i++) {
      if (cells[i] === 'stone') continue
      if (blocked.has(i)) continue
      if (filter(i)) list.push(i)
    }
    return list
  }

  for (let region = 0; region < size; region++) {
    const open = candidates((i) => puzzle.regions[i] === region)
    const already = stones.some((i) => puzzle.regions[i] === region)
    if (!already && open.length === 1) {
      const hit = tryStone(open[0], 'Only one safe cell left in this region.')
      if (hit) return hit
    }
  }

  for (let r = 0; r < size; r++) {
    const open = candidates((i) => rowOf(i, size) === r)
    const already = stones.some((i) => rowOf(i, size) === r)
    if (!already && open.length === 1) {
      const hit = tryStone(open[0], 'Only one safe cell left in this row.')
      if (hit) return hit
    }
  }

  for (let c = 0; c < size; c++) {
    const open = candidates((i) => colOf(i, size) === c)
    const already = stones.some((i) => colOf(i, size) === c)
    if (!already && open.length === 1) {
      const hit = tryStone(open[0], 'Only one safe cell left in this column.')
      if (hit) return hit
    }
  }

  // Prefer safe X marks that touch an existing stone AND are not a solution cell
  for (const s of stones) {
    for (const n of neighbors8(s, size)) {
      if (cells[n] === 'empty' && !solutionSet.has(n)) {
        return {
          index: n,
          kind: 'mark',
          explanation: 'This cell touches a stone — mark it out.',
        }
      }
    }
  }

  // Only place a solution buddy if it doesn't conflict with the current board
  for (const sol of puzzle.solution) {
    const hit = tryStone(sol, 'A safe placement from the unique solution.')
    if (hit) return hit
  }

  return null
}

export function applyHint(
  cells: CellState[],
  hint: { index: number; kind: 'stone' | 'mark' },
): CellState[] {
  const next = [...cells]
  next[hint.index] = hint.kind === 'stone' ? 'stone' : 'mark'
  return next
}

/**
 * Rare rescue: find a buddy placed somewhere that is NOT part of the unique solution
 * (or that currently causes a conflict). Returns index to clear.
 */
export function findMisplacedBuddy(
  puzzle: Puzzle,
  cells: CellState[],
): { index: number; explanation: string } | null {
  const solutionSet = new Set(Array.isArray(puzzle.solution) ? puzzle.solution : [])
  const conflicts = findConflicts(puzzle, cells)

  // Prefer conflicted wrong stones
  for (const i of conflicts.cells) {
    if (cells[i] === 'stone' && !solutionSet.has(i)) {
      return {
        index: i,
        explanation: 'This buddy is in the wrong spot — clearing it.',
      }
    }
  }

  // Any stone not in the solution
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === 'stone' && !solutionSet.has(i)) {
      return {
        index: i,
        explanation: 'This buddy does not belong here — clearing it.',
      }
    }
  }

  // Conflicted stone that happens to be on a solution cell but still illegal with current board
  for (const i of conflicts.cells) {
    if (cells[i] === 'stone') {
      return {
        index: i,
        explanation: 'This buddy is causing trouble — clearing it.',
      }
    }
  }

  return null
}

export function clearBuddy(cells: CellState[], index: number): CellState[] {
  const next = [...cells]
  if (next[index] === 'stone') next[index] = 'empty'
  return next
}

export function emptyBoard(size: number): CellState[] {
  return Array.from({ length: size * size }, () => 'empty')
}

/** Score: faster + fewer hints = higher. Base scales with size. */
export function scoreRun(opts: {
  size: number
  elapsedMs: number
  hintsUsed: number
  perfect: boolean
}): number {
  const base = opts.size * 200
  const timeBonus = Math.max(0, 400 - Math.floor(opts.elapsedMs / 1000) * 4)
  const hintPenalty = opts.hintsUsed * 40
  const perfectBonus = opts.perfect ? 150 : 0
  return Math.max(50, base + timeBonus - hintPenalty + perfectBonus)
}
