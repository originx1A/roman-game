import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const ov = readFileSync(new URL('../src/components/ParadeOverlay.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/App.css', import.meta.url), 'utf8')

test('9.30-q: the parade does not depend on click: first-touch events + coordinate hit-test', () => {
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) assert.match(ov, new RegExp(`addEventListener\\('${ev}'`), ev)
  assert.match(ov, /HIT_MIN = 96/)
  assert.match(ov, /HIT_NEAR = 70/)
  assert.match(ov, /data-parade-i/)
  assert.match(ov, /caughtIdx\.current\.has/, 'each treasure once')
  assert.match(ov, /lastTap/, 'one touch = one catch')
})

test('9.30-q: Grab all fallback after 6 s, buttons act on touch release (TapButton), march pauses under the finger', () => {
  assert.match(ov, /6000/)
  assert.match(ov, /data-testid="parade-grab-all"/)
  assert.match(ov, /<TapButton[^>]*parade-continue/, 'the card is tap-to-close')
  assert.match(ov, /caughtIdx\.current\.has\(i\)\) return\s*\n\s*caughtIdx\.current\.add\(i\)\s*\n\s*let real: Treasure = t\s*\n\s*try \{\s*\n\s*real = onCatch\(t\)/, 'uncollected treasure is paid when the march ends')
  assert.match(ov, /<TapButton[^>]*parade-skip-btn/)
  assert.match(css, /\.parade\.is-holding[^{]*\{[^}]*animation-play-state: paused/)
})

test('9.30-q: CSS: touch-action manipulation, no tap highlight, children never swallow the touch, 96 px targets', () => {
  assert.match(css, /\.parade \{ touch-action: manipulation;/)
  assert.match(css, /-webkit-tap-highlight-color: transparent/)
  assert.match(css, /\.parade \.pet-art[^{]*\{ pointer-events: none/)
  assert.match(css, /\.parade-loot \{ min-width: 96px; min-height: 96px/)
})

test('9.30-q: a sound error can never stop a catch from showing', () => {
  assert.match(ov, /real = onCatch\(t\)\s*\n\s*\} catch/)
  assert.match(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), /try \{\s*\n\s*sfxCoin\(\)/)
})
