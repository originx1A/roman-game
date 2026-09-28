import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  comboMove, dailyIndex, emptyRecords, finishDaily, ghostProgress, ghostSplits, liveStreak, migrateRecords, newCombo,
  paceDelta, prevDateKey, recordRun, replayCoins, scoreRunV2, starsFor, startDaily, targetsFor, torontoDateKey, trialUnlocked,
  UNDO_COST, type Targets,
} from '../src/game/replay.ts'

const T5 = targetsFor({ size: 5, difficulty: 'easy' })

test('targets scale with board size and 3 stars needs more than finishing on time', () => {
  const t = [5, 6, 7, 8].map((size) => targetsFor({ size }))
  for (let i = 1; i < t.length; i++) {
    assert.ok(t[i].timeMs > t[i - 1].timeMs)
    assert.ok(t[i].score3 > t[i - 1].score3)
  }
  // Finishing exactly on time, perfect, with no combo points is not enough for 3 stars
  const onTime = scoreRunV2({ size: 5, targetMs: T5.timeMs, elapsedMs: T5.timeMs, hintsUsed: 0, perfect: true, comboPoints: 0 })
  assert.equal(starsFor({ ms: T5.timeMs, score: onTime, undos: 0 }, T5), 2)
  // A quick run with a good combo gets there
  const quick = scoreRunV2({ size: 5, targetMs: T5.timeMs, elapsedMs: 20000, hintsUsed: 0, perfect: true, comboPoints: 360 })
  assert.equal(starsFor({ ms: 20000, score: quick, undos: 0 }, T5), 3)
  // ...but not with an undo, and not over time
  assert.equal(starsFor({ ms: 20000, score: quick, undos: 1 }, T5), 2)
  assert.equal(starsFor({ ms: T5.timeMs + 1, score: 99999, undos: 0 }, T5), 1)
})

test('combo builds on quick good moves, drops when idle, resets on a bad move, undo costs points', () => {
  let c = newCombo()
  let t = 1000
  const tiers: boolean[] = []
  for (let i = 0; i < 6; i++) { const r = comboMove(c, 'x', i, (t += 500)); c = r.combo; tiers.push(r.tierUp) }
  assert.equal(c.streak, 6)
  assert.deepEqual(tiers, [false, false, true, false, false, true]) // x1.5 at 3, x2 at 6
  // same cell again earns nothing (no farming by painting/erasing)
  assert.equal(comboMove(c, 'x', 0, t + 100).gained, 0)
  // idle past the window: streak restarts
  const idle = comboMove(c, 'buddy', 10, t + 5000)
  assert.equal(idle.combo.streak, 1)
  assert.equal(idle.gained, 40)
  // bad move resets
  assert.equal(comboMove(c, 'bad', 11, t + 100).combo.streak, 0)
  // undo costs points
  const u = comboMove(c, 'undo', -1, t + 100)
  assert.equal(u.combo.points, c.points - UNDO_COST)
  assert.equal(u.combo.streak, 0)
})

test('ghost pace: ahead is negative, behind is positive, even pace for old records', () => {
  const ghost = ghostSplits(50000, 5)
  assert.deepEqual(ghost, [10000, 20000, 30000, 40000, 50000])
  assert.equal(paceDelta([], ghost, 0, 5000), 0) // nobody has a buddy yet
  assert.equal(paceDelta([], ghost, 0, 12000), 2000)
  assert.equal(paceDelta([7000, 15000], ghost, 2, 16000), -5000) // 2 down at 15s, ghost had them at 20s
  assert.equal(paceDelta([12000], ghost, 1, 26000), 6000) // ghost got its 2nd at 20s
  assert.equal(ghostProgress(ghost, 25000), 0.5)
  assert.deepEqual(ghostSplits(50000, 5, [1, 2, 3, 4, 5]), [1, 2, 3, 4, 5])
})

test('records: first clear, new best, near miss, stars only go up, trial is separate', () => {
  let b = emptyRecords()
  const run = (ms: number, score: number, undos = 0, mode: 'normal' | 'trial' = 'normal', t: Targets = T5) => {
    const r = recordRun(b, { puzzleId: 'dawn', mode, ms, score, undos, splits: [1, 2, 3, 4, ms], targets: t })
    b = r.blob
    return r.result
  }
  let r = run(60000, 1200)
  assert.ok(r.firstClear && !r.newBestTime)
  assert.equal(r.starsAfter, 1)
  r = run(30000, 1500, 2)
  assert.ok(r.newBestTime && r.newBestScore)
  assert.equal(r.starsAfter, 2)
  assert.equal(b.levels.dawn.bestMs, 30000)
  r = run(31500, 1400)
  assert.ok(!r.newBestTime)
  assert.equal(r.nearMissMs, 1500)
  assert.equal(b.levels.dawn.bestScore, 1500) // top score kept
  assert.equal(r.starsAfter, 2)
  assert.ok(!trialUnlocked(b, 'dawn'))
  r = run(20000, T5.score3 + 10, 0)
  assert.equal(r.starsAfter, 3)
  assert.ok(r.trialUnlockedNow && trialUnlocked(b, 'dawn'))
  // a slower run never takes a star away
  assert.equal(run(90000, 500).starsAfter, 3)
  // trial best is its own
  r = run(40000, 3000, 0, 'trial')
  assert.ok(r.firstClear)
  assert.equal(b.levels.dawn.trial?.bestMs, 40000)
  assert.equal(b.levels.dawn.bestMs, 20000)
  const coins = replayCoins(r, 'trial')
  assert.ok(coins.coins >= 50)
})

test('coins for new stars and new bests', () => {
  const r = { firstClear: false, newBestTime: true, newBestScore: false, starsBefore: 1, starsAfter: 3, runStars: 3, trialUnlockedNow: true }
  const c = replayCoins(r, 'normal')
  assert.equal(c.coins, 20 + 40 + 20)
})

test('migration: older clears seed bests; broken data is safe', () => {
  const info = (id: string) => (id === 'dawn' ? { size: 5 } : undefined)
  const m = migrateRecords(null, [{ puzzleId: 'dawn', bestMs: 30000, bestScore: 1400, clears: 3 }, { puzzleId: 'gen-x', bestMs: 1, bestScore: 1, clears: 1 }], info)
  assert.equal(m.levels.dawn.bestMs, 30000)
  assert.equal(m.levels.dawn.stars, 2)
  assert.equal(m.levels['gen-x'], undefined)
  for (const junk of ['nope', 42, { v: 2 }, { v: 1, levels: { a: null, b: { bestMs: 'x', stars: 9 } }, daily: 5 }]) {
    const out = migrateRecords(junk, [], info)
    assert.equal(out.v, 1)
    if (out.levels.b) assert.equal(out.levels.b.stars, 3)
  }
  // saved blob wins over the legacy list
  const saved = migrateRecords({ v: 1, levels: { dawn: { bestMs: 9000, stars: 3, clears: 5, plays: 7 } }, daily: { streak: 2, bestStreak: 4, days: {} } }, [{ puzzleId: 'dawn', bestMs: 30000, bestScore: 1, clears: 1 }], info)
  assert.equal(saved.levels.dawn.bestMs, 9000)
  assert.equal(saved.daily.bestStreak, 4)
})

test('daily: Toronto date, same board all day, first attempt only, streak', () => {
  // 03:30 UTC on Sep 29 is still Sep 28 in Toronto
  assert.equal(torontoDateKey(new Date('2026-09-29T03:30:00Z')), '2026-09-28')
  assert.equal(torontoDateKey(new Date('2026-09-29T04:30:00Z')), '2026-09-29')
  assert.equal(prevDateKey('2026-03-01'), '2026-02-28')
  const seen = new Set<number>()
  for (let d = 1; d <= 28; d++) seen.add(dailyIndex(`2026-02-${String(d).padStart(2, '0')}`, 20))
  assert.ok(seen.size > 8) // varies day to day
  assert.equal(dailyIndex('2026-09-28', 20), dailyIndex('2026-09-28', 20))
  let d = emptyRecords().daily
  let s = startDaily(d, '2026-09-27', 'dawn'); d = s.daily
  assert.ok(s.firstAttempt)
  assert.ok(!startDaily(d, '2026-09-27', 'dawn').firstAttempt)
  let f = finishDaily(d, '2026-09-27', true, { score: 1500, ms: 30000 }); d = f.daily
  assert.ok(f.counted); assert.equal(f.streak, 1)
  assert.ok(!finishDaily(d, '2026-09-27', true).counted) // replays don't count
  d = startDaily(d, '2026-09-28', 'harbor').daily
  f = finishDaily(d, '2026-09-28', true, { score: 1, ms: 1 }); d = f.daily
  assert.equal(f.streak, 2)
  assert.equal(liveStreak(d, '2026-09-29'), 2)
  assert.equal(liveStreak(d, '2026-09-30'), 0) // missed a day
  d = startDaily(d, '2026-09-30', 'moss').daily
  assert.equal(finishDaily(d, '2026-09-30', true).streak, 1)
})

test('share text uses the player name or "I scored", never "Roman\'s score"', async () => {
  const { scoreShareText } = await import('../src/game/replay.ts')
  const a = scoreShareText({ name: 'Tony', score: 12400, levelLabel: 'Level 7 (Summit)', stars: 3, timeMs: 42000, newBest: true })
  assert.equal(a, "Tony scored 12,400 on Level 7 (Summit) — 3 stars ⭐⭐⭐ — New best! — beat my time (0:42) in Roman's Game")
  const b = scoreShareText({ score: 1840, levelLabel: 'Level 1 (Dawn)' })
  assert.ok(b.startsWith('I scored 1,840 on Level 1 (Dawn)'))
  assert.ok(!/Roman's score/.test(a + b))
})

test('records and share text carry an optional buddy (null = solo for now)', async () => {
  const { scoreShareText, buddyShareText } = await import('../src/game/replay.ts')
  let b = emptyRecords()
  b = recordRun(b, { puzzleId: 'dawn', mode: 'normal', ms: 30000, score: 1500, undos: 0, splits: [1, 2, 3, 4, 5], targets: T5, buddy: null }).blob
  assert.equal(b.levels.dawn.buddy, null)
  b = recordRun(b, { puzzleId: 'dawn', mode: 'trial', ms: 30000, score: 1500, undos: 0, splits: [1, 2, 3, 4, 5], targets: T5 }).blob
  assert.equal(b.levels.dawn.trial?.buddy, null)
  const d = finishDaily(startDaily(b.daily, '2026-09-28', 'dawn').daily, '2026-09-28', true, { score: 1, ms: 1, buddy: null }).daily
  assert.equal(d.days['2026-09-28'].buddy, null)
  assert.equal(buddyShareText(null), '')
  assert.ok(scoreShareText({ name: 'Tony', score: 10, levelLabel: 'Level 1 (Dawn)', buddy: 'Pip' }).startsWith('Tony scored 10 on Level 1 (Dawn) — with Pip — '))
  assert.ok(!scoreShareText({ score: 10, levelLabel: 'L', buddy: null }).includes('with'))
  // old saves without the field load as solo
  assert.equal(migrateRecords({ v: 1, levels: { dawn: { bestMs: 1, stars: 1, clears: 1 } }, daily: { streak: 0, bestStreak: 0, days: {} } }, [], () => ({ size: 5 })).levels.dawn.buddy, null)
})
