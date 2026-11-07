import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const ui = rd('../src/cloud/CloudScores.tsx')
const cloud = rd('../src/cloud/cloud.ts')
const tag = rd('../src/buildTag.ts')

/** Slice one sheet's JSX block: from its `sheet === '<name>'` marker to the next sheet marker (or the portal close). */
function block(name: string): string {
  const marks = [...ui.matchAll(/sheet === '(\w+)'/g)]
  const i = marks.findIndex((m) => m[1] === name)
  assert.ok(i >= 0, `sheet '${name}' exists`)
  const from = marks[i].index!
  const to = i + 1 < marks.length ? marks[i + 1].index! : ui.indexOf('document.body', from)
  return ui.slice(from, to)
}

test('9.32-j-dev: sign-in opens on a chooser — Sign in / Create account, no form fields', () => {
  // Tony 2026-11-07: the box opens on two options only; each pick swaps in its own screen.
  assert.match(ui, /type Sheet = null \| 'start' \| 'signin' \| 'create'/)
  // Signed-out visitors land on the chooser, not on a form.
  assert.match(ui, /: 'start'\)/)
  const start = block('start')
  assert.match(start, />\s*Sign in\s*</)
  assert.match(start, />\s*Create account\s*</)
  assert.doesNotMatch(start, /<input/, 'chooser carries no form fields')
  assert.doesNotMatch(start, /consentChecks/, 'chooser carries no checkboxes')
})

test('9.32-j-dev: the 13+ / Terms / newsletter questions live on the create screen only', () => {
  const signin = block('signin')
  assert.doesNotMatch(signin, /consentChecks/, 'sign-in screen asks no consent questions')
  assert.doesNotMatch(signin, /age13/, 'the age question never appears on sign-in')
  assert.doesNotMatch(signin, /type="checkbox"/)
  const create = block('create')
  assert.match(create, /consentChecks/, 'create screen carries the questions')
  assert.match(ui, /I'm 13 or older/, 'the age verification is still asked (on create)')
})

test('9.32-j-dev: one shared email field — switching doors never wipes typed values', () => {
  assert.equal((ui.match(/value=\{email\}/g) ?? []).length, 1, 'exactly one input is bound to the email state')
  assert.match(ui, /New here\? Create account instead/)
  assert.match(ui, /Already have an account\? Sign in instead/)
})

test('9.32-j-dev: both doors send through the same existing calls — no auth changes', () => {
  // Sign-in and create are the same passwordless email-code flow as before:
  // sendMagicLink (signInWithOtp, shouldCreateUser) then verifyEmailCode.
  assert.match(ui, /await sendCode\('signin'\)/)
  assert.match(ui, /await sendCode\('create'\)/)
  assert.match(ui, /await sendMagicLink\(email\)/)
  assert.match(ui, /await verifyEmailCode\(email, code\)/)
  assert.match(cloud, /signInWithOtp/)
  assert.match(cloud, /shouldCreateUser: true/)
  // No password was invented for the game, and no payload/validation strings moved.
  assert.doesNotMatch(ui, /type="password"/)
  assert.match(ui, /if \(!age13\) return setSheet\('parent'\)/)
  assert.match(ui, /Please agree to the Terms and Privacy\./)
  assert.match(ui, /Type a full email address\./)
})

test('9.32-j-dev: close is reachable on every sheet, including the account sheet', () => {
  for (const name of ['start', 'signin', 'create', 'sent']) assert.match(block(name), /Not now/, `${name} sheet can be closed`)
  assert.match(block('account'), />\s*Close\s*</, 'account sheet has a Close button')
  assert.match(ui, /start-sheet-scrim" onClick=\{\(\) => setSheet\(null\)\}/, 'the scrim closes the box')
})

test('9.32-j-dev: build tag bumped so a phone can tell the preview from live 9.32-i', () => {
  assert.match(tag, /build 9\.32-j-dev/)
})
