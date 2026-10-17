import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const { dailyBoardForKey } = await import('../src/game/replay.ts')
const { getPuzzle } = await import('../src/game/puzzles.ts')

test('dailyBoardForKey is deterministic across calls', () => {
  const a = dailyBoardForKey('2026-10-17')
  const b = dailyBoardForKey('2026-10-17')
  assert.ok(a && b)
  assert.deepEqual(a.regions, b.regions)
  assert.deepEqual(a.solution, b.solution)
  assert.equal(a.id, 'daily-2026-10-17')
})

test('getPuzzle rebuilds daily ids for resume', () => {
  const p = getPuzzle('daily-2026-10-17')
  assert.ok(p, 'daily id must resolve')
  assert.equal(p.id, 'daily-2026-10-17')
  assert.deepEqual(p.regions, dailyBoardForKey('2026-10-17').regions)
})

test('getPuzzle still resolves hand-made, bad ids', () => {
  assert.equal(getPuzzle('dawn')?.id, 'dawn')
  assert.equal(getPuzzle('daily-not-a-date'), undefined)
  assert.equal(getPuzzle('nope'), undefined)
})

test('daily boards never collide with hand-made ids', () => {
  const p = getPuzzle('daily-2026-01-05')
  assert.ok(p && p.id.startsWith('daily-'))
})
