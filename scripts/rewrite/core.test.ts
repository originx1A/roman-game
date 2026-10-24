import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conflicts, emptyBoard, isSolved, regionConnected, type Cell } from '../../src/game/logic.ts'
import { dailyPuzzle, makePuzzle, torontoDate } from '../../src/game/generate.ts'
import { THRONES, throneAt, throneForWins, throneProgress } from '../../src/game/thrones.ts'
import { formatTeamName, parseTeamName } from '../../src/game/teamNames.ts'
import { formatPrice, priceForCountry } from '../../src/game/catalog.ts'
import { en, fr } from '../../src/i18n.ts'

test('boards are solvable and regions stay connected', () => {
  for (const size of [5, 6, 7, 8]) {
    for (const difficulty of [0, 1, 2] as const) {
      const puzzle = makePuzzle(size, difficulty, `t-${size}-${difficulty}`)
      assert.equal(puzzle.solution.length, size)
      assert.equal(regionConnected(size, puzzle.regions), true)
      const cells = emptyBoard(size)
      for (const index of puzzle.solution) cells[index] = 'buddy'
      assert.equal(isSolved(puzzle, cells), true)
      assert.equal(conflicts(puzzle, cells).size, 0)
    }
  }
})

test('the daily board is the same for one Toronto day', () => {
  const a = dailyPuzzle(new Date('2026-10-24T16:00:00Z'))
  const b = dailyPuzzle(new Date('2026-10-24T20:00:00Z'))
  assert.equal(torontoDate(new Date('2026-10-24T16:00:00Z')), '2026-10-24')
  assert.deepEqual(a.solution, b.solution)
})

test('touching buddies are a conflict', () => {
  const puzzle = makePuzzle(5, 0, 'touch')
  const cells: Cell[] = emptyBoard(5)
  cells[0] = 'buddy'
  cells[1] = 'buddy'
  assert.ok(conflicts(puzzle, cells).size >= 2)
})

test('thrones count total wins and the ladder does not stop', () => {
  assert.equal(throneForWins(0), null)
  assert.equal(throneForWins(1)?.id, 1)
  assert.equal(throneForWins(3)?.id, 2)
  const far = throneAt(40)
  assert.ok(far.wins > THRONES[THRONES.length - 1].wins)
  assert.ok(throneAt(41).wins > far.wins)
  const progress = throneProgress(1)
  assert.equal(progress.held?.id, 1)
  assert.ok(progress.next.wins > 1)
})

test('team names only come from the lists', () => {
  assert.equal(formatTeamName({ adjective: 'Golden', noun: 'Owls', number: 12 }), 'Golden Owls #12')
  assert.equal(parseTeamName('Free Text #4'), null)
  assert.ok(parseTeamName('Calm Foxes #8'))
})

test('prices are per country and the small pack matches the starter', () => {
  const ca = priceForCountry('CA')
  const us = priceForCountry('US')
  assert.equal(formatPrice(ca.starterCents, ca.symbol), 'CA$2.99')
  assert.equal(formatPrice(us.starterCents, us.symbol), 'US$1.99')
  assert.equal(ca.smallCents, 299)
  assert.equal(us.smallCents, 199)
  assert.equal(formatPrice(priceForCountry('FR').starterCents, 'CA$'), 'CA$2.99')
})

test('French has every English string and neither language uses the banned words', () => {
  const banned = /\b(kid|kids|parent|parents|grown-up|grown-ups)\b/i
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(typeof fr[key], typeof en[key])
    const value = JSON.stringify(en[key]) + JSON.stringify(fr[key])
    assert.equal(banned.test(value), false, key)
  }
})
