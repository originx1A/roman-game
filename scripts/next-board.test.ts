import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickNextBoard, type ClearInfo } from '../src/game/nextBoard.ts'
import fs from 'node:fs'

// Same shape as the real catalog: 4 sizes x 5 boards, level order
const B = [5, 6, 7, 8].flatMap((size) => [1, 2, 3, 4, 5].map((n) => ({ id: `s${size}-${n}`, size })))
const at = (min: number) => new Date(Date.UTC(2026, 8, 1, 0, min)).toISOString()
let clock = 0
const beat = (clears: ClearInfo[], id: string) => {
  const t = at(++clock)
  const rest = clears.filter((c) => c.puzzleId !== id)
  return [...rest, { puzzleId: id, lastClearedAt: t, clearedAt: t }]
}
const board = (id: string) => B.find((b) => b.id === id)!

test('real catalog: 4 sizes, 5 boards each', () => {
  const sizes = new Map<number, number>()
  const src = fs.readFileSync(new URL('../src/game/puzzles.ts', import.meta.url), 'utf8')
  const catalog = src.slice(src.indexOf('export const PUZZLES'), src.indexOf('export function getPuzzle'))
  for (const m of catalog.matchAll(/size: (\d+),/g)) sizes.set(+m[1], (sizes.get(+m[1]) ?? 0) + 1)
  assert.deepEqual([...sizes.entries()], [[5, 5], [6, 5], [7, 5], [8, 5]])
})

test('goes to an unbeaten board of the same size, in level order', () => {
  const clears = beat([], 's5-1')
  assert.equal(pickNextBoard(board('s5-1'), B, clears).id, 's5-2')
  // skips beaten ones
  const c2 = beat(beat(clears, 's5-2'), 's5-4')
  assert.equal(pickNextBoard(board('s5-4'), B, c2).id, 's5-3')
})

test('rolls over to the next size once a size is all beaten', () => {
  let clears: ClearInfo[] = []
  for (const n of [1, 2, 3, 4, 5]) clears = beat(clears, `s5-${n}`)
  assert.equal(pickNextBoard(board('s5-5'), B, clears).id, 's6-1')
  // a bigger size already finished is skipped
  for (const n of [1, 2, 3, 4, 5]) clears = beat(clears, `s6-${n}`)
  clears = beat(clears, 's8-1')
  assert.equal(pickNextBoard(board('s6-5'), B, clears).id, 's7-1')
})

test('after the biggest size, unbeaten smaller boards come next', () => {
  let clears: ClearInfo[] = []
  for (const b of B.filter((x) => x.size === 8)) clears = beat(clears, b.id)
  assert.equal(pickNextBoard(board('s8-5'), B, clears).id, 's5-1')
})

test('when everything is beaten it loops size by size, least recently played first', () => {
  let clears: ClearInfo[] = []
  let cur = B[0]
  clears = beat(clears, cur.id)
  const seq: string[] = [cur.id]
  // play 3 full rounds through "Next board"
  for (let i = 0; i < B.length * 3 - 1; i++) {
    const next = pickNextBoard(cur, B, clears)
    assert.notEqual(next.id, cur.id, 'never the board just finished')
    seq.push(next.id)
    clears = beat(clears, next.id)
    cur = next
  }
  // first pass is the level order; every later pass visits all 20 boards grouped by size, smallest first
  assert.deepEqual(seq.slice(0, 20), B.map((b) => b.id))
  for (const pass of [seq.slice(20, 40), seq.slice(40, 60)]) {
    assert.equal(new Set(pass).size, 20)
    assert.deepEqual(pass.map((id) => board(id).size), B.map((b) => b.size))
  }
  // within a size the replay order is least-recently-beaten first (same order as last pass)
  assert.deepEqual(seq.slice(40, 45), seq.slice(20, 25))
})

test('locked next size: stay and cycle the current size, least recently beaten first', () => {
  let clears: ClearInfo[] = []
  for (const n of [3, 1, 5, 2, 4]) clears = beat(clears, `s5-${n}`)
  const isSizeLocked = (s: number) => s >= 6
  const a = pickNextBoard(board('s5-4'), B, clears, { isSizeLocked })
  assert.equal(a.id, 's5-3')
  clears = beat(clears, a.id)
  const b = pickNextBoard(a, B, clears, { isSizeLocked })
  assert.equal(b.id, 's5-1')
  // still finds unbeaten boards in the current size before anything else
  assert.equal(pickNextBoard(board('s5-1'), B, beat([], 's5-1'), { isSizeLocked }).id, 's5-2')
})

test('never returns the board just played, whatever the save looks like', () => {
  const r = () => Math.random()
  for (let k = 0; k < 300; k++) {
    const clears: ClearInfo[] = B.filter(() => r() < 0.7).map((b) => ({ puzzleId: b.id, clearedAt: r() < 0.3 ? 'bad' : at(Math.floor(r() * 500)) }))
    const cur = B[Math.floor(r() * B.length)]
    const locked = r() < 0.3 ? (s: number) => s > cur.size : undefined
    assert.notEqual(pickNextBoard(cur, B, clears, { isSizeLocked: locked }).id, cur.id)
  }
})

test('a generated board (not in the list) still gets a catalog board of its size', () => {
  assert.equal(pickNextBoard({ id: 'gen-x', size: 7 }, B, []).id, 's7-1')
})
