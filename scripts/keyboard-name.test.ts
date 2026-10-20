import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { placeSheet, visibleViewportBox, wantsKeyboardNameSheet } from '../src/components/keyboardViewport.ts'

test('visible viewport uses the visual viewport, including a keyboard pan', () => {
  const box = visibleViewportBox({ offsetTop: 40, offsetLeft: 0, width: 375, height: 340 }, { width: 375, height: 667 })
  assert.deepEqual(box, { top: 40, left: 0, width: 375, height: 340 })
  assert.ok(box.top + box.height < 667, 'the box ends above the keyboard')
})

test('visible viewport falls back to the layout viewport when the API is missing or empty', () => {
  assert.deepEqual(visibleViewportBox(null, { width: 390, height: 800 }), { top: 0, left: 0, width: 390, height: 800 })
  assert.deepEqual(visibleViewportBox({ offsetTop: 10, offsetLeft: 0, width: 0, height: 0 }, { width: 390, height: 800 }), {
    top: 0,
    left: 0,
    width: 390,
    height: 800,
  })
})

test('placeSheet keeps the offset when fixed elements use the layout viewport', () => {
  const proposed = { top: 80, left: 0, width: 375, height: 300 }
  // getBoundingClientRect is relative to the visual viewport, so a correct layout-fixed sheet sits at 0.
  assert.deepEqual(placeSheet(proposed, { top: 0, left: 0 }), proposed)
})

test('placeSheet drops the offset when fixed elements are already visual-viewport relative', () => {
  const proposed = { top: 80, left: 12, width: 375, height: 300 }
  assert.deepEqual(placeSheet(proposed, { top: 80, left: 12 }), { top: 0, left: 0, width: 375, height: 300 })
})

test('keyboard name sheet is for touch phones, not a desktop pointer', () => {
  assert.equal(wantsKeyboardNameSheet({ coarse: true, fine: false, maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone)' }), true)
  assert.equal(wantsKeyboardNameSheet({ coarse: false, fine: true, maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Macintosh)' }), false)
  assert.equal(wantsKeyboardNameSheet({ coarse: false, fine: true, maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true)
  assert.equal(wantsKeyboardNameSheet({ coarse: false, fine: false, maxTouchPoints: 1, userAgent: 'Mozilla/5.0' }), true)
})

test('every player name field uses the keyboard sheet on touch', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const cloud = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
  const sheet = readFileSync(new URL('../src/components/KeyboardNameSheet.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/components/KeyboardNameSheet.css', import.meta.url), 'utf8')
  assert.match(app, /function NamePromptSheet/)
  assert.match(app, /<NameEntry[\s\S]*testId="display-name"/)
  assert.match(app, /<NameEntry[\s\S]*testId="player-name"/)
  assert.match(app, /cleanPlayerName\(v\)/)
  assert.match(cloud, /nameInKeyboard &&/)
  assert.match(cloud, /savePlayerName\(name/)
  assert.match(sheet, /visualViewport|readVisibleViewport/)
  assert.match(sheet, /focus\(\{ preventScroll: true \}\)/)
  assert.match(css, /font-size: 16px/)
  assert.match(css, /justify-content: flex-end/)
})

test('queueOwner is initialized before the module-load readQueue() call', () => {
  const src = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
  const owner = src.indexOf('let queueOwner')
  const call = src.indexOf('pending: readQueue()')
  assert.ok(owner !== -1 && call !== -1 && owner < call)
})
