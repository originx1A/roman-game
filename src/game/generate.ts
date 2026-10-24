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

function neighbors4(cell: number, size: number): number[] {
  const row = Math.floor(cell / size)
  const col = cell % size
  const out: number[] = []
  if (row > 0) out.push(cell - size)
  if (row < size - 1) out.push(cell + size)
  if (col > 0) out.push(cell - 1)
  if (col < size - 1) out.push(cell + 1)
  return out
}

/** Each colour wants about `size` squares. Harder boards may differ by a few, not by a whole board. */
function regionTargets(size: number, rng: () => number, difficulty: Difficulty): number[] {
  const targets = Array<number>(size).fill(size)
  const slack = difficulty
  const min = Math.max(2, size - slack)
  const max = size + slack
  for (let step = 0; step < slack * size; step++) {
    const from = Math.floor(rng() * size)
    const to = Math.floor(rng() * size)
    if (from === to) continue
    if (targets[from] - 1 < min || targets[to] + 1 > max) continue
    targets[from]--
    targets[to]++
  }
  return targets
}

/**
 * Grow one connected colour around each solution square.
 * Medium used to claim the largest neighbour, so one colour ate the board.
 */
function growRegions(size: number, columns: number[], rng: () => number, difficulty: Difficulty): number[] {
  const n = size * size
  const regions = Array<number>(n).fill(-1)
  const frontiers: Set<number>[] = Array.from({ length: size }, () => new Set())
  const counts = Array<number>(size).fill(1)
  const targets = regionTargets(size, rng, difficulty)
  columns.forEach((col, row) => {
    regions[idx(row, col, size)] = row
  })
  columns.forEach((col, row) => {
    for (const cell of neighbors4(idx(row, col, size), size)) {
      if (regions[cell] === -1) frontiers[row].add(cell)
    }
  })

  let remaining = n - size
  while (remaining > 0) {
    const eligible: number[] = []
    for (let region = 0; region < size; region++) {
      for (const cell of [...frontiers[region]]) {
        if (regions[cell] !== -1) frontiers[region].delete(cell)
      }
      if (frontiers[region].size > 0 && counts[region] < targets[region]) eligible.push(region)
    }
    const pool = eligible.length
      ? eligible
      : frontiers.map((front, region) => (front.size > 0 ? region : -1)).filter((region) => region >= 0)
    if (!pool.length) break
    let total = 0
    const weights = pool.map((region) => {
      const weight = 1 + Math.max(0, targets[region] - counts[region])
      total += weight
      return weight
    })
    let pick = rng() * total
    let regionId = pool[0]
    for (let i = 0; i < pool.length; i++) {
      pick -= weights[i]
      if (pick <= 0) {
        regionId = pool[i]
        break
      }
    }
    const border = [...frontiers[regionId]]
    let best = border[0]
    let bestScore = Infinity
    for (const cell of border) {
      let free = 0
      for (const next of neighbors4(cell, size)) if (regions[next] === -1) free++
      const score = free + rng() * (difficulty === 0 ? 0.15 : 0.5)
      if (score < bestScore) {
        bestScore = score
        best = cell
      }
    }
    frontiers[regionId].delete(best)
    regions[best] = regionId
    counts[regionId]++
    remaining--
    for (const next of neighbors4(best, size)) {
      if (regions[next] === -1) frontiers[regionId].add(next)
    }
  }
  if (regions.some((region) => region < 0) || !evenRegions(size, regions, difficulty)) {
    return Array<number>(n).fill(-1)
  }
  return regions
}

function evenRegions(size: number, regions: number[], difficulty: Difficulty): boolean {
  const minWant = Math.max(2, size - difficulty)
  const maxWant = size + difficulty
  for (let guard = 0; guard < size * size * 8; guard++) {
    const counts = Array<number>(size).fill(0)
    for (const region of regions) counts[region]++
    const smallest = Math.min(...counts)
    const largest = Math.max(...counts)
    if (smallest >= minWant && largest <= maxWant) return true
    const from = counts.indexOf(largest)
    const to = counts.indexOf(smallest)
    const moved = moveBorderCell(size, regions, from, to)
    if (!moved) return false
  }
  return false
}

/** Give one border square from a large colour to a smaller neighbour, keeping both connected. */
function moveBorderCell(size: number, regions: number[], from: number, to: number): boolean {
  for (let cell = 0; cell < regions.length; cell++) {
    if (regions[cell] !== from) continue
    if (!neighbors4(cell, size).some((next) => regions[next] === to)) continue
    regions[cell] = to
    const fromOk = regionStillJoined(size, regions, from)
    const toOk = regionStillJoined(size, regions, to)
    if (fromOk && toOk) return true
    regions[cell] = from
  }
  return false
}

function regionStillJoined(size: number, regions: number[], id: number): boolean {
  const cells: number[] = []
  regions.forEach((region, cell) => {
    if (region === id) cells.push(cell)
  })
  if (cells.length === 0) return false
  const seen = new Set<number>([cells[0]])
  const queue = [cells[0]]
  while (queue.length) {
    const cell = queue.pop()!
    for (const next of neighbors4(cell, size)) {
      if (regions[next] === id && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen.size === cells.length
}

export function makePuzzle(size: number, difficulty: Difficulty, seedText: string): Puzzle {
  const safeSize = Math.min(8, Math.max(5, size))
  for (let attempt = 0; attempt < 48; attempt++) {
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
