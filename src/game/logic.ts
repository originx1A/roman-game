/** Queens-style board: one buddy per row, column and region. Buddies cannot touch, even on a corner. */

export type Cell = 'empty' | 'mark' | 'buddy'

export interface Puzzle {
  id: string
  size: number
  /** Region id per cell, row-major. */
  regions: number[]
  /** Cell indexes of the one solution. */
  solution: number[]
}

export function idx(row: number, col: number, size: number): number {
  return row * size + col
}

export function rowOf(i: number, size: number): number {
  return Math.floor(i / size)
}

export function colOf(i: number, size: number): number {
  return i % size
}

export function touches(a: number, b: number, size: number): boolean {
  return Math.abs(rowOf(a, size) - rowOf(b, size)) <= 1 && Math.abs(colOf(a, size) - colOf(b, size)) <= 1
}

export type ConflictKind = 'touch' | 'row' | 'col' | 'region'

export function buddyIndexes(cells: Cell[]): number[] {
  const out: number[] = []
  cells.forEach((cell, i) => {
    if (cell === 'buddy') out.push(i)
  })
  return out
}

/** Conflicts among buddies already on the board. */
export function conflicts(puzzle: Puzzle, cells: Cell[]): Map<number, ConflictKind> {
  const size = puzzle.size
  const buddies = buddyIndexes(cells)
  const kinds = new Map<number, ConflictKind>()
  const mark = (i: number, kind: ConflictKind) => {
    if (!kinds.has(i)) kinds.set(i, kind)
  }
  const byRow = new Map<number, number[]>()
  const byCol = new Map<number, number[]>()
  const byRegion = new Map<number, number[]>()
  for (const i of buddies) {
    const row = rowOf(i, size)
    const col = colOf(i, size)
    const region = puzzle.regions[i]
    byRow.set(row, [...(byRow.get(row) ?? []), i])
    byCol.set(col, [...(byCol.get(col) ?? []), i])
    byRegion.set(region, [...(byRegion.get(region) ?? []), i])
  }
  for (const list of byRow.values()) if (list.length > 1) list.forEach((i) => mark(i, 'row'))
  for (const list of byCol.values()) if (list.length > 1) list.forEach((i) => mark(i, 'col'))
  for (const list of byRegion.values()) if (list.length > 1) list.forEach((i) => mark(i, 'region'))
  for (let a = 0; a < buddies.length; a++) {
    for (let b = a + 1; b < buddies.length; b++) {
      if (touches(buddies[a], buddies[b], size)) {
        mark(buddies[a], 'touch')
        mark(buddies[b], 'touch')
      }
    }
  }
  return kinds
}

export function isSolved(puzzle: Puzzle, cells: Cell[]): boolean {
  const buddies = buddyIndexes(cells)
  if (buddies.length !== puzzle.size) return false
  if (conflicts(puzzle, cells).size > 0) return false
  const seen = new Set<number>()
  for (const i of buddies) seen.add(puzzle.regions[i])
  return seen.size === puzzle.size
}

export function emptyBoard(size: number): Cell[] {
  return Array.from({ length: size * size }, () => 'empty' as Cell)
}

/** Cycle used by a tap: empty → X, X → buddy, buddy → empty. */
export function cycleCell(state: Cell): Cell {
  if (state === 'empty') return 'mark'
  if (state === 'mark') return 'buddy'
  return 'empty'
}

export function solutionSet(puzzle: Puzzle): Set<number> {
  return new Set(puzzle.solution)
}

/** Cells that can never hold a buddy given the buddies already placed. */
export function ruledOut(puzzle: Puzzle, cells: Cell[]): number[] {
  const size = puzzle.size
  const buddies = buddyIndexes(cells)
  const rows = new Set(buddies.map((i) => rowOf(i, size)))
  const cols = new Set(buddies.map((i) => colOf(i, size)))
  const regions = new Set(buddies.map((i) => puzzle.regions[i]))
  const out: number[] = []
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'empty') continue
    if (rows.has(rowOf(i, size)) || cols.has(colOf(i, size)) || regions.has(puzzle.regions[i])) {
      out.push(i)
      continue
    }
    if (buddies.some((b) => touches(b, i, size))) out.push(i)
  }
  return out
}

export function regionConnected(size: number, regions: number[]): boolean {
  const ids = new Set(regions)
  for (const id of ids) {
    const cells: number[] = []
    regions.forEach((region, i) => {
      if (region === id) cells.push(i)
    })
    if (cells.length === 0) return false
    const mine = new Set(cells)
    const seen = new Set<number>([cells[0]])
    const queue = [cells[0]]
    while (queue.length) {
      const i = queue.pop()!
      const row = rowOf(i, size)
      const col = colOf(i, size)
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nr = row + dr
        const nc = col + dc
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue
        const j = idx(nr, nc, size)
        if (mine.has(j) && !seen.has(j)) {
          seen.add(j)
          queue.push(j)
        }
      }
    }
    if (seen.size !== cells.length) return false
  }
  return true
}

const SIZES = new Set([5, 6, 7, 8])

export function isCellBoard(value: unknown, size: number): value is Cell[] {
  return Array.isArray(value) && value.length === size * size && value.every((cell) => cell === 'empty' || cell === 'mark' || cell === 'buddy')
}

/** A board the server is willing to store: real size, connected regions, and a solution that actually solves it. */
export function puzzlePlayable(puzzle: unknown): puzzle is Puzzle {
  if (!puzzle || typeof puzzle !== 'object') return false
  const row = puzzle as Partial<Puzzle>
  const size = row.size
  if (typeof size !== 'number' || !SIZES.has(size)) return false
  if (!Array.isArray(row.regions) || row.regions.length !== size * size) return false
  if (!row.regions.every((region) => Number.isInteger(region) && region >= 0 && region < size)) return false
  if (!regionConnected(size, row.regions)) return false
  if (!Array.isArray(row.solution) || row.solution.length !== size) return false
  const cells = emptyBoard(size)
  const seen = new Set<number>()
  for (const index of row.solution) {
    if (!Number.isInteger(index) || index < 0 || index >= size * size || seen.has(index)) return false
    seen.add(index)
    cells[index] = 'buddy'
  }
  const ready: Puzzle = { id: 'check', size, regions: row.regions, solution: row.solution }
  return isSolved(ready, cells)
}
