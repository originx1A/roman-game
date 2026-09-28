import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createBagSet, memoryBagStore } from '../src/game/lineBag.ts'

register('./ts-resolve.mjs', import.meta.url)
const c = await import('../src/game/comments.ts')
const tips = await import('../src/game/voiceTips.ts')

const voiceSrc = readFileSync(new URL('../src/game/voiceLines.ts', import.meta.url), 'utf8')
const recorded = new Set([...voiceSrc.matchAll(/^\s+(\w+): '\/voices\//gm)].map((m) => m[1]))
const linesOf = (names: readonly string[]) => new Set(names.flatMap((n) => [...c.VOICE_POOLS[n]]))
const LOSE = linesOf(c.LOSE_POOLS)
const PUTDOWN = linesOf(c.PLAY_PUTDOWN_POOLS)
const EVENTS = Object.keys(c.EVENT_POOLS) as (keyof typeof c.EVENT_POOLS)[]

/** Play an event many times (the old-timer cooldown is time-based, so fake the clock forward). */
function play(event: (typeof EVENTS)[number], n = 400): Set<string> {
  const realNow = Date.now
  let t = realNow()
  Date.now = () => (t += 10_000)
  try {
    const out = new Set<string>()
    for (let i = 0; i < n; i++) {
      const b = c.banterFor(event)
      if (b.clip) out.add(b.clip)
    }
    return out
  } finally {
    Date.now = realNow
  }
}

test('every pool is non-empty, has no duplicates, and every line is a recorded clip', () => {
  for (const [name, pool] of Object.entries(c.VOICE_POOLS)) {
    assert.ok(pool.length > 0, name)
    assert.equal(new Set(pool).size, pool.length, `duplicate in ${name}`)
    for (const id of pool) assert.ok(recorded.has(id), `${name}: ${id} not recorded`)
  }
  for (const [ev, pools] of Object.entries(c.EVENT_POOLS)) for (const p of pools) assert.ok(c.VOICE_POOLS[p], `${ev} → unknown pool ${p}`)
})

test('each event only draws lines from its own pools', () => {
  for (const ev of EVENTS) {
    const allowed = linesOf(c.EVENT_POOLS[ev])
    for (const clip of play(ev)) assert.ok(allowed.has(clip), `${ev} played ${clip}, not in ${c.EVENT_POOLS[ev].join(', ')}`)
  }
})

test('win events never draw a loss line or a mid-board put-down; losses never draw a win line', () => {
  const WIN_LINES = linesOf(c.WIN_POOLS)
  for (const ev of c.WIN_EVENTS) {
    for (const clip of linesOf(c.EVENT_POOLS[ev])) {
      assert.ok(!LOSE.has(clip), `${ev} can pick loss line ${clip}`)
      // Buddy Hunt misses may use the old-timer's jabs (a missed tap in the bonus round)
      if (ev !== 'hunt-miss' && ev !== 'hunt-none') assert.ok(!PUTDOWN.has(clip), `${ev} can pick put-down ${clip}`)
    }
  }
  for (const ev of c.LOSE_EVENTS) for (const clip of linesOf(c.EVENT_POOLS[ev])) assert.ok(!WIN_LINES.has(clip), `${ev} can pick win line ${clip}`)
  // Trial time-up has hearts left: no "out of hearts" lines
  for (const id of ['out_of_hearts', 'roman_hearts', 'roman_lose_nap', 'old_lose_tape', 'old_lose_sandwich']) assert.ok(!linesOf(c.EVENT_POOLS['time-up']).has(id), id)
})

test('three-star tip (plays on a won board) never uses a loss line or a mid-board put-down', () => {
  for (const r of ['time', 'undo', 'score', 'any'] as const) {
    for (const l of tips.playableTipLines('three-star', r, () => true, () => 'x')) {
      assert.ok(!LOSE.has(l.id) && !PUTDOWN.has(l.id), `three-star/${r}: ${l.id}`)
    }
  }
})

test('not-best (won, slower than the best) is a teasing follow-up, queued after the cheer', () => {
  const b = c.banterFor('not-best')
  assert.ok(b.clip && linesOf(c.EVENT_POOLS['not-best']).has(b.clip))
  assert.ok((b.waitMs ?? 0) > 0 && (b.priority ?? 0) < c.VOICE_PRIORITY.win, 'waits for the win cheer, never cuts it')
  assert.deepEqual([...c.EVENT_POOLS['near-miss']], ['roman.cheer'])
  for (const l of c.NEW_NOT_BEST_LINES) assert.ok(!recorded.has(l.id), `${l.id} must stay silent until approved`)
})

test('once a board is won only win lines speak; once lost only loss lines; live board only play lines', () => {
  for (const ev of EVENTS) {
    const isWin = c.WIN_EVENTS.includes(ev), isLose = c.LOSE_EVENTS.includes(ev), isPlay = c.PLAY_EVENTS.includes(ev)
    assert.equal(c.eventAllowed(ev, 'won'), isWin || (!isLose && !isPlay), `${ev} after a win`)
    assert.equal(c.eventAllowed(ev, 'lost'), isLose || (!isWin && !isPlay), `${ev} after a loss`)
    assert.equal(c.eventAllowed(ev, null), !isWin && !isLose, `${ev} mid-board`)
  }
  for (const ev of ['idle', 'place-bad', 'undo-spam', 'aside', 'hint', 'lose'] as const) assert.ok(!c.eventAllowed(ev, 'won'), ev)
})

test('every pool: 3 full cycles, no line twice within a cycle, no back-to-back repeat (even across refills and a reload)', () => {
  for (const [name, pool] of Object.entries(c.VOICE_POOLS)) {
    const store = memoryBagStore()
    let set = createBagSet({ store })
    let last: string | null = null
    for (let cycle = 0; cycle < 3; cycle++) {
      if (cycle === 2) set = createBagSet({ store }) // a reload / new session mid-way
      const seen = new Set<string>()
      for (let i = 0; i < pool.length; i++) {
        const pick = set.bag(name, pool)()
        assert.ok(!seen.has(pick), `${name}: ${pick} repeated before the pool ran out (cycle ${cycle + 1})`)
        if (pool.length > 1) assert.notEqual(pick, last, `${name}: ${pick} back-to-back`)
        seen.add(pick)
        last = pick
      }
      assert.equal(seen.size, pool.length, name)
    }
  }
})

test('per-pool line counts (printed for the report)', () => {
  const counts = Object.fromEntries(Object.entries(c.VOICE_POOLS).map(([k, v]) => [k, v.length]))
  console.log('POOL COUNTS ' + JSON.stringify(counts))
  assert.ok(counts['roman.cheer'] >= 40 && counts['roman.wrong'] >= 20 && counts['old.notBest'] >= 8)
})
