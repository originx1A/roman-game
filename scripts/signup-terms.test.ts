import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/** Tony Nov 12, 2026, ~10:46: sign-in lives on the hub and the main website
 * ONLY, never in the game. These two guarantees moved with the sheet: the
 * create screen's Terms/Privacy requirement and the email-code door now
 * live on the hub sheet (hub/hub.html), not in the game. */
const hub = readFileSync(new URL('../hub/hub.html', import.meta.url), 'utf8')
const game = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')

test('sign-up sheet requires Terms and Privacy, and leaves the news box unchecked', () => {
  // The hub create screen: 13+ and Terms/Privacy are both tick-boxes, and
  // create refuses to submit until both are ticked.
  assert.match(hub, /I am 13 or older\./)
  assert.match(hub, /I agree to the/)
  assert.match(hub, /href="https:\/\/romansgame\.com\/terms"/)
  assert.match(hub, /href="https:\/\/romansgame\.com\/privacy"/)
  assert.match(hub, /if \(\!\$\('hub-create-age'\)\.checked \|\| \!\$\('hub-create-terms'\)\.checked\)/)
  assert.match(hub, /You need to be 13 or older and accept the terms to create an account\./)
  // The news opt-in is a plain unchecked box — never pre-ticked, and create
  // needs an email before it will subscribe anyone.
  const create = hub.slice(hub.indexOf('data-screen="create"'), hub.indexOf('data-screen="emailcode"'))
  assert.match(create, /hub-create-news/)
  assert.match(create, /Get Roman&rsquo;s World News/)
  assert.doesNotMatch(create, /hub-create-news" type="checkbox" checked/, 'the news box starts unchecked')
  assert.match(hub, /if \(optIn && !email\)/, 'the opt-in needs an email to subscribe')
  // The game carries none of this any more.
  assert.doesNotMatch(game, /I agree to the/)
  assert.doesNotMatch(game, /13 or older/)
})

test('sign-in sheet keeps the email code and accepts a 6 to 8 digit code', () => {
  // The hub email-code door: a code is emailed, then typed in (numeric
  // keyboard, up to 8 digits) and verified as a 6-to-8-digit code.
  assert.match(hub, /Sign in with an email code instead/)
  assert.match(hub, /We&rsquo;ll email you a code\./)
  assert.match(hub, /We sent a code\./)
  assert.match(hub, /Code from the email/)
  assert.match(hub, /inputmode="numeric"/)
  assert.match(hub, /maxlength="8"/)
  assert.match(hub, /client\.auth\.signInWithOtp\(/)
  assert.match(hub, /\/\^\\d\{6,8\}\$\//, 'the code is 6 to 8 digits')
  assert.match(hub, /client\.auth\.verifyOtp\(\{ email: codeEmail, token: token, type: 'email' \}\)/)
  // The copy never promises a fixed digit count — the code can be 6 to 8.
  assert.doesNotMatch(hub, /6-digit/)
  // The game carries none of this any more.
  assert.doesNotMatch(game, /verifyEmailCode|signInWithOtp|email code/)
})
