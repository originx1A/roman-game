import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  canTip, emptyTips, missedStarReason, NEW_TIP_LINES, OLD_SNARK_TIP_LINES, SNARK_TIPS, noteMastery, noteShown, playableTipLines, RECORDED_TIP_LINES,
  sanitizeTips, TIP_IDS, TIP_RULES, TIP_TRIGGERS, type TipGate,
} from '../src/game/voiceTips.ts'

const voiceSrc = readFileSync(new URL('../src/game/voiceLines.ts', import.meta.url), 'utf8')
const recordedIds = new Set([...voiceSrc.matchAll(/^\s+(\w+): '\/voices\//gm)].map((m) => m[1]))
const gate = (o: Partial<TipGate> = {}): TipGate => ({ now: 1_000_000, enabled: true, boardCount: 0, boardTips: [], lastTipAt: 0, ...o })

test('every tip has lines for all three voices; new ids are unique and not recorded yet', () => {
  const ids = new Set<string>()
  for (const id of TIP_IDS) {
    const voices = new Set(NEW_TIP_LINES[id].map((l) => l.voice))
    assert.deepEqual([...voices].sort(), ['coach', 'old', 'roman'], id)
    for (const l of NEW_TIP_LINES[id]) {
      assert.ok(l.id.startsWith('tip_'), l.id)
      assert.ok(!ids.has(l.id), `duplicate ${l.id}`)
      ids.add(l.id)
      assert.ok(!recordedIds.has(l.id), `${l.id} should not be recorded before approval`)
      assert.ok(l.text.length > 8 && l.text.length < 140, l.id)
    }
  }
})

test('existing lines wired to tips are real recorded clips', () => {
  for (const id of TIP_IDS) for (const l of RECORDED_TIP_LINES[id]) assert.ok(recordedIds.has(l.id), l.id)
})

test('only recorded lines play; reason filters three-star lines', () => {
  const has = (c: string) => recordedIds.has(c)
  const text = () => 'x'
  assert.equal(playableTipLines('first-trial', undefined, has, text).length, 0)
  const stuck = playableTipLines('stuck', undefined, has, text)
  assert.equal(stuck[0].id, 'roman_nudge')
  assert.ok(stuck.every((l) => l.voice === 'roman' || l.id.startsWith('old_')))
  const time = playableTipLines('three-star', 'time', has, text).map((l) => l.id)
  assert.ok(time.includes('old_win_yesterday') && time.includes('roman_warmup'))
  const undo = playableTipLines('three-star', 'undo', has, text).map((l) => l.id)
  assert.ok(!undo.includes('old_win_yesterday'))
  // once a new line is recorded it joins automatically
  const all = playableTipLines('first-daily', undefined, () => true, text)
  assert.equal(all.length, NEW_TIP_LINES['first-daily'].length)
})

test('caps: off switch, per board, same tip once per board, global gap, cooldown', () => {
  const s = emptyTips()
  assert.ok(canTip(s, 'stall', gate()))
  assert.ok(!canTip(s, 'stall', gate({ enabled: false })))
  assert.ok(!canTip(s, 'stall', gate({ boardCount: TIP_TRIGGERS.perBoard })))
  assert.ok(!canTip(s, 'stall', gate({ boardTips: ['stall'], boardCount: 1 })))
  assert.ok(!canTip(s, 'stall', gate({ lastTipAt: 1_000_000 - 1000 })))
  const shown = noteShown(s, 'stall', 1_000_000)
  assert.ok(!canTip(shown, 'stall', gate({ now: 1_000_000 + 60_000 })))
  assert.ok(canTip(shown, 'stall', gate({ now: 1_000_000 + TIP_RULES.stall.cooldownMs + 1 })))
})

test('a tip retires after the player shows they get it, or after max plays', () => {
  let s = emptyTips()
  for (let i = 0; i < TIP_RULES['three-star'].masteryNeeded; i++) s = noteMastery(s, 'three-star')
  assert.ok(s.retired.includes('three-star'))
  assert.ok(!canTip(s, 'three-star', gate()))
  let t = emptyTips()
  for (let i = 0; i < TIP_RULES['first-trial'].maxShows; i++) t = noteShown(t, 'first-trial', i)
  assert.ok(t.retired.includes('first-trial'))
  assert.equal(noteMastery(t, 'first-trial'), t)
})

test('saved tip state is sanitized', () => {
  const s = sanitizeTips({ shows: { stall: 2, bogus: 4, stuck: -1 }, retired: ['stall', 'nope'], lastAt: 'x' })
  assert.deepEqual(s.shows, { stall: 2 })
  assert.deepEqual(s.retired, ['stall'])
  assert.deepEqual(s.lastAt, {})
  assert.deepEqual(sanitizeTips(null), emptyTips())
})

test('missed-star reason: time first, then undos, then score', () => {
  assert.equal(missedStarReason({ withinTime: false, undos: 3, scoreOk: false }), 'time')
  assert.equal(missedStarReason({ withinTime: true, undos: 1, scoreOk: false }), 'undo')
  assert.equal(missedStarReason({ withinTime: true, undos: 0, scoreOk: false }), 'score')
})

test('9.29-a: recorded old-timer put-downs join the tips (snark pool on mid-play tips only)', () => {
  const has = (c: string) => recordedIds.has(c)
  const text = (c: string) => c
  for (const c of OLD_SNARK_TIP_LINES) assert.ok(recordedIds.has(c) && c.startsWith('old_'), c)
  for (const id of TIP_IDS) {
    const ids = playableTipLines(id, undefined, has, text).map((l) => l.id)
    assert.equal(new Set(ids).size, ids.length, `no duplicate lines in ${id}`)
    const snark = OLD_SNARK_TIP_LINES.filter((c) => ids.includes(c))
    if (SNARK_TIPS.includes(id)) assert.equal(snark.length, OLD_SNARK_TIP_LINES.length, id)
    else assert.equal(snark.length, 0, id)
  }
  const stall = playableTipLines('stall', undefined, has, text)
  assert.ok(stall.filter((l) => l.voice === 'old').length >= 15)
  assert.ok(playableTipLines('undo-spam', undefined, has, text).some((l) => l.id === 'old_undo_hokey'))
  // slow-win jabs only when time was the miss
  assert.ok(!playableTipLines('three-star', 'undo', has, text).some((l) => l.id === 'old_win_paint'))
  assert.ok(playableTipLines('three-star', 'time', has, text).some((l) => l.id === 'old_win_paint'))
})
