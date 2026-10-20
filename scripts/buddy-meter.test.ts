import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const win = readFileSync(new URL('../src/components/WinScreen.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const packs = readFileSync(new URL('../netlify/lib/coinPacks.ts', import.meta.url), 'utf8')

test('buddy meter is a stat inside the victory card', () => {
  const side = app.slice(app.indexOf('className="play-side"'), app.indexOf('className="build-tag"'))
  assert.doesNotMatch(side, /BuddyMeterStrip/)
  assert.doesNotMatch(side, /buddy-meter/)
  const sheet = win.slice(win.indexOf('className="win-stats"'), win.indexOf('win-sheet-actions'))
  assert.match(sheet, /win-stat-meter/)
  assert.match(sheet, /BuddyMeterStrip/)
  const more = win.slice(win.indexOf('id="win-more"'), win.indexOf('win-sheet-main'))
  assert.doesNotMatch(more, /BuddyMeterStrip/)
  assert.doesNotMatch(css, /buddy-meter-inline/)
  assert.match(css, /\.win-stat-meter \.buddy-meter[\s\S]*background:\s*transparent/)
})

test('approved shop prices stay in test checkout', () => {
  assert.match(packs, /CHECKOUT_TEST_ONLY = true/)
  assert.doesNotMatch(app, /Proposed until approved/)
})
