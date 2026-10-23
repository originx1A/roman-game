import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)

const logic = await import('../src/game/logic.ts')
const mistakes = await import('../src/game/mistakes.ts')
const remix = await import('../src/game/remix.ts')
const puzzles = await import('../src/game/puzzles.ts')
const comments = await import('../src/game/comments.ts')

const { findConflicts } = logic
const { applyBuddyPlacement, STARTING_HEARTS } = mistakes
const { buildEndlessBoard, buildRemixBoard, parseRemixId } = remix
const { getPuzzle } = puzzles
const { banterFor, OLDTIMER_WRONG_CLIPS } = comments

function emptyRun(size: number, shields = 0) {
  return {
    cells: Array.from({ length: size * size }, () => 'empty' as const),
    lives: STARTING_HEARTS,
    shields,
    over: false,
    taunts: [] as Array<'place-bad' | 'lose'>,
  }
}

/** One legal buddy, then three that break the row / touch rules. */
function threeWrongPlacements(puzzle: { id: string; size: number; solution: number[]; regions: number[] }, shields = 0) {
  let state = applyBuddyPlacement(puzzle as never, emptyRun(puzzle.size, shields), puzzle.solution[0])
  assert.equal(state.lives, STARTING_HEARTS, `${puzzle.id} legal open`)
  assert.equal(state.over, false)
  let placed = 0
  for (let i = 0; i < state.cells.length && placed < 3; i++) {
    if (state.cells[i] === 'stone') continue
    const trial = state.cells.slice()
    trial[i] = 'stone'
    const hit = findConflicts(puzzle as never, trial)
    if (!hit.cells.has(i)) continue
    if (placed === 0) {
      const kind = hit.kinds.get(i)
      assert.ok(kind === 'row' || kind === 'col' || kind === 'region' || kind === 'touch', kind)
    }
    state = applyBuddyPlacement(puzzle as never, state, i)
    placed++
    if (state.over) break
  }
  assert.equal(placed, 3, `${puzzle.id} found three illegal cells`)
  return state
}

test('3 wrong placements end the board in Daily, Remix, and Endless', () => {
  const dailyBase = getPuzzle('dawn')
  assert.ok(dailyBase)
  const daily = { ...dailyBase, id: 'daily-2026-10-22', name: 'Daily · Oct 22' }
  const remixBoard = buildRemixBoard(9, 5)
  assert.ok(remixBoard)
  assert.deepEqual(parseRemixId(remixBoard.id), { set: 9, size: 5 })
  const endless = buildEndlessBoard('easy', 1)
  assert.ok(endless)
  assert.match(endless.id, /^gen-/)

  for (const puzzle of [daily, remixBoard, endless]) {
    const done = threeWrongPlacements(puzzle)
    assert.equal(done.lives, 0, puzzle.id)
    assert.equal(done.over, true, puzzle.id)
    assert.deepEqual(done.taunts, ['place-bad', 'place-bad', 'lose'], puzzle.id)
    const bad = findConflicts(puzzle, done.cells)
    assert.ok(bad.cells.size > 0, puzzle.id)
    assert.ok([...bad.kinds.values()].some((k) => k === 'row' || k === 'touch'), puzzle.id)
  }
})

test('a shield blocks the heart, and the wrong-move taunt still fires', () => {
  const remixBoard = buildRemixBoard(9, 5)
  assert.ok(remixBoard)
  let blocked = applyBuddyPlacement(remixBoard, emptyRun(remixBoard.size, 1), remixBoard.solution[0])
  for (let i = 0; i < blocked.cells.length; i++) {
    if (blocked.cells[i] === 'stone') continue
    const trial = blocked.cells.slice()
    trial[i] = 'stone'
    if (!findConflicts(remixBoard, trial).cells.has(i)) continue
    blocked = applyBuddyPlacement(remixBoard, blocked, i)
    break
  }
  assert.equal(blocked.lives, STARTING_HEARTS)
  assert.equal(blocked.shields, 0)
  assert.equal(blocked.over, false)
  assert.deepEqual(blocked.taunts, ['place-bad'])

  const random = Math.random
  Math.random = () => 0
  try {
    const line = banterFor('place-bad', 'touch')
    assert.equal(line.speak, true)
    assert.ok(line.clip)
    assert.ok(
      (OLDTIMER_WRONG_CLIPS as readonly string[]).includes(line.clip),
      line.clip,
    )
  } finally {
    Math.random = random
  }
})
