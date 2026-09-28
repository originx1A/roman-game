import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const R = await import('../src/game/remix.ts')
const { countSolutions } = await import('../src/game/generatePuzzle.ts')
const { torontoDateKey } = await import('../src/game/replay.ts')

const at = (iso: string) => new Date(iso)

test('a new set every 3 days at midnight Toronto, same for everyone', () => {
  assert.equal(R.remixSetForKey('2026-09-28'), 0)
  assert.equal(R.remixSetForKey('2026-09-30'), 0)
  assert.equal(R.remixSetForKey('2026-10-01'), 1)
  assert.equal(R.remixSetForKey('2026-09-27'), -1)
  assert.equal(R.remixSetStartKey(1), '2026-10-01')
  assert.equal(R.remixSetStartKey(-1), '2026-09-25')
  // 11:59 PM Toronto on Sep 30 (EDT = UTC-4) is still set 0; midnight starts set 1
  assert.equal(R.remixSetNow(at('2026-10-01T03:59:00Z')), 0)
  assert.equal(R.remixSetNow(at('2026-10-01T04:00:00Z')), 1)
  // Winter (EST = UTC-5): the rollover moves with the clock
  const winter = R.remixSetStartKey(R.remixSetForKey('2026-12-15') + 1)
  const mid = R.torontoMidnightMs(winter)
  assert.equal(new Date(mid).toISOString().slice(11, 16), '05:00')
  assert.equal(R.remixSetNow(new Date(mid - 60_000)) + 1, R.remixSetNow(new Date(mid)))
})

test('Toronto midnight across daylight-saving changes and the countdown', () => {
  assert.equal(new Date(R.torontoMidnightMs('2026-11-01')).toISOString(), '2026-11-01T04:00:00.000Z') // DST ends 2 AM that day
  assert.equal(new Date(R.torontoMidnightMs('2026-11-02')).toISOString(), '2026-11-02T05:00:00.000Z')
  assert.equal(new Date(R.torontoMidnightMs('2027-03-14')).toISOString(), '2027-03-14T05:00:00.000Z') // DST starts 2 AM that day
  assert.equal(new Date(R.torontoMidnightMs('2027-03-15')).toISOString(), '2027-03-15T04:00:00.000Z')
  const now = at('2026-09-28T23:30:00Z') // 7:30 PM Toronto, day 0 of set 0
  assert.equal(R.remixEndsAtMs(now), Date.parse('2026-10-01T04:00:00Z'))
  assert.equal(R.remixCountdownLabel(R.remixEndsAtMs(now) - now.getTime()), '2d 4h')
  assert.equal(R.remixCountdownLabel(5 * 3_600_000 + 12 * 60_000), '5h 12m')
  assert.equal(R.remixCountdownLabel(30_000), '1m')
  // every set is exactly 3 Toronto days (72 h, or 71/73 h across a clock change)
  for (let set = 0; set < 60; set++) {
    const len = (R.torontoMidnightMs(R.remixSetStartKey(set + 1)) - R.torontoMidnightMs(R.remixSetStartKey(set))) / 3_600_000
    assert.ok(len === 72 || len === 71 || len === 73, `set ${set}: ${len} h`)
    assert.equal(torontoDateKey(new Date(R.torontoMidnightMs(R.remixSetStartKey(set)))), R.remixSetStartKey(set))
  }
})

test('stable ids round-trip; old fallback-clone ids are not remix ids', () => {
  assert.equal(R.remixId(12, 8), 'rmx-12-8')
  assert.deepEqual(R.parseRemixId('rmx-12-8'), { set: 12, size: 8 })
  assert.deepEqual(R.parseRemixId('rmx--1-5'), { set: -1, size: 5 })
  assert.equal(R.parseRemixId('remix-dawn-lz3k'), null)
  assert.equal(R.parseRemixId('rmx-3-9'), null)
  assert.equal(R.parseRemixId('gen-abc-1'), null)
})

test('the same set gives the same boards; each has exactly one solution and fits the rules', () => {
  for (const set of [0, 1, 7]) {
    for (const size of [5, 6, 7] as const) {
      const a = R.buildRemixBoard(set, size)
      const b = R.buildRemixBoard(set, size)
      assert.ok(a && b, `set ${set} ${size}`)
      assert.deepEqual(a, b)
      assert.equal(a.id, `rmx-${set}-${size}`)
      assert.equal(a.size, size)
      assert.equal(a.regions.length, size * size)
      assert.equal(new Set(a.regions).size, size)
      assert.equal(a.solution.length, size)
      // one buddy per row, column and region, and none touching (even corners)
      const rows = new Set(a.solution.map((i) => Math.floor(i / size)))
      const cols = new Set(a.solution.map((i) => i % size))
      const regs = new Set(a.solution.map((i) => a.regions[i]))
      assert.equal(rows.size, size)
      assert.equal(cols.size, size)
      assert.equal(regs.size, size)
      for (const i of a.solution) for (const j of a.solution) {
        if (i === j) continue
        assert.ok(Math.abs(Math.floor(i / size) - Math.floor(j / size)) > 1 || Math.abs((i % size) - (j % size)) > 1, 'touching')
      }
      assert.equal(countSolutions(a.regions, size, 2), 1)
    }
    const next = R.buildRemixBoard(set + 1, 6)
    assert.notDeepEqual(next?.regions, R.buildRemixBoard(set, 6)?.regions, 'a new set brings new boards')
  }
})

test('the 8×8 is deterministic too (built lazily in the app)', () => {
  const a = R.buildRemixBoard(2, 8)
  assert.ok(a)
  assert.equal(a.size, 8)
  assert.deepEqual(R.buildRemixBoard(2, 8)?.regions, a.regions)
})

test('next remix board after a win: next uncleared size, wrapping; null when all four are done', () => {
  const cleared = new Set<number>([6])
  assert.equal(R.nextRemixSize(5, (s) => cleared.has(s)), 7)
  assert.equal(R.nextRemixSize(8, (s) => cleared.has(s)), 5)
  assert.equal(R.nextRemixSize(5, () => true), null)
})

test('endless boards are fresh and solvable-checked', () => {
  const a = R.buildEndlessBoard('easy', 12345)
  const b = R.buildEndlessBoard('easy', 99999)
  assert.ok(a && b)
  assert.notDeepEqual(a.regions, b.regions)
  assert.equal(countSolutions(a.regions, 5, 2), 1)
})
