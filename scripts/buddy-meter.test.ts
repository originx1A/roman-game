import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const win = readFileSync(new URL('../src/components/WinScreen.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')
const packs = readFileSync(new URL('../netlify/lib/coinPacks.ts', import.meta.url), 'utf8')

test('buddy meter sits on the board and inside the win sheet', () => {
  const side = app.slice(app.indexOf('className="play-side"'), app.indexOf('className="build-tag"'))
  assert.match(side, /BuddyMeterStrip/)
  assert.match(side, /variant="play"/)
  assert.doesNotMatch(side, /play-dock-buddy/)
  const sheet = win.slice(win.indexOf('win-sheet-main'), win.indexOf('win-more-toggle'))
  assert.match(sheet, /BuddyMeterStrip/)
  assert.match(sheet, /variant="win"/)
  const more = win.slice(win.indexOf('id="win-more"'), win.indexOf('win-sheet-main'))
  assert.doesNotMatch(more, /BuddyMeterStrip/)
  assert.match(css, /buddy-meter-inline/)
  assert.match(css, /html\[data-layout='wide'\] \.play-side > \.buddy-meter-inline/)
})

test('approved shop prices stay in test checkout', () => {
  assert.match(packs, /CHECKOUT_TEST_ONLY = true/)
  assert.doesNotMatch(app, /Proposed until approved/)
})
