import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sheet = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, `missing ${start}`)
  return source.slice(from, to)
}

test('the save card asks with four choices and does not ask age', () => {
  const offer = sliceBetween(sheet, 'data-testid="save-offer"', 'data-testid="save-no-email"')
  assert.match(offer, /Save your scores\?/)
  assert.match(offer, /Save with email \(13\+\)/)
  assert.match(offer, /Save without email/)
  assert.match(offer, /Link to a parent's account/)
  assert.match(offer, />\s*Not now\s*</)
  assert.doesNotMatch(offer, /I'm 13 or older/)
  assert.doesNotMatch(offer, /type="checkbox"/)
})

test('email is the existing sheet, and the age gate points at save without email', () => {
  assert.match(sheet, /I'm 13 or older/)
  assert.match(sheet, /I agree to the/)
  assert.match(sheet, /if \(!age13\) return setSheet\('parent'\)/)
  const gate = sliceBetween(sheet, 'data-testid="save-age-gate"', "sheet === 'account'")
  assert.match(gate, /Save without email/)
  assert.match(gate, /setSheet\('noemail'\)/)
  assert.doesNotMatch(gate, /Keep playing/)
  assert.doesNotMatch(sheet, /signInAnonymously/)
  assert.doesNotMatch(sheet, /\/api\/auth\/signup/)
  assert.doesNotMatch(sheet, /\/api\/recovery-code/)
  assert.doesNotMatch(sheet, /\/api\/parent-link/)
  assert.doesNotMatch(cloud, /signInAnonymously/)
  assert.doesNotMatch(cloud, /signInWithPassword/)
})

test('a phone first win or new best asks later, and desktop sign-in stays on email', () => {
  assert.match(sheet, /phoneSaveCard\(\) \? 'offer' : 'email'/)
  assert.match(app, /replay\.firstClear \|\| replay\.newBestTime \|\| replay\.newBestScore/)
  assert.match(app, /device === 'phone' && cloudState\(\)\.status !== 'signed-in'/)
  assert.match(app, /forceOffer hidden/)
  assert.match(app, /}, 2400\)/)
})
