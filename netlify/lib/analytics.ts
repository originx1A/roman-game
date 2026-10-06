/**
 * 9.30-r: tiny anonymous analytics. What is stored per event: a UTC time, a random anonymous id made on the
 * device, the event name, board size / clear time (level_clear), a thumbs vote and short note (feedback), and a rough
 * place (city / region / country) taken from Netlify's request geo. NOT stored: IP address, name, email, browser
 * location, or anything typed except the optional feedback note.
 */
export const ANALYTICS_STORE = 'roman-analytics'
export const EVENTS = ['app_open', 'level_clear', 'return_visit', 'feedback'] as const
export type AnalyticsEvent = (typeof EVENTS)[number]
export const NOTE_MAX = 200
export const ID_RE = /^[a-f0-9]{32}$/

export interface StoredEvent {
  /** UTC ISO time */
  t: string
  id: string
  ev: AnalyticsEvent
  size?: number
  ms?: number
  vote?: 'up' | 'down'
  note?: string
  city?: string
  region?: string
  country?: string
}

export interface EventStore {
  get(key: string, opts: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean }): Promise<{ modified: boolean }>
  list(opts?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>
}

export interface Geo {
  city?: string
  country?: { code?: string; name?: string }
  subdivision?: { code?: string; name?: string }
}

const clean = (s: unknown, max: number) =>
  typeof s === 'string' ? Array.from(s.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('') : ''

/** Turn a request body + Netlify geo into a storable event (null = reject). */
export function buildEvent(body: unknown, geo: Geo | undefined, now: Date = new Date()): StoredEvent | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.id !== 'string' || !ID_RE.test(b.id)) return null
  if (typeof b.ev !== 'string' || !(EVENTS as readonly string[]).includes(b.ev)) return null
  const ev = b.ev as AnalyticsEvent
  const out: StoredEvent = { t: now.toISOString(), id: b.id, ev }
  const city = clean(geo?.city, 60)
  const region = clean(geo?.subdivision?.name ?? geo?.subdivision?.code, 60)
  const country = clean(geo?.country?.code ?? geo?.country?.name, 60)
  if (city) out.city = city
  if (region) out.region = region
  if (country) out.country = country
  if (ev === 'level_clear') {
    const size = Number(b.size)
    const ms = Number(b.ms)
    if (Number.isInteger(size) && size >= 3 && size <= 12) out.size = size
    if (Number.isFinite(ms) && ms >= 0 && ms <= 3_600_000) out.ms = Math.round(ms)
  }
  if (ev === 'feedback') {
    if (b.vote !== 'up' && b.vote !== 'down') return null
    out.vote = b.vote
    const note = clean(b.note, NOTE_MAX)
    if (note) out.note = note
  }
  return out
}

export const dayKeyUtc = (d: Date) => d.toISOString().slice(0, 10)

export async function recordEvent(store: EventStore, ev: StoredEvent, rand: () => string = () => Math.random().toString(36).slice(2, 8)): Promise<void> {
  await store.setJSON(`e/${dayKeyUtc(new Date(ev.t))}/${ev.t}-${rand()}`, ev)
}

/** Events of the last `days` UTC days (bounded: at most `cap` events are read). */
export async function loadEvents(store: EventStore, days: number, now: Date = new Date(), cap = 20000): Promise<StoredEvent[]> {
  const out: StoredEvent[] = []
  for (let i = 0; i < days && out.length < cap; i++) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const { blobs } = await store.list({ prefix: `e/${dayKeyUtc(d)}/` })
    for (let j = 0; j < blobs.length && out.length < cap; j += 40) {
      const got = await Promise.all(blobs.slice(j, j + 40).map((x) => store.get(x.key, { type: 'json' }).catch(() => null)))
      for (const g of got) if (g && typeof g === 'object' && (g as StoredEvent).id) out.push(g as StoredEvent)
    }
  }
  return out
}

const TZ = 'America/Toronto'
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })
export const torontoDay = (iso: string) => fmtDay.format(new Date(iso))
export const torontoHour = (iso: string) => Number(fmtHour.format(new Date(iso)))

export interface Stats {
  days: number
  opens: number
  uniquePlayers: number
  returningPlayers: number
  levelsCleared: number
  /** plays (level clears) by Toronto day, oldest first */
  playsByDay: { day: string; plays: number }[]
  /** plays by Toronto hour 0-23 */
  playsByHour: number[]
  topRegions: { place: string; players: number }[]
  thumbsUp: number
  thumbsDown: number
  /** newest first; times are UTC ISO (the page shows Toronto time) */
  notes: { t: string; vote: 'up' | 'down'; note: string; place: string }[]
}

const placeOf = (e: StoredEvent) => [e.city, e.region, e.country].filter(Boolean).join(', ') || 'Unknown'

export function aggregate(events: StoredEvent[], days = 30): Stats {
  const players = new Set<string>()
  const openDays = new Map<string, Set<string>>()
  const returned = new Set<string>()
  const byDay = new Map<string, number>()
  const byHour = Array<number>(24).fill(0)
  const regionPlayers = new Map<string, Set<string>>()
  let opens = 0
  let cleared = 0
  let up = 0
  let down = 0
  const notes: Stats['notes'] = []
  for (const e of events) {
    players.add(e.id)
    const place = placeOf(e)
    if (!regionPlayers.has(place)) regionPlayers.set(place, new Set())
    regionPlayers.get(place)!.add(e.id)
    if (e.ev === 'app_open') {
      opens++
      const set = openDays.get(e.id) ?? new Set<string>()
      set.add(torontoDay(e.t))
      openDays.set(e.id, set)
    } else if (e.ev === 'return_visit') returned.add(e.id)
    else if (e.ev === 'level_clear') {
      cleared++
      byDay.set(torontoDay(e.t), (byDay.get(torontoDay(e.t)) ?? 0) + 1)
      byHour[torontoHour(e.t)]++
    } else if (e.ev === 'feedback' && e.vote) {
      if (e.vote === 'up') up++
      else down++
      if (e.note) notes.push({ t: e.t, vote: e.vote, note: e.note, place })
    }
  }
  for (const [id, set] of openDays) if (set.size >= 2) returned.add(id)
  notes.sort((a, b) => (a.t < b.t ? 1 : -1))
  return {
    days,
    opens,
    uniquePlayers: players.size,
    returningPlayers: returned.size,
    levelsCleared: cleared,
    playsByDay: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, plays]) => ({ day, plays })),
    playsByHour: byHour,
    topRegions: [...regionPlayers.entries()].map(([place, s]) => ({ place, players: s.size })).sort((a, b) => b.players - a.players).slice(0, 10),
    thumbsUp: up,
    thumbsDown: down,
    notes: notes.slice(0, 20),
  }
}

export function memoryEventStore(): EventStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    async get(key) {
      return data.has(key) ? structuredClone(data.get(key)) : null
    },
    async setJSON(key, value, opts) {
      if (opts?.onlyIfNew && data.has(key)) return { modified: false }
      data.set(key, structuredClone(value))
      return { modified: true }
    },
    async list(opts) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(opts?.prefix ?? '')).map((key) => ({ key })) }
    },
  }
}
