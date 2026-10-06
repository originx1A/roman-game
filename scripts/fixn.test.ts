import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)

// a tiny localStorage so the storage-backed modules run in node
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
}
;(globalThis as any).window = globalThis

const R = await import('../src/game/replay.ts')
const RX = await import('../src/game/remix.ts')
const CH = await import('../src/game/challenges.ts')
const PZ = await import('../src/game/puzzles.ts')
const ST = await import('../src/game/storage.ts')

const T = (size: number) => R.targetsFor({ size, difficulty: 'easy' })
const run = (over: Record<string, unknown> = {}) => ({ puzzleId: 'dawn', mode: 'normal' as const, ms: 30000, score: 1200, undos: 0, splits: [1, 2, 3, 4, 5], targets: T(5), size: 5, ...over })

test('sanity floor: nobody clears a board in a couple of seconds', () => {
  assert.equal(R.timeFloorMs(5), 1500)
  assert.ok(R.timeFloorMs(8) > R.timeFloorMs(7) && R.timeFloorMs(7) > R.timeFloorMs(6) && R.timeFloorMs(6) > R.timeFloorMs(5))
  for (const size of [5, 6, 7, 8]) assert.ok(R.timeFloorMs(size) < R.targetsFor({ size }).timeMs / 8, 'far below any real target time')
  assert.equal(R.tooFast(5, 1400), true)
  assert.equal(R.tooFast(5, 1600), false)
})

test('a too-fast run is counted but never saved as a best, and gets at most 1 star', () => {
  const b0 = R.emptyRecords()
  const out = R.recordRun(b0, run({ ms: 900 }))
  assert.equal(out.result.tooFast, true)
  assert.equal(out.result.newBestTime, false)
  assert.equal(out.blob.levels.dawn.bestMs, undefined)
  assert.equal(out.blob.levels.dawn.stars, 1)
  assert.equal(out.blob.levels.dawn.clears, 1)
  // a real run afterwards is a first clear
  const real = R.recordRun(out.blob, run({ ms: 30000 }))
  assert.equal(real.result.firstClear, true)
  assert.equal(real.blob.levels.dawn.bestMs, 30000)
  // and a glitch can't beat a real best
  const glitch = R.recordRun(real.blob, run({ ms: 1200 }))
  assert.equal(glitch.blob.levels.dawn.bestMs, 30000)
  // the Trial best is guarded too
  const tr = R.recordRun(R.emptyRecords(), run({ ms: 800, mode: 'trial' }))
  assert.equal(tr.blob.levels.dawn.trial?.bestMs, undefined)
})

test('already-saved impossible bests are dropped on load, real ones and the clear count stay', () => {
  const info = (id: string) => (id === 'dawn' ? { size: 5, difficulty: 'easy' } : undefined)
  const raw = {
    v: 1,
    levels: {
      dawn: { bestMs: 1000, bestScore: 900, clears: 7, stars: 3, plays: 9, splits: [1, 2, 3, 4, 5], trial: { bestMs: 500, clears: 2 } },
      'rmx-0-6': { bestMs: 2000, bestScore: 800, clears: 3, stars: 2, plays: 3 },
      'rmx-0-7': { bestMs: 40000, bestScore: 800, clears: 3, stars: 2, plays: 3 },
    },
    daily: { streak: 0, bestStreak: 0, days: {} },
  }
  const out = R.migrateRecords(raw, [], info)
  assert.equal(out.levels.dawn.bestMs, undefined)
  assert.equal(out.levels.dawn.splits, undefined)
  assert.equal(out.levels.dawn.clears, 7)
  assert.equal(out.levels.dawn.stars, 3)
  assert.equal(out.levels.dawn.trial?.bestMs, undefined)
  assert.equal(out.levels['rmx-0-6'].bestMs, undefined, 'a Remix id carries its size')
  assert.equal(out.levels['rmx-0-7'].bestMs, 40000)
  // legacy clears with an impossible time are not seeded
  const legacy = R.migrateRecords(null, [{ puzzleId: 'dawn', bestMs: 700, bestScore: 5, clears: 1 }], info)
  assert.equal(legacy.levels.dawn, undefined)
})

test('a best set with help gives way to a clean run, even a slower one', () => {
  let b = R.recordRun(R.emptyRecords(), run({ ms: 20000, assisted: true })).blob
  assert.equal(b.levels.dawn.assisted, true)
  const helpedAgain = R.recordRun(b, run({ ms: 15000, assisted: true }))
  assert.equal(helpedAgain.result.newBestTime, true, 'helped run may beat a helped best')
  b = helpedAgain.blob
  const clean = R.recordRun(b, run({ ms: 25000 }))
  assert.equal(clean.result.newBestTime, true, 'first clean clear replaces the helped best')
  assert.equal(clean.blob.levels.dawn.bestMs, 25000)
  assert.equal(clean.blob.levels.dawn.assisted, undefined)
  // a helped run can't beat a clean best
  const helped = R.recordRun(clean.blob, run({ ms: 10000, assisted: true }))
  assert.equal(helped.result.newBestTime, false)
  assert.equal(helped.blob.levels.dawn.bestMs, 25000)
})

test('reset best time: forgets the time and ghost, keeps stars and top score', () => {
  const b = R.recordRun(R.emptyRecords(), run({ ms: 30000 })).blob
  const r = R.resetBestTime(b, 'dawn')
  assert.equal(r.levels.dawn.bestMs, undefined)
  assert.equal(r.levels.dawn.splits, undefined)
  assert.equal(r.levels.dawn.stars, b.levels.dawn.stars)
  assert.equal(r.levels.dawn.bestScore, 1200)
  assert.equal(R.recordRun(r, run({ ms: 45000 })).result.firstClear, true)
  assert.equal(R.resetBestTime(b, 'nope'), b)
})

test('star targets sit well above the floor and below a slow solve', () => {
  for (const size of [5, 6, 7, 8]) {
    const t = R.targetsFor({ size })
    assert.ok(t.timeMs >= R.timeFloorMs(size) * 8, `${size}: target ${t.timeMs} vs floor ${R.timeFloorMs(size)}`)
    assert.ok(t.timeMs <= 200_000)
  }
})

test('the game clock counts real time, not one fixed step per tick (source check)', async () => {
  const { readFileSync } = await import('node:fs')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal(/setElapsedMs\(\(e\) => e \+ 250\)/.test(app), false)
  assert.match(app, /performance\.now\(\)/)
  assert.match(app, /Math\.min\(1000,/)
})

// ---------- challenge links ----------
const DAY = 86_400_000
const day0 = new Date('2026-09-29T15:00:00Z')

test('challenge link always rebuilds the sender\'s exact Remix board, 10 days later', () => {
  const set0 = RX.remixSetNow(day0)
  const board = RX.buildRemixBoard(set0, 6)!
  assert.ok(board)
  const c = CH.createChallenge({ puzzleId: board.id, puzzleName: board.name, difficulty: 'Medium', fromEmail: 'a@b.c', fromName: 'Tony', scoreMs: 41000, scorePts: 1500, buddy: null })
  const link = CH.encodeChallengeLink(c, board)
  const hash = link.slice(link.indexOf('#'))
  assert.ok(hash.includes('challenge='))
  // the friend's phone: empty storage, never opened Remix
  mem.clear()
  assert.equal(PZ.getPuzzle(board.id), undefined, 'friend has no such board yet')
  // ten days later the live set has moved on
  const later = new Date(day0.getTime() + 10 * DAY)
  assert.ok(RX.remixSetNow(later) > set0, 'the set rotated')
  const parsed = CH.parseChallengeFromHash(hash)!
  assert.equal(parsed.puzzleId, board.id)
  assert.equal(parsed.scoreMs, 41000, 'their time travels with the link')
  const opened = PZ.getPuzzle(parsed.puzzleId)!
  assert.deepEqual(opened.regions, board.regions)
  assert.deepEqual(opened.solution, board.solution)
  assert.equal(opened.size, board.size)
  assert.equal(opened.id, board.id, 'same id, so times compare on the same board')
  // rebuilding "the current set" would be a different board
  const nowBoard = RX.buildRemixBoard(RX.remixSetNow(later), 6)!
  assert.notDeepEqual(nowBoard.regions, board.regions)
  // an expired set is labelled as a past Remix board; a live one is not
  assert.equal(CH.boardKindNote(board.id, later), 'Past Remix board')
  assert.equal(CH.boardKindNote(board.id, day0), 'Remix board')
  assert.equal(CH.boardKindNote('dawn'), '')
})

test('Endless boards travel inside the link too, and a busy Endless session cannot push them out', () => {
  mem.clear()
  const p = RX.buildEndlessBoard('easy', 12345)!
  const c = CH.createChallenge({ puzzleId: p.id, puzzleName: p.name, difficulty: 'Easy', fromEmail: 'a@b.c', fromName: 'Tony', scoreMs: 30000, scorePts: 1000 })
  const hash = CH.encodeChallengeLink(c, p).split('#')[1]
  mem.clear()
  CH.parseChallengeFromHash(`#${hash}`)
  for (let i = 0; i < 120; i++) ST.rememberGeneratedPuzzle({ ...p, id: `gen-fill-${i}` })
  const opened = PZ.getPuzzle(p.id)!
  assert.deepEqual(opened.regions, p.regions)
  assert.deepEqual(opened.solution, p.solution)
  assert.equal(CH.boardKindNote(p.id), 'Endless / random board')
})

test('a link cannot smuggle in a broken board', () => {
  mem.clear()
  const p = RX.buildRemixBoard(RX.remixSetNow(day0), 5)!
  const packed = CH.packBoardLayout(p)
  assert.ok(CH.registerSharedBoard('rmx-x-ok', 'ok', packed))
  // swap two solution cells so buddies touch or repeat a region
  const bin = atob(packed.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((packed.length + 3) % 4))
  const arr = bin.split('').map((c) => c.charCodeAt(0))
  const at = 3 + 25
  arr[at] = arr[at + 1]
  const bad = btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  assert.equal(CH.registerSharedBoard('rmx-x-bad', 'bad', bad), null)
})

test('duel links keep the board as well', () => {
  mem.clear()
  const p = RX.buildRemixBoard(RX.remixSetNow(day0), 7)!
  const d = CH.createDuelResult({ code: 'ABC123', puzzleId: p.id, puzzleName: p.name, difficulty: 'Hard', aName: 'A', aMs: 50000, aPts: 1500, bName: 'B', bMs: 47000, bPts: 1600 })
  const hash = CH.encodeDuelLink(d, p).split('#')[1]
  mem.clear()
  const back = CH.parseDuelFromHash(`#${hash}`)!
  assert.equal(back.puzzleId, p.id)
  assert.deepEqual(PZ.getPuzzle(p.id)!.regions, p.regions)
})

test('Endless only from the Remix screen; the Levels list has Random, and Home Play never makes endless boards (source check)', async () => {
  const { readFileSync } = await import('node:fs')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /data-random-level=\{diff\}/)
  assert.equal(/data-endless-level/.test(app), false, 'no Endless button on the Levels list')
  assert.equal(/startPuzzle\(uncleared \?\? createFreshPuzzle/.test(app), false)
  assert.match(app, /'Next Endless board'/)
})
