import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_SAVED_STEPS,
  amendMove,
  createHistory,
  pushMove,
  redoMove,
  restoreHistory,
  stepsToSave,
  undoMove,
} from '../src/game/history.ts'
import type { CellState } from '../src/game/types.ts'

function board(...cells: CellState[]): CellState[] {
  return cells
}

test('undo removes a single X placement', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
  assert.equal(history.past.length, 0)
  assert.equal(history.future.length, 1)
})

test('undo reverses each X in a swipe, latest first', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'mark'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
})

test('undo restores a cleared X, then earlier buddy and X moves', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = pushMove(history, board('mark', 'stone'))
  history = pushMove(history, board('empty', 'stone'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'stone'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
})

test('X marks and buddy placements share one history, in order', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'mark', 'empty'))
  history = pushMove(history, board('stone', 'mark', 'mark'))
  history = pushMove(history, board('stone', 'stone', 'mark'))

  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'mark', 'mark'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'mark', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
})

test('redo puts an undone X back', () => {
  let history = createHistory(board('empty'))
  history = pushMove(history, board('mark'))
  history = undoMove(history)
  history = redoMove(history)
  assert.deepEqual(history.present, ['mark'])
  assert.equal(history.past.length, 1)
  assert.equal(history.future.length, 0)
})

test('a new move after undo drops the redo of that X', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = undoMove(history)
  history = pushMove(history, board('empty', 'mark'))
  assert.equal(history.future.length, 0)
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty'])
})

test('repeating the same board does not add an undo step', () => {
  let history = createHistory(board('empty'))
  const marked = board('mark')
  history = pushMove(history, marked)
  marked[0] = 'stone'
  history = pushMove(history, history.present)
  assert.equal(history.past.length, 1)
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty'])
})

test('saved steps bring Undo and Redo back after Resume', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'empty', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'empty'))
  history = pushMove(history, board('mark', 'mark', 'mark'))
  history = undoMove(history)

  // What the draft stores, round-tripped through JSON like localStorage
  const saved = JSON.parse(JSON.stringify({ cells: history.present, ...stepsToSave(history) }))
  let resumed = restoreHistory(saved.cells, saved.past, saved.future)
  assert.deepEqual(resumed.present, ['mark', 'mark', 'empty'])
  assert.equal(resumed.past.length, 2)

  resumed = undoMove(resumed)
  assert.deepEqual(resumed.present, ['mark', 'empty', 'empty'])
  resumed = undoMove(resumed)
  assert.deepEqual(resumed.present, ['empty', 'empty', 'empty'])
  resumed = redoMove(redoMove(redoMove(resumed)))
  assert.deepEqual(resumed.present, ['mark', 'mark', 'mark'])
})

test('an undone X stays undone in the saved board', () => {
  let history = createHistory(board('empty', 'empty'))
  history = pushMove(history, board('mark', 'empty'))
  history = pushMove(history, board('mark', 'mark'))
  history = undoMove(history)
  const saved = JSON.parse(JSON.stringify({ cells: history.present, ...stepsToSave(history) }))
  assert.deepEqual(saved.cells, ['mark', 'empty'])
  assert.deepEqual(restoreHistory(saved.cells, saved.past, saved.future).future, [['mark', 'mark']])
})

test('old drafts without steps resume with an empty history', () => {
  const resumed = restoreHistory(board('mark', 'empty'))
  assert.deepEqual(resumed.present, ['mark', 'empty'])
  assert.equal(resumed.past.length, 0)
  assert.equal(resumed.future.length, 0)
})

test('malformed saved steps are dropped', () => {
  const resumed = restoreHistory(
    board('mark', 'empty'),
    [['empty', 'empty'], ['empty'], ['nope', 'empty'], 'x', null],
    { not: 'a list' },
  )
  assert.deepEqual(resumed.past, [['empty', 'empty']])
  assert.deepEqual(resumed.future, [])
})

test('saved steps are capped', () => {
  let history = createHistory(board('empty'))
  for (let i = 0; i < MAX_SAVED_STEPS + 50; i++) {
    history = pushMove(history, board(i % 2 ? 'empty' : 'mark'))
  }
  const saved = stepsToSave(history)
  assert.equal(saved.past.length, MAX_SAVED_STEPS)
  assert.deepEqual(saved.past[saved.past.length - 1], history.past[history.past.length - 1])
})

test('a whole swipe of X marks folds into one undo step', () => {
  let history = createHistory(board('empty', 'empty', 'empty', 'stone'))
  history = pushMove(history, board('mark', 'empty', 'empty', 'stone'))
  history = amendMove(history, board('mark', 'mark', 'empty', 'stone'))
  history = amendMove(history, board('mark', 'mark', 'mark', 'stone'))
  assert.equal(history.past.length, 1)
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty', 'stone'])
  history = redoMove(history)
  assert.deepEqual(history.present, ['mark', 'mark', 'mark', 'stone'])
})

test('a swipe-erase is one undo step and undo brings every X back', () => {
  let history = createHistory(board('mark', 'mark', 'stone', 'mark'))
  history = pushMove(history, board('empty', 'mark', 'stone', 'mark'))
  history = amendMove(history, board('empty', 'empty', 'stone', 'mark'))
  history = amendMove(history, board('empty', 'empty', 'stone', 'empty'))
  assert.equal(history.past.length, 1)
  history = undoMove(history)
  assert.deepEqual(history.present, ['mark', 'mark', 'stone', 'mark'])
})

test('amending keeps earlier steps and drops redo', () => {
  let history = createHistory(board('empty', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'empty', 'empty'))
  history = pushMove(history, board('stone', 'mark', 'empty'))
  history = undoMove(history)
  history = pushMove(history, board('stone', 'empty', 'mark'))
  history = amendMove(history, board('stone', 'mark', 'mark'))
  assert.equal(history.future.length, 0)
  history = undoMove(history)
  assert.deepEqual(history.present, ['stone', 'empty', 'empty'])
  history = undoMove(history)
  assert.deepEqual(history.present, ['empty', 'empty', 'empty'])
})

test('a stroke that ends where it began leaves no step, and a no-op amend changes nothing', () => {
  let history = createHistory(board('mark', 'empty'))
  history = pushMove(history, board('empty', 'empty'))
  history = amendMove(history, board('mark', 'empty'))
  assert.equal(history.past.length, 0)
  const same = amendMove(history, history.present)
  assert.equal(same, history)
})
