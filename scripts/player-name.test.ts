import assert from 'node:assert/strict'
import test from 'node:test'
import { getPlayerName, isUnsetAccountName } from '../src/game/playerName.ts'
import { clipAudible, DESKTOP_PHONE_JAB, desktopCaption } from '../src/game/lineCaption.ts'

test('getPlayerName prefers the account name, then settings, then the old profile', () => {
  assert.equal(
    getPlayerName({
      publicName: 'Official',
      name: 'Chosen',
      playerName: 'Sam',
      displayName: "Roman's Game Official",
    }),
    'Official',
  )
  assert.equal(
    getPlayerName({
      name: 'Chosen',
      playerName: 'Sam',
      displayName: "Roman's Game Official",
    }),
    'Chosen',
  )
  assert.equal(getPlayerName({ playerName: 'Sam', displayName: "Roman's Game Official" }), 'Sam')
  assert.equal(getPlayerName({ displayName: "Roman's Game Official" }), "Roman's Game Official")
  assert.equal(getPlayerName({ publicName: '', name: 'Chosen', playerName: 'Sam' }), 'Chosen')
  assert.equal(getPlayerName({}), '')
})

test('a default account name yields to the name the player already chose', () => {
  assert.equal(isUnsetAccountName("Roman's Game official"), true)
  assert.equal(isUnsetAccountName("Roman's Game Official"), true)
  assert.equal(isUnsetAccountName('Roman'), false)
  assert.equal(
    getPlayerName({ publicName: "Roman's Game official", name: "Roman's Game official", playerName: 'Roman' }),
    'Roman',
  )
  assert.equal(getPlayerName({ publicName: 'Sam', name: 'Sam', playerName: 'Roman' }), 'Sam')
})

test('phone jab keeps its recording on phones and a silent desktop caption on computers', () => {
  assert.equal(desktopCaption('old_jab_phone', false), undefined)
  assert.equal(desktopCaption('old_jab_phone', true), DESKTOP_PHONE_JAB)
  assert.equal(desktopCaption('old_jab_bingo', true), undefined)
  assert.equal(clipAudible('old_jab_phone', false), true)
  assert.equal(clipAudible('old_jab_phone', true), false)
  assert.equal(clipAudible('old_jab_bingo', true), true)
  assert.match(DESKTOP_PHONE_JAB, /Have you ever used a computer before/)
})
