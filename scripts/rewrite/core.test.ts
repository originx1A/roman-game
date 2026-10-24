import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conflicts, emptyBoard, isSolved, puzzlePlayable, regionConnected, type Cell } from '../../src/game/logic.ts'
import { dailyPuzzle, makePuzzle, puzzleFromId, torontoDate } from '../../src/game/generate.ts'
import { THRONES, boardFromPuzzleId, boardSteps, throneAt, throneForBoards, throneForWins, throneIdForBoard, throneProgress, winsNeeded } from '../../src/game/thrones.ts'
import { formatTeamName, parseTeamName } from '../../src/game/teamNames.ts'
import { formatPrice, priceForCountry } from '../../src/game/catalog.ts'
import { EMAIL_HOLD_MS, emailHeldBy, emailHoldKey } from '../../netlify/lib/rewrite/emailHold.ts'
import { en, fr } from '../../src/i18n.ts'

test('boards are solvable and regions stay connected', () => {
  for (const size of [5, 6, 7, 8]) {
    for (const difficulty of [0, 1, 2, 3] as const) {
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

test('thrones count wins on the board they were won on', () => {
  assert.equal(winsNeeded(1), 10)
  assert.equal(winsNeeded(2), 20)
  assert.equal(winsNeeded(3), 30)
  assert.equal(winsNeeded(4), 40)
  assert.equal(winsNeeded(1, 1), 9)
  assert.equal(winsNeeded(2, 1), 19)
  assert.equal(winsNeeded(1, 2), 8)
  assert.equal(winsNeeded(2, 2), 18)
  assert.equal(boardSteps(5, 0), 0)
  assert.equal(boardSteps(5, 1), 1)
  assert.equal(boardSteps(6, 0), 1)
  assert.equal(boardSteps(6, 1), 2)
  assert.equal(boardSteps(8, 3), 6)
  assert.equal(throneForWins(0), null)
  assert.equal(throneForWins(9), null)
  assert.equal(throneForWins(10)?.id, 1)
  assert.equal(throneForWins(19)?.id, 1)
  assert.equal(throneForWins(20)?.id, 2)
  assert.equal(throneForWins(30)?.id, 3)
  assert.equal(throneIdForBoard(8, 1), 0)
  assert.equal(throneIdForBoard(9, 1), 1)
  assert.equal(throneIdForBoard(18, 1), 1)
  assert.equal(throneIdForBoard(19, 1), 2)
  assert.equal(throneIdForBoard(7, 2), 0)
  assert.equal(throneIdForBoard(8, 2), 1)
  assert.equal(throneIdForBoard(18, 2), 2)
  assert.equal(throneForBoards({ '5:0': 9, '5:1': 8 }), null)
  assert.equal(throneForBoards({ '5:0': 10, '6:1': 9 })?.id, 1)
  assert.equal(throneForBoards({ '5:0': 20, '6:0': 9 })?.id, 2)
  assert.equal(throneForBoards({ '6:1': 18 })?.id, 2)
  assert.equal(boardFromPuzzleId('6.1.daily-2026-10-24', 6).key, '6:1')
  assert.equal(boardSteps(6, 1), 2)
  assert.equal(throneAt(0).wins, 10)
  assert.equal(throneAt(1).wins, 20)
  assert.equal(throneAt(2).wins, 30)
  assert.equal(throneAt(3).wins, 40)
  const far = throneAt(40)
  assert.equal(far.wins, 410)
  assert.ok(far.wins > THRONES[THRONES.length - 1].wins)
  assert.equal(throneAt(41).wins, 420)
  const easy = throneProgress(10, 0)
  assert.equal(easy.held?.id, 1)
  assert.equal(easy.next.id, 2)
  assert.equal(easy.left, 10)
  const oneStep = throneProgress(9, 1)
  assert.equal(oneStep.held?.id, 1)
  assert.equal(oneStep.left, 10)
})

test('a win id rebuilds the same board and a broken board is rejected', () => {
  const puzzle = makePuzzle(6, 1, 'daily-2026-10-24')
  const again = puzzleFromId(puzzle.id)
  assert.ok(again)
  assert.deepEqual(again?.solution, puzzle.solution)
  assert.equal(puzzlePlayable(puzzle), true)
  assert.equal(puzzleFromId('9.0.nope'), null)
  assert.equal(puzzleFromId('6.1.'), null)
  assert.equal(puzzlePlayable({ size: 6, regions: [], solution: [] }), false)
  const cells = emptyBoard(puzzle.size)
  for (const index of puzzle.solution) cells[index] = 'buddy'
  assert.equal(isSolved(again!, cells), true)
  cells[puzzle.solution[0]] = 'empty'
  assert.equal(isSolved(again!, cells), false)
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

test('one account holds an email, and a pending hold expires', () => {
  const now = 1_700_000_000_000
  const base = {
    exceptId: 'me',
    authId: null,
    verifiedId: null,
    pendingId: null,
    pendingUntil: null,
    rateId: null,
    rateUntil: null,
    now,
  }
  assert.equal(emailHeldBy(base), null)
  assert.equal(emailHeldBy({ ...base, exceptId: null, authId: 'other' }), 'other')
  assert.equal(emailHeldBy({ ...base, authId: 'me' }), null)
  assert.equal(emailHeldBy({ ...base, verifiedId: 'other' }), 'other')
  assert.equal(emailHeldBy({ ...base, rateId: 'other', rateUntil: now + EMAIL_HOLD_MS }), 'other')
  assert.equal(emailHeldBy({ ...base, rateId: 'me', rateUntil: now + EMAIL_HOLD_MS }), null)
  assert.equal(emailHeldBy({ ...base, rateId: 'other', rateUntil: now }), null)
  assert.equal(emailHeldBy({ ...base, pendingId: 'other', pendingUntil: now + 1000 }), 'other')
  assert.equal(emailHeldBy({ ...base, pendingId: 'other', pendingUntil: now - 1 }), null)
  assert.equal(
    emailHeldBy({ ...base, pendingId: 'legacy', pendingUntil: now + 1000, rateId: 'holder', rateUntil: now + 1000 }),
    'holder',
  )
  assert.equal(emailHoldKey('  Person@Example.com '), 'rate:email-hold:person@example.com')
  assert.equal(en.emailUsed, 'That email is already used.')
  assert.equal(fr.emailUsed, 'Ce courriel est déjà utilisé.')
})

test('French has every English string and neither language uses the banned words', () => {
  const banned = /\b(kid|kids|parent|parents|grown-up|grown-ups)\b/i
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(typeof fr[key], typeof en[key])
    const value = JSON.stringify(en[key]) + JSON.stringify(fr[key])
    assert.equal(banned.test(value), false, key)
  }
})
