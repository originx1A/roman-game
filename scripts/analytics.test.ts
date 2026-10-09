import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

register('./ts-resolve.mjs', import.meta.url)
const S = await import('../netlify/lib/analytics.ts')
const C = await import('../src/game/analytics.ts')

const ID = 'a'.repeat(32)
const geo = { city: 'Toronto', subdivision: { name: 'Ontario', code: 'ON' }, country: { code: 'CA', name: 'Canada' }, postalCode: 'M5V', latitude: 43.6, longitude: -79.4 }

test('client: anonymous id is made once, saved, and never contains a name; return visit only on a later day', () => {
  const mem = new Map<string, string>()
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  const a = C.loadAnon(st)
  assert.match(a.id, /^[a-f0-9]{32}$/)
  assert.equal(C.loadAnon(st).id, a.id, 'same id next time')
  const o1 = C.openEvents(a, '2026-09-29')
  assert.deepEqual(o1.events, ['app_open'], 'first ever open')
  const o2 = C.openEvents(o1.next, '2026-09-29')
  assert.deepEqual(o2.events, ['app_open'], 'same day')
  const o3 = C.openEvents(o2.next, '2026-09-30')
  assert.deepEqual(o3.events, ['app_open', 'return_visit'], 'next day')
  mem.set(C.ANON_KEY, '{"id":"Tony D <tony@x.com>"}')
  assert.match(C.loadAnon(st).id, /^[a-f0-9]{32}$/, 'a bad saved id is replaced')
})

test('client: sendPing never throws (offline / fetch rejects / no fetch)', async () => {
  const realFetch = globalThis.fetch
  try {
    globalThis.fetch = (() => Promise.reject(new Error('offline'))) as never
    C.sendPing({ id: ID, ev: 'app_open' })
    globalThis.fetch = (() => { throw new Error('boom') }) as never
    C.sendPing({ id: ID, ev: 'app_open' })
    C.sendPing({ id: ID, ev: 'app_open' }, false)
    await new Promise((r) => setTimeout(r, 10))
  } finally {
    globalThis.fetch = realFetch
  }
})

test('server: events are validated; geo gives only city/region/country; no IP, lat/long or postal code is kept', () => {
  const e = S.buildEvent({ id: ID, ev: 'level_clear', size: 6, ms: 41234, name: 'Tony', email: 'x@y.z', ip: '1.2.3.4' }, geo, new Date('2026-09-29T14:00:00Z'))!
  assert.deepEqual(e, { t: '2026-09-29T14:00:00.000Z', id: ID, ev: 'level_clear', size: 6, ms: 41234, city: 'Toronto', region: 'Ontario', country: 'CA' })
  const blob = JSON.stringify(e)
  for (const bad of ['Tony', 'x@y.z', '1.2.3.4', 'M5V', '43.6', '79.4']) assert.ok(!blob.includes(bad), bad)
  assert.equal(S.buildEvent({ id: 'nope', ev: 'app_open' }, geo), null)
  assert.equal(S.buildEvent({ id: ID, ev: 'hack' }, geo), null)
  assert.equal(S.buildEvent({ id: ID, ev: 'feedback', vote: 'sideways' }, geo), null)
  assert.equal(S.buildEvent(null, geo), null)
  const fb = S.buildEvent({ id: ID, ev: 'feedback', vote: 'down', note: '  too\n hard <b>x</b> ' + 'z'.repeat(400) }, undefined)!
  assert.ok(fb.note!.length <= 200 && !/[<>\n]/.test(fb.note!))
  assert.equal(fb.city, undefined)
  const clear = S.buildEvent({ id: ID, ev: 'level_clear', size: 99, ms: -5 }, geo)!
  assert.equal(clear.size, undefined)
  assert.equal(clear.ms, undefined)
})

test('server: store and aggregate (UTC stored, Toronto shown; unique / returning / hour / regions / thumbs / notes)', async () => {
  const store = S.memoryEventStore()
  const A = 'a'.repeat(32), B = 'b'.repeat(32), Cc = 'c'.repeat(32)
  const at = (iso: string, body: Record<string, unknown>, g = geo) => S.recordEvent(store, S.buildEvent(body, g, new Date(iso))!)
  await at('2026-09-28T15:00:00Z', { id: A, ev: 'app_open' })
  await at('2026-09-29T05:00:00Z', { id: A, ev: 'app_open' }) // 01:00 Toronto on the 29th (a second Toronto day)
  await at('2026-09-29T14:00:00Z', { id: A, ev: 'level_clear', size: 5, ms: 30000 }) // 10:00 Toronto
  await at('2026-09-29T14:05:00Z', { id: A, ev: 'level_clear', size: 6, ms: 60000 })
  await at('2026-09-29T15:00:00Z', { id: B, ev: 'app_open' }, { city: 'Paris', country: { code: 'FR' } })
  await at('2026-09-29T15:01:00Z', { id: B, ev: 'return_visit' }, { city: 'Paris', country: { code: 'FR' } })
  await at('2026-09-29T16:00:00Z', { id: Cc, ev: 'feedback', vote: 'up', note: 'love it' })
  await at('2026-09-29T17:00:00Z', { id: B, ev: 'feedback', vote: 'down' }, { city: 'Paris', country: { code: 'FR' } })
  const events = await S.loadEvents(store, 3, new Date('2026-09-29T18:00:00Z'))
  assert.equal(events.length, 8)
  const s = S.aggregate(events)
  assert.equal(s.opens, 3)
  assert.equal(s.uniquePlayers, 3)
  assert.equal(s.returningPlayers, 2, 'A opened on 2 Toronto days, B sent return_visit')
  assert.equal(s.levelsCleared, 2)
  assert.deepEqual(s.playsByDay, [{ day: '2026-09-29', plays: 2 }])
  assert.equal(s.playsByHour[10], 2)
  assert.equal(s.thumbsUp, 1)
  assert.equal(s.thumbsDown, 1)
  assert.equal(s.notes.length, 1)
  assert.equal(s.notes[0].note, 'love it')
  assert.equal(s.topRegions[0].place, 'Toronto, Ontario, CA')
  assert.ok(s.topRegions.some((r) => r.place === 'Paris, FR'))
  assert.ok([...store.data.keys()].every((k) => k.startsWith('e/2026-09-')))
})

test('source: no browser geolocation anywhere; ping is a silent POST; owner stats need the owner key; privacy note in Settings', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
  const app = read('../src/App.tsx')
  const client = read('../src/game/analytics.ts')
  for (const src of [app, client, read('../src/components/OwnerGifts.tsx')]) assert.doesNotMatch(src, /navigator\.geolocation|getCurrentPosition/)
  assert.match(read('../netlify/functions/analytics-stats.ts'), /await ownerGate\(req\)/) // 10.09: password or login token, checked on the server
  assert.doesNotMatch(read('../netlify/functions/ping.ts'), /x-nf-client-connection-ip|req\.headers|context\.ip/)
  assert.match(app, /data-testid="privacy-note"/)
  assert.match(app, /data-testid="analytics-toggle"/)
  assert.match(client, /do not keep your IP address/)
  assert.match(app, /isStoreBuild\(\)/)
})
