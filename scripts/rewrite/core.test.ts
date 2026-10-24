import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { conflicts, emptyBoard, isSolved, puzzlePlayable, regionConnected, type Cell } from '../../src/game/logic.ts'
import { dailyPuzzle, makePuzzle, puzzleFromId, torontoDate } from '../../src/game/generate.ts'
import { THRONES, boardFromPuzzleId, boardSteps, throneAt, throneForBoards, throneForWins, throneIdForBoard, throneProgress, winsNeeded } from '../../src/game/thrones.ts'
import { formatTeamName, parseTeamName } from '../../src/game/teamNames.ts'
import { CHARGE_COST, CLOTHES, DEFENDER_PRICE, PACKS, STARTER_CLOTH, STARTER_COINS, STARTER_PET, applyCoinDelta, centsForSku, coinsForWin, creditCoins, creditStarter, formatCoins, formatPrice, isSku, leaderboardPrize, priceForCountry, sameSiteNext } from '../../src/game/catalog.ts'
import { pointsForWin } from '../../src/game/points.ts'
import { openStore } from '../../netlify/lib/rewrite/db.ts'
import { EMAIL_HOLD_MS, emailHeldBy, emailHoldKey } from '../../netlify/lib/rewrite/emailHold.ts'
import { en, fr } from '../../src/i18n.ts'

test('boards are solvable and regions stay connected', () => {
  for (const size of [5, 6, 7, 8]) {
    for (const difficulty of [0, 1, 2, 3] as const) {
      const puzzle = makePuzzle(size, difficulty, `t-${size}-${difficulty}`)
      assert.equal(puzzle.solution.length, size)
      assert.equal(regionConnected(size, puzzle.regions), true)
      const counts = Array<number>(size).fill(0)
      for (const region of puzzle.regions) counts[region]++
      const smallest = Math.min(...counts)
      const largest = Math.max(...counts)
      assert.ok(smallest >= 2, `region of ${smallest}`)
      assert.ok(largest - smallest <= difficulty * 2 + 2, counts.join(','))
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
  const small = PACKS.find((pack) => pack.sku === 'pack-small')
  const medium = PACKS.find((pack) => pack.sku === 'pack-medium')
  const large = PACKS.find((pack) => pack.sku === 'pack-large')
  assert.ok(small && medium && large)
  assert.equal(formatPrice(ca.starterCents, ca.symbol), 'CA$2.99')
  assert.equal(formatPrice(us.starterCents, us.symbol), 'US$1.99')
  assert.equal(ca.smallCents, 299)
  assert.equal(us.smallCents, 199)
  assert.equal(us.starterCents, 199)
  assert.equal(ca.mediumCents, 699)
  assert.equal(ca.largeCents, 1499)
  assert.equal(formatPrice(ca.mediumCents ?? 0, 'CA$'), 'CA$6.99')
  assert.equal(formatPrice(ca.largeCents ?? 0, 'CA$'), 'CA$14.99')
  assert.equal(us.mediumCents, null)
  assert.equal(us.largeCents, null)
  assert.equal(centsForSku('pack-medium', us), null)
  assert.equal(centsForSku('pack-large', us), null)
  assert.equal(centsForSku('pack-small', us), 199)
  assert.equal(centsForSku('pack-small', ca), 299)
  assert.equal(small.coins, 4000)
  assert.equal(medium.coins, 10000)
  assert.equal(large.coins, 23000)
  assert.equal(small.tag, null)
  assert.equal(medium.tag, 'bonus7')
  assert.equal(large.tag, 'bonus15')
  assert.equal(small.usdCents, 199)
  assert.equal(medium.usdCents, null)
  assert.equal(large.usdCents, null)
  assert.equal(creditCoins({ coins: 0 }, 'pack-medium').coins, 10000)
  assert.equal(creditCoins({ coins: 10000 }, 'pack-large').coins, 33000)
  assert.equal(creditCoins({ coins: 5 }, 'starter').coins, 5)
  assert.equal(formatCoins(4000, 'en'), '4,000')
  assert.equal(formatCoins(10000, 'en'), '10,000')
  assert.equal(formatCoins(23000, 'en'), '23,000')
  assert.match(formatCoins(10000, 'fr'), /^10[\s\u00a0\u202f]000$/)
  assert.match(formatCoins(23000, 'fr'), /^23[\s\u00a0\u202f]000$/)
  assert.equal(en.bonus7, '+7% BONUS')
  assert.equal(en.bonus15, '+15% BONUS')
  assert.equal(fr.bonus7, '+7 % BONUS')
  assert.equal(fr.bonus15, '+15 % BONUS')
  assert.equal(formatPrice(priceForCountry('FR').starterCents, 'CA$'), 'CA$2.99')
  assert.equal(formatPrice(299, 'CA$', 'fr'), '2,99\u00a0$')
  assert.equal(formatPrice(699, 'CA$', 'fr'), '6,99\u00a0$')
  assert.equal(formatPrice(1499, 'CA$', 'fr'), '14,99\u00a0$')
  assert.equal(formatPrice(199, 'US$', 'fr'), '1,99\u00a0$\u00a0US')
  assert.equal(formatPrice(299, 'CA$', 'fr'), new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(2.99))
  assert.equal(isSku('pack-medium'), true)
  assert.equal(isSku('pack-large'), true)
  assert.equal(isSku('pack-small'), true)
  assert.equal(isSku('starter'), true)
  assert.equal(isSku('pack-other'), false)
})

test('a win scores points from the board, a perfect clear, and the streak', () => {
  assert.equal(pointsForWin(5, 0, false, 1), 110)
  assert.equal(pointsForWin(6, 1, true, 7), 270)
  assert.equal(pointsForWin(8, 3, false, 0), 250)
  assert.equal(pointsForWin(5, 0, true, 9), 220)
})

test('approved coin prices and win payouts', () => {
  assert.equal(CHARGE_COST, 150)
  assert.deepEqual(DEFENDER_PRICE, { lupa: 6000, nox: 8000, aquila: 10000, leo: 12000, invictus: 15000 })
  assert.deepEqual(CLOTHES.map((piece) => [piece.id, piece.price, piece.earn]), [
    ['top-hat', 3000, null],
    ['sunglasses', 3000, null],
    ['scarf', 3000, null],
    ['badge', 4000, null],
    ['laurel', null, 'throne'],
    ['crown', null, 'streak'],
  ])
  assert.equal(coinsForWin({ winsTodayBefore: 0, dailyFirst: false, winsThisWeekBefore: 0, weekBonusAlready: false }).coins, 100)
  assert.equal(coinsForWin({ winsTodayBefore: 9, dailyFirst: false, winsThisWeekBefore: 0, weekBonusAlready: false }).coins, 100)
  assert.equal(coinsForWin({ winsTodayBefore: 10, dailyFirst: false, winsThisWeekBefore: 0, weekBonusAlready: false }).coins, 25)
  assert.equal(coinsForWin({ winsTodayBefore: 3, dailyFirst: true, winsThisWeekBefore: 1, weekBonusAlready: false }).coins, 250)
  const week = coinsForWin({ winsTodayBefore: 0, dailyFirst: false, winsThisWeekBefore: 19, weekBonusAlready: false })
  assert.equal(week.coins, 600)
  assert.equal(week.weekBonus, true)
  assert.equal(coinsForWin({ winsTodayBefore: 0, dailyFirst: false, winsThisWeekBefore: 20, weekBonusAlready: true }).coins, 100)
  assert.equal(leaderboardPrize(1), 300)
  assert.equal(leaderboardPrize(10), 300)
  assert.equal(leaderboardPrize(11), 100)
  assert.equal(leaderboardPrize(100), 100)
  assert.equal(leaderboardPrize(101), 0)
  assert.equal(applyCoinDelta(150, -150), 0)
  assert.equal(applyCoinDelta(149, -150), null)
  assert.equal(sameSiteNext('/shop'), '/shop')
  assert.equal(sameSiteNext('/shop?tab=clothing'), '/shop?tab=clothing')
  assert.equal(sameSiteNext('https://evil.example/shop'), null)
  assert.equal(sameSiteNext('//evil.example/shop'), null)
  assert.equal(sameSiteNext('/shop/../admin'), null)
})

test('the starter pack credits 8000 coins, the owl, and the top hat once', async () => {
  const granted = creditStarter({ coins: 0, pets: [], clothes: [], starterOwned: false, hostPet: null })
  assert.equal(granted.coins, STARTER_COINS)
  assert.equal(STARTER_COINS, 8000)
  assert.deepEqual(granted.pets, [STARTER_PET])
  assert.deepEqual(granted.clothes, [STARTER_CLOTH])
  assert.equal(granted.starterOwned, true)
  assert.equal(granted.hostPet, null)
  const again = creditStarter(granted)
  assert.deepEqual(again.pets, [STARTER_PET])
  assert.deepEqual(again.clothes, [STARTER_CLOTH])
  assert.equal(formatCoins(STARTER_COINS, 'en'), '8,000')
  assert.match(formatCoins(STARTER_COINS, 'fr'), /^8[\s\u00a0\u202f]000$/)
  assert.equal(`${formatCoins(STARTER_COINS, 'en')} ${en.coins} · ${en.bonusIcons}`, '8,000 coins · Coins, pet, clothing')
  assert.equal(en.placeholderCoins, 'Coming soon')
  assert.equal(fr.placeholderCoins, 'Bientôt')
  assert.equal(en.placeholderCoins.includes('▢') || fr.placeholderCoins.includes('▢'), false)
  const store = openStore({})
  assert.equal(await store.claimOrderGrant('order-once'), true)
  assert.equal(await store.claimOrderGrant('order-once'), false)
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

test('checkout uses hosted Stripe, pack art, and a calm cancel', () => {
  const source = readFileSync(new URL('../../netlify/lib/rewrite/server.ts', import.meta.url), 'utf8')
  const start = source.indexOf('async function checkout(')
  const end = source.indexOf('function checkoutName')
  const fn = source.slice(start, end)
  assert.equal(fn.includes('payment_method_types'), false)
  assert.match(fn, /cancel_url: `\$\{origin\}\/shop\/review\?cancelled=1&order=\$\{order\.id\}`/)
  assert.match(fn, /images: \[packImageUrl\(origin, order\.sku\)\]/)
  assert.match(fn, /Coins for Roman's Game\. No cash value\./)
  assert.match(source, /return 'Starter Pack: 8,000 coins \+ Nox \+ For Lupa'/)
  assert.match(source, /\$\{size\} coin pack \(\$\{formatCoins\(pack\.coins, 'en'\)\} coins\)/)
  assert.equal(en.noCharge, 'No charge made.')
  assert.equal(fr.noCharge, 'Aucun frais.')
})

test('French has every English string and neither language uses the banned words', () => {
  const banned = /\b(kid|kids|parent|parents|grown-up|grown-ups)\b/i
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(typeof fr[key], typeof en[key])
    const value = JSON.stringify(en[key]) + JSON.stringify(fr[key])
    assert.equal(banned.test(value), false, key)
  }
})
