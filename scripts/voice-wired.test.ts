import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)
const g = await import('../src/game/unseenGuide.ts')
const lines = await import('../src/game/voiceLines.ts')
const pets = await import('../src/game/pets.ts')

test('guide tags play their own recordings', () => {
  assert.equal(g.guideVoiceClip('hungry-lupa'), 'old_guide_hungry_lupa')
  assert.equal(g.guideVoiceClip('meh-nox'), 'old_guide_meh_nox')
  assert.equal(g.guideVoiceClip('drowsy-lupa'), 'old_guide_drowsy')
  assert.equal(g.guideVoiceClip('nox-expiring'), 'old_guide_nox')
  assert.equal(g.guideVoiceClip('afford-leo'), 'old_guide_afford')
  assert.equal(g.guideVoiceClip('badge-rankup'), 'old_guide_badge')
  assert.equal(g.guideVoiceClip('coins-aquila'), 'old_guide_coins_aquila')
  assert.equal(g.guideVoiceClip('streak-4'), 'old_guide_streak')
  assert.equal(g.guideVoiceClip('card-1'), 'old_guide_card_01')
  assert.equal(g.guideVoiceClip('card-10'), 'old_guide_card_10')
  assert.equal(g.guideVoiceClip('card-90'), null)
  for (const id of ['old_guide_card_01', 'old_tease_passed', 'buddy_win_level_2', 'buddy_win_level_30', 'buddy_tap_play', 'narrator_rotate', 'narrator_signin_sheet']) {
    assert.equal(lines.isPlayableVoiceClip(id), true, id)
  }
  assert.equal(lines.isPlayableVoiceClip('buddy_giggle_1'), false)
})

test('buddy levels stop at 30, and the coin and card sentences match the recordings', () => {
  assert.equal(pets.MAX_PET_LEVEL, 30)
  const wallet = {
    coins: 2000,
    freeHints: 0,
    shields: 0,
    spins: 0,
    achievements: [],
    badgeRanks: {},
    totalWins: 0,
    perfectWins: 0,
    totalMistakes: 0,
    critterStash: 0,
    bonusHearts: 0,
  }
  const base = {
    now: Date.parse('2026-06-01T16:00:00Z'),
    today: '2026-06-01',
    pets: { owned: {}, active: null, treats: { snack: 0, feast: 0 }, coupons: [] },
    wallet,
    pieces: 0,
    piecesTotal: 50,
    streak: 0,
  }
  const coins = g.guideCandidates(base).find((c) => c.tag === 'coins-lupa')
  assert.equal(coins?.text, "Just a few more coins and Lupa is yours. That's... what, a week of mediocre play?")
  const card = g.guideCandidates({ ...base, pieces: 49, wallet: { ...wallet, coins: 0 } }).find((c) => c.tag === 'card-1')
  assert.equal(card?.text, "You're 1 piece from my card. One. Even you can't mess this up.")
  assert.equal(g.guideVoiceClip(card!.tag), 'old_guide_card_01')
})
