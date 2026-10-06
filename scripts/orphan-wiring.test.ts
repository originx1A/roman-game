import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const c = await import('../src/game/comments.ts')
const { roleForClip } = await import('../src/game/voiceLines.ts')

test('tip lines play with their own voice settings (roleForClip)', () => {
  assert.equal(roleForClip('tip_stall_roman_clock'), 'roman')
  assert.equal(roleForClip('tip_undo_old_rent'), 'oldtimer')
  assert.equal(roleForClip('tip_trial_coach_rules'), 'coach')
  assert.equal(roleForClip('roman_idle_hello'), 'roman')
  assert.equal(roleForClip('old_idle_nap'), 'oldtimer')
  assert.equal(roleForClip('nope'), 'coach')
})

// each test starts its fake clock later than any earlier one (the old-timer cooldown is time-based)
let fakeBase = Date.now()
const pool = (n: string) => new Set<string>(c.VOICE_POOLS[n as keyof typeof c.VOICE_POOLS] as readonly string[])

test('every wired pool holds only lines written for its moment', () => {
  // idle: stall tips + idle roasts only
  for (const id of pool('roman.idle')) assert.ok(id.startsWith('roman_idle_') || id.startsWith('tip_stall_roman_'), id)
  for (const id of pool('old.idle')) assert.ok(id.startsWith('old_idle_') || id.startsWith('old_jab_') || id.startsWith('tip_stall_old_'), id)
  for (const id of pool('coach.idle')) assert.ok(id.startsWith('tip_stall_coach_') || id.startsWith('coach_idle_'), id)
  for (const id of pool('coach.undo')) assert.ok(id.startsWith('tip_undo_coach_'), id)
  for (const id of pool('roman.undo')) assert.ok(id.startsWith('tip_undo_roman_') || id.startsWith('roman_undo_'), id)
  // 9.30-o: the original four + the approved kind-specific lines
  for (const id of ['nope', 'region_full', 'row_taken', 'too_close']) assert.ok(pool('coach.wrong').has(id), id)
  assert.equal(pool('coach.wrong').size, 10)
  for (const id of pool('coach.wrong')) assert.ok(['nope', 'region_full', 'row_taken', 'too_close'].includes(id) || id.startsWith('coach_wrong_'), id)
  assert.deepEqual([...pool('coach.win')].sort(), ['board_complete', 'cleared'])
  assert.deepEqual([...pool('roman.nearMiss')], ['roman_almost'])
  assert.deepEqual([...pool('old.nearMiss')], ['old_nearmiss', 'old_nearmiss_close']) // 9.30-o
  // the retired one stays retired
  for (const [name, ids] of Object.entries(c.VOICE_POOLS)) assert.ok(!(ids as readonly string[]).includes('roman_nearmiss'), name)
})

test('win / lose separation holds for the new pools', () => {
  const WIN = new Set<string>()
  for (const n of c.WIN_POOLS) for (const id of pool(n)) WIN.add(id)
  for (const ev of c.LOSE_EVENTS) for (const n of c.EVENT_POOLS[ev]) for (const id of pool(n)) assert.ok(!WIN.has(id), `${ev}:${id}`)
  for (const ev of ['trial-start', 'daily-start', 'place-bad', 'idle', 'undo-spam'] as const)
    for (const n of c.EVENT_POOLS[ev]) for (const id of pool(n)) assert.ok(!WIN.has(id), `${ev}:${id}`)
})

test('wrong move: the coach line matches the kind of mistake, and the win event can be the coach', () => {
  const heard = new Set<string>()
  const realNow = Date.now
  let t = (fakeBase += 10_000_000_000)
  Date.now = () => (t += 600_000)
  try {
    for (let i = 0; i < 400; i++) {
      const b = c.banterFor('place-bad', 'region')
      if (b.clip) c.noteVoicePlayed(b.clip)
      if (b.clip && pool('coach.wrong').has(b.clip)) heard.add(b.clip)
      const g = c.banterFor('place-bad', 'touch')
      if (g.clip) c.noteVoicePlayed(g.clip)
      if (g.clip && pool('coach.wrong').has(g.clip)) assert.ok(g.clip === 'too_close' || g.clip === 'coach_wrong_touch_gap' || g.clip === 'coach_wrong_touch_corner' || false)
    }
    assert.ok(heard.has('region_full') && heard.has('coach_wrong_region_own'))
    const wins = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const b = c.banterFor('win')
      wins.add(b.clip!)
      c.noteVoicePlayed(b.clip!)
    }
    assert.ok(wins.has('board_complete') && wins.has('cleared'))
    const nm = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const b = c.banterFor('near-miss')
      nm.add(b.clip!)
      c.noteVoicePlayed(b.clip!)
    }
    assert.ok(nm.has('roman_almost') && nm.has('old_nearmiss'))
  } finally {
    Date.now = realNow
  }
})

test('spark progress alternates the two recorded takes per count', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 20; i++) {
    const b = c.sparkProgressBanter(2)
    seen.add(b.clip!)
    c.noteVoicePlayed(b.clip!)
  }
  assert.deepEqual([...seen].sort(), ['spark_2', 'spark_have_2'])
})

test('Trial / Daily start lines exist for all three voices', () => {
  for (const ev of ['trial-start', 'daily-start'] as const) {
    const heard = new Set<string>()
    const realNow = Date.now
    let t = (fakeBase += 10_000_000_000)
    Date.now = () => (t += 600_000)
    try {
      for (let i = 0; i < 200; i++) {
        const b = c.banterFor(ev)
        heard.add(b.clip!.split('_')[2])
        c.noteVoicePlayed(b.clip!)
      }
    } finally {
      Date.now = realNow
    }
    assert.deepEqual([...heard].sort(), ['coach', 'old', 'roman'])
  }
})

test('heard summary: total matches the audit (529 reachable, 9.30-o), per-voice split adds up', () => {
  const s = c.heardSummary()
  assert.equal(s.total, 529)
  assert.equal(s.voices.reduce((n: number, v: { total: number }) => n + v.total, 0), s.total)
  assert.deepEqual(s.voices.map((v: { name: string }) => v.name), ['Roman', 'Old-timer', 'Coach'])
  const before = s.heard
  c.heardLog.record('roman_idle_hello')
  assert.equal(c.heardSummary().heard, before + (c.heardLog.count('roman_idle_hello') === 1 ? 1 : 0))
  c.heardLog.reset()
  assert.equal(c.heardSummary().heard, 0)
})
