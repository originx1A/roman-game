import type { Difficulty, Puzzle } from './types'

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function rng() {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function idx(row: number, col: number, size: number) {
  return row * size + col
}

function rowOf(i: number, size: number) {
  return Math.floor(i / size)
}

function colOf(i: number, size: number) {
  return i % size
}

function neighbors4(i: number, size: number) {
  const r = rowOf(i, size)
  const c = colOf(i, size)
  const out: number[] = []
  if (r > 0) out.push(idx(r - 1, c, size))
  if (r < size - 1) out.push(idx(r + 1, c, size))
  if (c > 0) out.push(idx(r, c - 1, size))
  if (c < size - 1) out.push(idx(r, c + 1, size))
  return out
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomPlacement(size: number, rng: () => number): number[] | null {
  const cols: number[] = []
  const used = new Set<number>()

  function ok(row: number, col: number) {
    if (used.has(col)) return false
    for (let r = 0; r < row; r++) {
      const c = cols[r]
      if (Math.max(row - r, Math.abs(col - c)) < 2) return false
    }
    return true
  }

  function place(row: number): boolean {
    if (row === size) return true
    for (const col of shuffle([...Array(size).keys()], rng)) {
      if (!ok(row, col)) continue
      cols[row] = col
      used.add(col)
      if (place(row + 1)) return true
      used.delete(col)
    }
    return false
  }

  if (!place(0)) return null
  return cols.map((col, row) => idx(row, col, size))
}

function regionsConnected(regions: number[], size: number): boolean {
  const n = size * size
  for (let rid = 0; rid < size; rid++) {
    const cells: number[] = []
    for (let i = 0; i < n; i++) if (regions[i] === rid) cells.push(i)
    if (!cells.length) return false
    const seen = new Set([cells[0]])
    const q = [cells[0]]
    while (q.length) {
      const cur = q.pop()!
      for (const nb of neighbors4(cur, size)) {
        if (regions[nb] === rid && !seen.has(nb)) {
          seen.add(nb)
          q.push(nb)
        }
      }
    }
    if (seen.size !== cells.length) return false
  }
  return true
}

function growRegions(size: number, stones: number[], rng: () => number): number[] | null {
  const n = size * size
  const regions = Array(n).fill(-1)
  const frontiers: Set<number>[] = Array.from({ length: size }, () => new Set())
  const counts = Array(size).fill(1)
  const targets = Array(size).fill(1)
  let left = n - size
  while (left > 0) {
    targets[Math.floor(rng() * size)]++
    left--
  }

  for (let r = 0; r < size; r++) regions[stones[r]] = r
  for (let r = 0; r < size; r++) {
    for (const nb of neighbors4(stones[r], size)) {
      if (regions[nb] === -1) frontiers[r].add(nb)
    }
  }

  let remaining = n - size
  while (remaining > 0) {
    const eligible: number[] = []
    for (let r = 0; r < size; r++) {
      for (const cell of [...frontiers[r]]) {
        if (regions[cell] !== -1) frontiers[r].delete(cell)
      }
      if (frontiers[r].size > 0) eligible.push(r)
    }
    if (!eligible.length) return null

    const under = eligible.filter((r) => counts[r] < targets[r])
    const pool = under.length ? under : eligible
    let totalW = 0
    const weights = pool.map((r) => {
      const w = 1 + Math.max(0, targets[r] - counts[r])
      totalW += w
      return w
    })
    let pick = rng() * totalW
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
      for (const nb of neighbors4(cell, size)) if (regions[nb] === -1) free++
      const score = free + rng() * 0.5
      if (score < bestScore) {
        bestScore = score
        best = cell
      }
    }

    frontiers[regionId].delete(best)
    regions[best] = regionId
    counts[regionId]++
    remaining--
    for (const nb of neighbors4(best, size)) {
      if (regions[nb] === -1) frontiers[regionId].add(nb)
    }
  }

  if (!regionsConnected(regions, size)) return null
  return regions
}

function countSolutions(regions: number[], size: number, limit = 2): number {
  const n = size * size
  const cellsByRegion: number[][] = Array.from({ length: size }, () => [])
  for (let i = 0; i < n; i++) cellsByRegion[regions[i]].push(i)
  for (let r = 0; r < size; r++) if (!cellsByRegion[r].length) return 0

  let found = 0
  const usedCol = Array(size).fill(false)
  const usedRegion = Array(size).fill(false)
  const placed: number[] = []

  function conflictsAdj(row: number, col: number) {
    for (const p of placed) {
      if (Math.max(Math.abs(row - rowOf(p, size)), Math.abs(col - colOf(p, size))) < 2) return true
    }
    return false
  }

  function dfs(row: number) {
    if (found >= limit) return
    if (row === size) {
      found++
      return
    }
    for (let col = 0; col < size; col++) {
      if (usedCol[col] || conflictsAdj(row, col)) continue
      const i = idx(row, col, size)
      const rid = regions[i]
      if (usedRegion[rid]) continue
      usedCol[col] = true
      usedRegion[rid] = true
      placed.push(i)
      dfs(row + 1)
      placed.pop()
      usedCol[col] = false
      usedRegion[rid] = false
      if (found >= limit) return
    }
  }

  dfs(0)
  return found
}

function isKnownSolution(regions: number[], size: number, stones: number[]): boolean {
  if (stones.length !== size) return false
  const usedRegion = new Set<number>()
  const usedCol = new Set<number>()
  for (const s of stones) {
    const c = colOf(s, size)
    if (usedCol.has(c)) return false
    usedCol.add(c)
    const rid = regions[s]
    if (usedRegion.has(rid)) return false
    usedRegion.add(rid)
  }
  const rows = stones.map((s) => rowOf(s, size)).sort((a, b) => a - b)
  for (let i = 0; i < size; i++) if (rows[i] !== i) return false
  for (let a = 0; a < size; a++) {
    for (let b = a + 1; b < size; b++) {
      const dr = Math.abs(rowOf(stones[a], size) - rowOf(stones[b], size))
      const dc = Math.abs(colOf(stones[a], size) - colOf(stones[b], size))
      if (Math.max(dr, dc) < 2) return false
    }
  }
  return usedRegion.size === size
}

const SIZE_BY_DIFF: Record<Difficulty, number> = {
  easy: 5,
  medium: 6,
  hard: 7,
  expert: 8,
}

const NAME_BITS = [
  'Nova', 'Tide', 'Frost', 'Bloom', 'Spark', 'Ridge', 'Glow', 'Quill', 'Ash', 'Pearl',
  'Maple', 'River', 'Comet', 'Dusk', 'Fern', 'Jade', 'Storm', 'Coral', 'Mist', 'Flare',
]

export function difficultyForSize(size: number): Difficulty {
  if (size <= 5) return 'easy'
  if (size === 6) return 'medium'
  if (size === 7) return 'hard'
  return 'expert'
}

/**
 * Generate a fresh uniquely solvable board. Caps attempts so UI stays snappy;
 * larger boards may fail occasionally — caller should retry or fall back.
 */
export function generateRandomPuzzle(
  difficulty: Difficulty,
  seed = (Math.random() * 0xffffffff) >>> 0,
): Puzzle | null {
  const size = SIZE_BY_DIFF[difficulty]
  const maxAttempts = size <= 5 ? 2500 : size === 6 ? 4500 : size === 7 ? 6000 : 8000
  const name = `${NAME_BITS[seed % NAME_BITS.length]} ${((seed >>> 8) % 900) + 100}`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = mulberry32((seed + attempt * 9973 + attempt * attempt * 13) >>> 0)
    const stones = randomPlacement(size, rng)
    if (!stones) continue
    const growRng = mulberry32((seed ^ (attempt * 0x85ebca6b) ^ 0xc2b2ae35) >>> 0)
    const regions = growRegions(size, stones, growRng)
    if (!regions) continue
    if (!isKnownSolution(regions, size, stones)) continue
    if (countSolutions(regions, size, 2) !== 1) continue

    return {
      id: `gen-${seed.toString(36)}-${attempt.toString(36)}`,
      name,
      size,
      regions,
      solution: stones,
      difficulty,
    }
  }
  return null
}
