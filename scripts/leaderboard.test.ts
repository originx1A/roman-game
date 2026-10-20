import assert from 'node:assert/strict'
import test from 'node:test'
import { rankScores, sliceBoard, torontoDateKey, torontoWeekStart, type PublicScore } from '../src/game/leaderboard.ts'
import { LEADERBOARD_TEASE, leaderboardTease } from '../src/game/leaderboardTease.ts'
import { cloudModeForWin } from '../src/game/scoreMode.ts'

const NOW = new Date('2026-10-20T16:00:00.000Z') // Tuesday 12:00 in Toronto (EDT)

function row(partial: Partial<PublicScore> & Pick<PublicScore, 'name' | 'score'>): PublicScore {
  return {
    time_seconds: 60,
    mode: 'normal',
    created_at: '2026-10-20T15:00:00.000Z',
    ...partial,
  }
}

test('toronto week starts Monday', () => {
  assert.equal(torontoDateKey(NOW), '2026-10-20')
  assert.equal(torontoWeekStart(NOW), '2026-10-19')
})

test('Today is daily scores from today, and a faster tie wins', () => {
  const rows = [
    row({ name: 'Slow', score: 100, time_seconds: 50, mode: 'daily' }),
    row({ name: 'Fast', score: 100, time_seconds: 40, mode: 'daily' }),
    row({ name: 'Higher', score: 140, time_seconds: 90, mode: 'daily' }),
    row({ name: 'Yesterday', score: 999, time_seconds: 10, mode: 'daily', created_at: '2026-10-19T15:00:00.000Z' }),
    row({ name: 'Classic', score: 500, time_seconds: 10, mode: 'normal' }),
    row({ name: 'Practice', score: 800, time_seconds: 10, mode: 'practice' }),
    row({ name: 'Late upload', score: 200, time_seconds: 30, mode: 'daily', created_at: '2026-10-21T15:00:00.000Z', daily_date: '2026-10-20' }),
  ]
  const ranked = rankScores(rows, 'today', NOW)
  assert.deepEqual(ranked.map((r) => r.name), ['Late upload', 'Higher', 'Fast', 'Slow'])
  assert.equal(ranked[2].rank, 3)
  assert.equal(ranked[3].rank, 4)
})

test('identical score and time share a rank', () => {
  const ranked = rankScores(
    [
      row({ name: 'Ann', score: 10, time_seconds: 12, mode: 'daily' }),
      row({ name: 'Bea', score: 10, time_seconds: 12, mode: 'daily' }),
    ],
    'today',
    NOW,
  )
  assert.equal(ranked[0].rank, 1)
  assert.equal(ranked[1].rank, 1)
})

test('this week keeps the best run and drops last week', () => {
  const rows = [
    row({ name: 'Sam', score: 40, time_seconds: 80, created_at: '2026-10-19T16:00:00.000Z' }),
    row({ name: 'Sam', score: 90, time_seconds: 70, created_at: '2026-10-20T15:00:00.000Z', mode: 'remix' }),
    row({ name: 'Sam', score: 90, time_seconds: 20, created_at: '2026-10-18T15:00:00.000Z' }),
    row({ name: 'Old', score: 500, created_at: '2026-10-18T15:00:00.000Z' }),
  ]
  const ranked = rankScores(rows, 'week', NOW)
  assert.deepEqual(
    ranked.map((r) => [r.name, r.score, r.timeSeconds]),
    [['Sam', 90, 70]],
  )
})

test('a player outside the top 10 is shown with two neighbors', () => {
  const rows = Array.from({ length: 16 }, (_, i) => row({ name: `P${i}`, score: 1000 - i, time_seconds: 30, mode: 'daily' }))
  rows.push(row({ name: 'Roman', score: 1000 - 14, time_seconds: 10, mode: 'daily' }))
  const ranked = rankScores(rows, 'today', NOW)
  const you = ranked.find((r) => r.name === 'Roman')
  assert.ok(you)
  assert.equal(you.rank, 15)
  const slice = sliceBoard(ranked, 'roman')
  const names = slice.lines.flatMap((line) => ('gap' in line ? ['…'] : [line.name]))
  assert.deepEqual(names.slice(0, 10), Array.from({ length: 10 }, (_, i) => `P${i}`))
  assert.ok(names.includes('…'))
  const around = names.slice(names.indexOf('…') + 1)
  assert.deepEqual(around, ['P12', 'P13', 'Roman', 'P14', 'P15'])
  assert.equal(slice.you?.rank, 15)
})

test('a player already in the top 10 is not repeated', () => {
  const rows = [row({ name: 'Roman', score: 50, mode: 'daily' }), row({ name: 'Sam', score: 40, mode: 'daily' })]
  const ranked = rankScores(rows, 'today', NOW)
  const slice = sliceBoard(ranked, 'Roman')
  assert.equal(slice.lines.filter((line) => !('gap' in line) && line.name === 'Roman').length, 1)
  assert.equal(slice.you?.rank, 1)
})

function crowd(n: number, start = 5000): PublicScore[] {
  return Array.from({ length: n }, (_, i) => row({ name: `Player ${i + 1}`, score: start - i, time_seconds: 30, mode: 'daily' }))
}

test('a low rank gets the scroll line once, not every win', () => {
  const rows = [...crowd(14), row({ name: 'Roman', score: 200, time_seconds: 30, mode: 'normal' })]
  const first = leaderboardTease({
    you: 'Roman',
    score: 100,
    timeSeconds: 40,
    mode: 'normal',
    rows,
    previousRank: 15,
    lastSituation: null,
    now: NOW,
  })
  assert.equal(first.rank, 15)
  assert.equal(first.text, LEADERBOARD_TEASE.low)
  const again = leaderboardTease({
    you: 'Roman',
    score: 90,
    timeSeconds: 40,
    mode: 'normal',
    rows,
    previousRank: first.rank,
    lastSituation: first.situation,
    now: NOW,
  })
  assert.equal(again.text, null)
  assert.equal(again.situation, 'low')
})

test('a new best below the top ten, a top-ten best, and being passed', () => {
  const below = leaderboardTease({
    you: 'Roman',
    score: 120,
    timeSeconds: 20,
    mode: 'remix',
    rows: [...crowd(14), row({ name: 'Roman', score: 80, time_seconds: 50, mode: 'normal' })],
    previousRank: 15,
    lastSituation: 'low',
    now: NOW,
  })
  assert.equal(below.text, LEADERBOARD_TEASE.best)

  const climbed = leaderboardTease({
    you: 'Roman',
    score: 9000,
    timeSeconds: 20,
    mode: 'normal',
    rows: crowd(12, 2000),
    previousRank: 13,
    lastSituation: 'low',
    now: NOW,
  })
  assert.equal(climbed.rank != null && climbed.rank <= 10, true)
  assert.equal(climbed.text, LEADERBOARD_TEASE.top)

  const passed = leaderboardTease({
    you: 'Roman',
    score: 50,
    timeSeconds: 40,
    mode: 'normal',
    rows: [...crowd(8, 2000), row({ name: 'Roman', score: 100, time_seconds: 30, mode: 'normal' })],
    previousRank: 4,
    lastSituation: 'top',
    now: NOW,
  })
  assert.equal(passed.text, LEADERBOARD_TEASE.passed)
})

test('remix is saved as remix, and practice is not saved', () => {
  assert.equal(cloudModeForWin({ practice: false, daily: false, endless: false, trial: false, remix: true }), 'remix')
  assert.equal(cloudModeForWin({ practice: true, daily: true, endless: false, trial: false, remix: false }), null)
  assert.equal(cloudModeForWin({ practice: false, daily: true, endless: false, trial: false, remix: false }), 'daily')
  assert.equal(cloudModeForWin({ practice: false, daily: false, endless: true, trial: false, remix: true }), 'endless')
})
