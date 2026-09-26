import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TAP_SLOP_PX, hasLeftTap } from '../src/game/gesture.ts'

const start = { x: 100, y: 100, index: 7 }

test('a finger wobbling inside the tapped cell is still a tap', () => {
  assert.equal(hasLeftTap(start, 101, 102, 7), false)
  assert.equal(hasLeftTap(start, 125, 90, 7), false)
})

test('reaching another cell makes it a swipe', () => {
  assert.equal(hasLeftTap(start, 103, 100, 8), true)
})

test('over a gap between cells, only a real drift counts as a swipe', () => {
  assert.equal(hasLeftTap(start, 102, 101, null), false)
  assert.equal(hasLeftTap(start, 100 + TAP_SLOP_PX + 1, 100, null), true)
})

test('a touch that started on a gap becomes a swipe when it reaches a cell', () => {
  assert.equal(hasLeftTap({ x: 0, y: 0, index: null }, 1, 1, 3), true)
})
