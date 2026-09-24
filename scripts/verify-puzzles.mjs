#!/usr/bin/env node
/**
 * Verify every puzzle in src/game/puzzles.ts:
 * - provided solution is a valid complete placement
 * - solution stones are in different regions
 * - regions partition the board (n regions, connected optional check)
 * - count solutions via backtracking (limit 3); prefer exactly 1
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUZZLES_PATH = join(__dirname, '../src/game/puzzles.ts')

function idx(row, col, size) {
  return row * size + col
}

function rowOf(i, size) {
  return Math.floor(i / size)
}

function colOf(i, size) {
  return i % size
}

function neighbors4(i, size) {
  const r = rowOf(i, size)
  const c = colOf(i, size)
  const out = []
  if (r > 0) out.push(idx(r - 1, c, size))
  if (r < size - 1) out.push(idx(r + 1, c, size))
  if (c > 0) out.push(idx(r, c - 1, size))
  if (c < size - 1) out.push(idx(r, c + 1, size))
  return out
}

function regionsConnected(regions, size) {
  const n = size * size
  for (let rid = 0; rid < size; rid++) {
    const cells = []
    for (let i = 0; i < n; i++) if (regions[i] === rid) cells.push(i)
    if (cells.length === 0) return false
    const seen = new Set([cells[0]])
    const q = [cells[0]]
    while (q.length) {
      const cur = q.pop()
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

/** Regions partition: length n², ids are exactly 0..n-1 each at least once. */
function regionsPartition(regions, size) {
  const n = size * size
  if (regions.length !== n) return { ok: false, reason: `regions length ${regions.length} != ${n}` }
  const counts = Array(size).fill(0)
  for (const r of regions) {
    if (!Number.isInteger(r) || r < 0 || r >= size) {
      return { ok: false, reason: `invalid region id ${r}` }
    }
    counts[r]++
  }
  for (let i = 0; i < size; i++) {
    if (counts[i] === 0) return { ok: false, reason: `empty region ${i}` }
  }
  return { ok: true }
}

/**
 * Valid complete placement:
 * - n stones on n×n
 * - exactly one per row, column, region
 * - no two with Chebyshev distance < 2
 */
function isValidSolution(regions, size, stones) {
  if (!Array.isArray(stones) || stones.length !== size) {
    return { ok: false, reason: `expected ${size} stones, got ${stones?.length}` }
  }
  const usedRow = new Set()
  const usedCol = new Set()
  const usedRegion = new Set()
  for (const s of stones) {
    if (!Number.isInteger(s) || s < 0 || s >= size * size) {
      return { ok: false, reason: `stone index out of range: ${s}` }
    }
    const r = rowOf(s, size)
    const c = colOf(s, size)
    const rid = regions[s]
    if (usedRow.has(r)) return { ok: false, reason: `duplicate row ${r}` }
    if (usedCol.has(c)) return { ok: false, reason: `duplicate col ${c}` }
    if (usedRegion.has(rid)) return { ok: false, reason: `duplicate region ${rid}` }
    usedRow.add(r)
    usedCol.add(c)
    usedRegion.add(rid)
  }
  if (usedRow.size !== size || usedCol.size !== size || usedRegion.size !== size) {
    return { ok: false, reason: 'missing row/col/region coverage' }
  }
  for (let a = 0; a < size; a++) {
    for (let b = a + 1; b < size; b++) {
      const dr = Math.abs(rowOf(stones[a], size) - rowOf(stones[b], size))
      const dc = Math.abs(colOf(stones[a], size) - colOf(stones[b], size))
      if (Math.max(dr, dc) < 2) {
        return { ok: false, reason: `stones ${stones[a]} and ${stones[b]} adjacent` }
      }
    }
  }
  return { ok: true }
}

/** Count solutions up to `limit` via backtracking (one stone per row). */
function countSolutions(regions, size, limit = 3) {
  let found = 0
  const usedCol = Array(size).fill(false)
  const usedRegion = Array(size).fill(false)
  /** @type {number[]} */
  const placed = []

  function conflictsAdj(row, col) {
    for (let i = 0; i < placed.length; i++) {
      const pr = rowOf(placed[i], size)
      const pc = colOf(placed[i], size)
      if (Math.max(Math.abs(row - pr), Math.abs(col - pc)) < 2) return true
    }
    return false
  }

  function dfs(row) {
    if (found >= limit) return
    if (row === size) {
      found++
      return
    }
    for (let col = 0; col < size; col++) {
      if (usedCol[col]) continue
      if (conflictsAdj(row, col)) continue
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

/** Parse PUZZLES array from puzzles.ts without a TS loader. */
function loadPuzzlesFromTs(path) {
  const src = readFileSync(path, 'utf8')
  const match = src.match(/export const PUZZLES: Puzzle\[\] = (\[[\s\S]*?\n\])/)
  if (!match) throw new Error('Could not find PUZZLES array in puzzles.ts')
  // Evaluate as JSON-ish: replace trailing commas, unquoted keys already ok as JS
  // Use Function to evaluate the array literal (ids/names are quoted strings).
  const arr = new Function(`return (${match[1]})`)()
  return arr
}

function verifyPuzzle(p) {
  const size = p.size
  const part = regionsPartition(p.regions, size)
  const connected = part.ok ? regionsConnected(p.regions, size) : false
  const solCheck = part.ok ? isValidSolution(p.regions, size, p.solution) : { ok: false, reason: part.reason }
  const solCount = part.ok ? countSolutions(p.regions, size, 3) : 0

  const differentRegions =
    solCheck.ok &&
    new Set(p.solution.map((s) => p.regions[s])).size === size

  return {
    id: p.id,
    size,
    validSolution: solCheck.ok,
    differentRegions: !!differentRegions,
    regionsOk: part.ok && connected,
    solCount,
    reason: !part.ok
      ? part.reason
      : !connected
        ? 'regions not 4-connected'
        : !solCheck.ok
          ? solCheck.reason
          : solCount === 0
            ? 'no solutions'
            : undefined,
  }
}

function main() {
  const puzzles = loadPuzzlesFromTs(PUZZLES_PATH)
  const results = puzzles.map(verifyPuzzle)

  console.log(JSON.stringify(results, null, 2))

  const summary = results.map((r) => ({
    id: r.id,
    solCount: r.solCount,
    validSolution: r.validSolution,
  }))
  console.log('\n--- summary ---')
  for (const s of summary) {
    const flag =
      !s.validSolution || s.solCount === 0
        ? ' FAIL'
        : s.solCount !== 1
          ? ' WARN(multi)'
          : ' OK'
    console.log(`${s.id}: solCount=${s.solCount} validSolution=${s.validSolution}${flag}`)
  }

  const broken = results.filter((r) => !r.validSolution || r.solCount === 0 || !r.regionsOk || !r.differentRegions)
  if (broken.length) {
    console.error('\nBroken puzzles:')
    for (const b of broken) {
      console.error(`  ${b.id}: ${b.reason || 'check failed'} (solCount=${b.solCount}, valid=${b.validSolution}, regionsOk=${b.regionsOk}, differentRegions=${b.differentRegions})`)
    }
    process.exitCode = 1
  } else {
    console.log(`\nAll ${results.length} puzzles OK (prefer solCount===1).`)
  }
}

main()
