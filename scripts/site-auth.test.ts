import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  accountPlayerName,
  ageChoiceForPath,
  authBase,
  guestSaveLabel,
  isSyntheticEmail,
  leaderboardName,
  nameAuthError,
  signInBody,
  signUpBody,
  visibleEmail,
} from '../src/cloud/siteAuth.ts'
import { cursorFxPaused, registerCursorFx, setCursorFxPaused } from '../src/game/cursorFx.ts'

test('auth calls default to the website and stay configurable', () => {
  assert.equal(authBase(), 'https://romansgame.com')
  const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
  assert.match(cloud, /adoptSiteSession/)
  assert.match(cloud, /setSession/)
  assert.match(cloud, /signInWithOtp/)
  assert.match(cloud, /verifyOtp/)
})

test('signup age follows who the account is for', () => {
  assert.equal(ageChoiceForPath('me'), '13_plus')
  assert.equal(ageChoiceForPath('child'), 'under_13')
  assert.equal(ageChoiceForPath('kid'), 'under_13')
  const body = signUpBody({
    name: 'Cool Kid',
    password: 'lantern-river-stone',
    path: 'kid',
    email: 'parent@example.com',
    news: true,
    stay: true,
    captchaToken: 'tok',
  })
  assert.equal(body.age_choice, 'under_13')
  assert.equal(body.email, 'parent@example.com')
  assert.equal(body.terms_accepted, true)
  assert.equal(body.marketing_opt_in, true)
  assert.equal(body.captchaToken, 'tok')
  assert.equal('age_confirmed' in body, false)
  const adult = signUpBody({
    name: 'Bright Fox',
    password: 'lantern-river-stone',
    path: 'me',
    email: '',
    news: false,
    stay: false,
    captchaToken: 'tok',
  })
  assert.equal(adult.age_choice, '13_plus')
  assert.equal(adult.age_confirmed, true)
  assert.equal('email' in adult, false)
  const signIn = signInBody('parent@example.com', 'secret-phrase', true)
  assert.equal(signIn.name, 'parent@example.com')
  assert.equal(signIn.stay_signed_in, true)
})

test('player name comes from the account, not an email or a first-word cut', () => {
  assert.equal(accountPlayerName({ player_name: 'Cool Kid', display_name: 'Cool', name: 'sam@players.romansgame.invalid' }), 'Cool Kid')
  assert.equal(accountPlayerName({ display_name: 'sam@players.romansgame.invalid', name: 'Bright Fox' }), 'Bright Fox')
  assert.equal(leaderboardName('Cool Kid', 'Cool'), 'Cool Kid')
  assert.equal(leaderboardName('Cool Kid', 'Cool Kid'), 'Cool Kid')
  assert.equal(isSyntheticEmail('cool-kid@players.romansgame.invalid'), true)
  assert.equal(isSyntheticEmail('parent@example.com'), false)
  assert.equal(visibleEmail('cool-kid@players.romansgame.invalid'), '')
  assert.equal(visibleEmail('parent@example.com'), 'parent@example.com')
})

test('guest save label and website error sentences', () => {
  assert.equal(guestSaveLabel(27), 'Create an account to save your scores (27 waiting)')
  assert.equal(guestSaveLabel(0), 'Create an account to save your scores')
  assert.equal(nameAuthError(401, { error: 'invalid_credentials' }, false), "That player name and password didn't match. Try again.")
  assert.equal(nameAuthError(409, { error: 'name_taken' }, true), 'That player name is taken. Pick another one.')
  assert.equal(nameAuthError(422, { error: 'name_rejected' }, true), "That name can't be used. Pick another one.")
  assert.equal(nameAuthError(422, { error: 'weak_password', hint: 'Use 10 or more characters.' }, true), 'Use 10 or more characters.')
  assert.equal(nameAuthError(429, { error: 'rate_limited' }, false), 'Too many tries. Wait a minute and try again.')
  assert.equal(nameAuthError(403, { error: 'turnstile_required' }, true), 'The service wants the person-check finished. Tick the box, then try again.')
  assert.match(nameAuthError(503, { error: 'unavailable' }, false), /sign-in code option/)
  assert.match(nameAuthError(500, null, true), /Couldn't make the account/)
})

test('the sign-in sheet pauses a cursor effect and restores it when closed', () => {
  assert.equal(cursorFxPaused(), false)
  let state = 'running'
  const stop = registerCursorFx({
    pause: () => { state = 'paused' },
    resume: () => { state = 'running' },
  })
  setCursorFxPaused(true)
  assert.equal(state, 'paused')
  assert.equal(cursorFxPaused(), true)
  setCursorFxPaused(false)
  assert.equal(state, 'running')
  stop()
  setCursorFxPaused(true)
  assert.equal(state, 'running')
  setCursorFxPaused(false)
})
