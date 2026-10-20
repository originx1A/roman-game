import assert from 'node:assert/strict'
import test from 'node:test'
import { getPlayerName, isUnsetAccountName } from '../src/game/playerName.ts'
import { clipAudible, DESKTOP_PHONE_JAB, desktopCaption, HANDHELD_MAX_WIDTH_PX, isComputerDevice } from '../src/game/lineCaption.ts'
import { COMPUTER_SIGNIN_LINE, reminderText } from '../src/game/unseenReminders.ts'

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

test('phone lines stay on phones and tablets, and computers get the computer line', () => {
  const wide = HANDHELD_MAX_WIDTH_PX + 40
  assert.equal(isComputerDevice(null), false)
  assert.equal(isComputerDevice({ coarse: true, fine: false, width: 390 }), false)
  assert.equal(isComputerDevice({ coarse: true, fine: false, width: 1024 }), false, 'a wide tablet keeps the phone line')
  assert.equal(isComputerDevice({ coarse: false, fine: true, width: 700 }), false, 'a narrow window keeps the phone line')
  assert.equal(isComputerDevice({ coarse: false, fine: true, width: wide }), true)
  assert.equal(isComputerDevice({ coarse: true, fine: true, width: wide }), false, 'a coarse pointer wins over a fine one')
  assert.equal(isComputerDevice({ coarse: false, fine: false, width: wide }), false, 'unknown pointer defaults to the phone line')
  assert.equal(reminderText('signin', false), "You keep winning and then leaving it on this phone. Sign in, and the scores come with you. No password. I'm not carrying them.")
  assert.equal(reminderText('signin', true), COMPUTER_SIGNIN_LINE)
  assert.match(COMPUTER_SIGNIN_LINE, /this computer/)
  assert.equal(reminderText('pets', true).includes('computer'), false)
})
