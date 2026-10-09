/**
 * 9.30-r: tiny anonymous analytics. What is stored per event: a UTC time, a random anonymous id made on the
 * device, the event name, board size / clear time (level_clear), a thumbs vote and short note (feedback), and a rough
 * place (city / region / country) taken from Netlify's request geo. NOT stored: IP address, name, email, browser
 * location, or anything typed except the optional feedback note.
 */
export const ANALYTICS_STORE = 'roman-analytics'
export const EVENTS = ['app_open', 'level_clear', 'return_visit', 'feedback', 'session_end', 'level_abandon', 'share', 'story_end'] as const
/** 10.09: longest session we believe (anything longer is a tab left open) */
export const SESSION_MAX_MS = 12 * 3_600_000
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
  /** owner-archived feedback: hidden from the owner panel, kept in storage */
  archived?: boolean
  /** blob key — attached by loadEvents at read time, never stored */
  key?: string
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
  if (ev === 'session_end') {
    const ms = Number(b.ms)
    if (!Number.isFinite(ms) || ms < 1000) return null
    out.ms = Math.round(Math.min(ms, SESSION_MAX_MS))
  }
  if (ev === 'level_abandon') {
    const size = Number(b.size)
    if (Number.isInteger(size) && size >= 3 && size <= 12) out.size = size
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

/** Events of the last `days` UTC days (bounded: at most `cap` events are read).
 * Each returned event has its blob `key` attached for owner management. */
export async function loadEvents(store: EventStore, days: number, now: Date = new Date(), cap = 20000): Promise<StoredEvent[]> {
  const out: StoredEvent[] = []
  for (let i = 0; i < days && out.length < cap; i++) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const { blobs } = await store.list({ prefix: `e/${dayKeyUtc(d)}/` })
    for (let j = 0; j < blobs.length && out.length < cap; j += 40) {
      const batch = blobs.slice(j, j + 40)
      const got = await Promise.all(batch.map((x) => store.get(x.key, { type: 'json' }).catch(() => null)))
      for (let k = 0; k < got.length; k++) {
        const g = got[k] as StoredEvent | null
        if (g && typeof g === 'object' && g.id) {
          g.key = batch[k].key
          out.push(g)
        }
      }
    }
  }
  return out
}

const TZ = 'America/Toronto'
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' })
export const torontoDay = (iso: string) => fmtDay.format(new Date(iso))
export const torontoHour = (iso: string) => Number(fmtHour.format(new Date(iso)))

export interface OwnerNote {
  /** blob key — stable identifier for owner management */
  id: string
  t: string
  vote: 'up' | 'down'
  note: string
  place: string
}

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
  /** newest first; times are UTC ISO (the page shows Toronto time); archived notes excluded */
  notes: OwnerNote[]
  /** owner-archived feedback, newest first */
  archivedNotes: OwnerNote[]
  /** 10.09 who played and for how long (anonymous ids only) */
  shares: number
  storyEnds: number
  sessionsCounted: number
  avgSessionSec: number
  totalPlaySec: number
  abandonsBySize: { size: number; count: number }[]
  /** per Toronto day, newest first */
  daily: DayTotal[]
  /** per anonymous player (short id), most recently seen first, at most 100 */
  players: PlayerRow[]
  /** last sessions, newest first, at most 50 */
  recentSessions: { player: string; t: string; sec: number; place: string }[]
}

export interface DayTotal {
  day: string
  players: number
  opens: number
  sessions: number
  playSec: number
  levels: number
}

export interface PlayerRow {
  /** first 8 hex of the random device id: enough to tell players apart, not who they are */
  player: string
  firstSeen: string
  lastSeen: string
  days: number
  opens: number
  sessions: number
  playSec: number
  levels: number
  place: string
}

export const shortId = (id: string) => id.slice(0, 8)

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
  const notes: OwnerNote[] = []
  const archivedNotes: OwnerNote[] = []
  let shares = 0
  let storyEnds = 0
  let sessions = 0
  let sessionMs = 0
  const abandons = new Map<number, number>()
  const dayMap = new Map<string, { players: Set<string>; opens: number; sessions: number; ms: number; levels: number }>()
  const per = new Map<string, Omit<PlayerRow, 'player' | 'days' | 'playSec'> & { ms: number; daySet: Set<string> }>()
  const recent: { player: string; t: string; sec: number; place: string }[] = []
  for (const e of events) {
    players.add(e.id)
    const place = placeOf(e)
    const dayKey = torontoDay(e.t)
    const d = dayMap.get(dayKey) ?? { players: new Set<string>(), opens: 0, sessions: 0, ms: 0, levels: 0 }
    dayMap.set(dayKey, d)
    d.players.add(e.id)
    const p = per.get(e.id) ?? { firstSeen: e.t, lastSeen: e.t, opens: 0, sessions: 0, ms: 0, levels: 0, place, daySet: new Set<string>() }
    per.set(e.id, p)
    if (e.t < p.firstSeen) p.firstSeen = e.t
    if (e.t >= p.lastSeen) {
      p.lastSeen = e.t
      if (place !== 'Unknown') p.place = place
    }
    p.daySet.add(dayKey)
    if (e.ev === 'app_open') {
      d.opens++
      p.opens++
    } else if (e.ev === 'level_clear') {
      d.levels++
      p.levels++
    } else if (e.ev === 'session_end' && typeof e.ms === 'number') {
      const ms = Math.min(e.ms, SESSION_MAX_MS)
      sessions++
      sessionMs += ms
      d.sessions++
      d.ms += ms
      p.sessions++
      p.ms += ms
      recent.push({ player: shortId(e.id), t: e.t, sec: Math.round(ms / 1000), place })
    } else if (e.ev === 'level_abandon' && e.size) abandons.set(e.size, (abandons.get(e.size) ?? 0) + 1)
    else if (e.ev === 'share') shares++
    else if (e.ev === 'story_end') storyEnds++
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
      const item: OwnerNote = { id: e.key ?? `${e.t}:${e.id}`, t: e.t, vote: e.vote, note: e.note ?? '', place }
      if (e.archived) {
        if (e.note) archivedNotes.push(item)
      } else {
        if (e.vote === 'up') up++
        else down++
        if (e.note) notes.push(item)
      }
    }
  }
  for (const [id, set] of openDays) if (set.size >= 2) returned.add(id)
  notes.sort((a, b) => (a.t < b.t ? 1 : -1))
  archivedNotes.sort((a, b) => (a.t < b.t ? 1 : -1))
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
    archivedNotes: archivedNotes.slice(0, 50),
    shares,
    storyEnds,
    sessionsCounted: sessions,
    avgSessionSec: sessions ? Math.round(sessionMs / sessions / 1000) : 0,
    totalPlaySec: Math.round(sessionMs / 1000),
    abandonsBySize: [...abandons.entries()].sort((a, b) => a[0] - b[0]).map(([size, count]) => ({ size, count })),
    daily: [...dayMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, x]) => ({ day, players: x.players.size, opens: x.opens, sessions: x.sessions, playSec: Math.round(x.ms / 1000), levels: x.levels })),
    players: [...per.entries()]
      .map(([id, x]) => ({ player: shortId(id), firstSeen: x.firstSeen, lastSeen: x.lastSeen, days: x.daySet.size, opens: x.opens, sessions: x.sessions, playSec: Math.round(x.ms / 1000), levels: x.levels, place: x.place }))
      .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1))
      .slice(0, 100),
    recentSessions: recent.sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 50),
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
