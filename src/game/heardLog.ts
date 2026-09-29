/**
 * Voice lines heard log (9.30-k). A saved count + last-heard time for every clip. Each moment picks
 * from its own pool the lines with the LOWEST heard count (random among ties), so a never-heard line
 * always comes before any repeat, across sessions, reloads and builds (the key is versioned by data
 * shape, not by build). A clip counts as heard only when it finishes or has played 70%.
 */
import type { BagStore } from './lineBag'

export const HEARD_KEY = 'roman.heard.v1'
/** a clip counts once this share of it has played */
export const HEARD_FRACTION = 0.7

/** 70% of the clip has played (media time, so the playback speed doesn't matter) */
export function heardEnough(currentTime: number, duration: number): boolean {
  return Number.isFinite(duration) && duration > 0 && currentTime / duration >= HEARD_FRACTION
}

export interface HeardLog {
  count(id: string): number
  lastAt(id: string): number
  /** one more play of `id` was heard */
  record(id: string, now?: number): void
  /** lines of `ids` heard at least once */
  heardOf(ids: readonly string[]): number
  totalPlays(): number
  reset(): void
}

type Saved = { v: 1; c: Record<string, [number, number]> }

export function createHeardLog(opts: { store?: BagStore | null; key?: string; seed?: () => string[] } = {}): HeardLog {
  const store = opts.store ?? null
  const key = opts.key ?? HEARD_KEY
  let data: Saved | null = null

  const save = () => {
    try {
      store?.set(key, JSON.stringify(data))
    } catch {
      /* storage full or blocked: counts still work for this visit */
    }
  }

  const load = (): Saved => {
    if (data) return data
    let fresh = true
    try {
      const raw = store?.get(key)
      if (raw) {
        const j = JSON.parse(raw) as Partial<Saved>
        if (j && j.v === 1 && j.c && typeof j.c === 'object') {
          const c: Record<string, [number, number]> = {}
          for (const [id, v] of Object.entries(j.c)) {
            if (Array.isArray(v) && Number.isFinite(v[0]) && v[0] > 0) c[id] = [Math.floor(v[0]), Number.isFinite(v[1]) ? v[1] : 0]
          }
          data = { v: 1, c }
          fresh = false
        }
      }
    } catch {
      data = null
    }
    if (!data) data = { v: 1, c: {} }
    if (fresh) {
      // First run of this log: lines the older shuffle bags already walked through count once
      try {
        for (const id of opts.seed?.() ?? []) if (!data.c[id]) data.c[id] = [1, 0]
        if (Object.keys(data.c).length) save()
      } catch {
        /* seeding is a nicety */
      }
    }
    return data
  }

  return {
    count: (id) => load().c[id]?.[0] ?? 0,
    lastAt: (id) => load().c[id]?.[1] ?? 0,
    record(id, now = Date.now()) {
      const d = load()
      const cur = d.c[id]
      d.c[id] = [(cur?.[0] ?? 0) + 1, now]
      save()
    },
    heardOf: (ids) => ids.reduce((n, id) => n + ((load().c[id]?.[0] ?? 0) > 0 ? 1 : 0), 0),
    totalPlays: () => Object.values(load().c).reduce((n, v) => n + v[0], 0),
    reset() {
      data = { v: 1, c: {} }
      save()
    },
  }
}
