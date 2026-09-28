/** Shuffle-bag picker that will not repeat one of the last few items. */

export function createShuffleBag<T>(items: readonly T[], avoidLast = 3): () => T {
  if (items.length === 0) throw new Error('empty voice pool')
  const avoid = Math.min(avoidLast, Math.max(0, items.length - 1))
  let bag: T[] = []
  const recent: T[] = []

  const shuffle = (arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  return () => {
    const blocked = new Set(recent)
    if (bag.length === 0 || bag.every((item) => blocked.has(item))) {
      const fresh = items.filter((item) => !blocked.has(item))
      bag = shuffle([...(fresh.length > 0 ? fresh : items)])
    }
    let pick = bag.pop() as T
    if (blocked.has(pick)) {
      const idx = bag.findIndex((item) => !blocked.has(item))
      if (idx >= 0) {
        const alt = bag[idx]
        bag[idx] = pick
        pick = alt
      }
    }
    recent.push(pick)
    if (recent.length > avoid) recent.shift()
    return pick
  }
}

/*
 * Voice line shuffle bags (9.27-a).
 *
 * Every line in a category plays once, in random order, before any line in that category repeats.
 * A new shuffle never starts with the line that just played, and one line shared by two categories
 * is never spoken twice in a row. Bag positions live in localStorage, so a reload or a new session
 * carries on through the same bag instead of starting over with the same few lines.
 */

export interface BagStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const VOICE_BAGS_KEY = 'roman.voicebags.v1'

interface SavedBag {
  order: string[]
  pos: number
}

interface SavedBags {
  /** Last line handed out by any bag (for the cross-category no-back-to-back rule). */
  last: string | null
  /** 9.29-a: the last few lines handed out by any bag, newest last. A line shared by two
   *  categories (or a tip and its original spot) waits until these have moved on. */
  recent?: string[]
  bags: Record<string, SavedBag>
}

/** How many recently spoken lines (across every category) a bag steps around when it can. */
export const RECENT_AVOID = 8

export interface BagSet {
  /** A picker for one category. `name` must be stable: it is the save key for this bag. */
  bag<T extends string>(name: string, items: readonly T[]): () => T
  /** Last line handed out by any bag in this set. */
  last(): string | null
}

/** localStorage when it is usable (Safari private mode can throw), otherwise nothing is saved. */
export function browserBagStore(): BagStore | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const ls = localStorage
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
    }
  } catch {
    return null
  }
}

export function memoryBagStore(): BagStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) }
}

export function createBagSet(
  opts: { store?: BagStore | null; rng?: () => number; key?: string } = {},
): BagSet {
  const store = opts.store ?? null
  const rng = opts.rng ?? Math.random
  const key = opts.key ?? VOICE_BAGS_KEY
  let state: SavedBags | null = null

  const load = (): SavedBags => {
    if (state) return state
    let parsed: SavedBags | null = null
    try {
      const raw = store?.get(key)
      const v = raw ? (JSON.parse(raw) as Partial<SavedBags>) : null
      if (v && typeof v === 'object' && v.bags && typeof v.bags === 'object') {
        const recent = Array.isArray(v.recent) ? v.recent.filter((x): x is string => typeof x === 'string').slice(-RECENT_AVOID) : []
        parsed = { last: typeof v.last === 'string' ? v.last : null, recent, bags: v.bags as Record<string, SavedBag> }
      }
    } catch {
      parsed = null
    }
    state = parsed ?? { last: null, recent: [], bags: {} }
    return state
  }

  const save = () => {
    try {
      store?.set(key, JSON.stringify(state))
    } catch {
      /* storage full or blocked: bags still work for this session */
    }
  }

  const shuffle = (arr: string[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    return arr
  }

  /** A fresh cycle whose first line is none of `avoid` (when the pool allows it). */
  const newCycle = (items: string[], avoid: (string | null | undefined)[]): SavedBag => {
    const order = shuffle([...items])
    const blocked = new Set(avoid.filter((x): x is string => !!x))
    if (order.length > 1 && blocked.has(order[0])) {
      const j = order.findIndex((x) => !blocked.has(x))
      if (j > 0) [order[0], order[j]] = [order[j], order[0]]
    }
    return { order, pos: 0 }
  }

  /** Bring a saved bag in line with the current pool (lines added or removed in an update). */
  const reconcile = (saved: SavedBag | undefined, items: string[]): SavedBag | null => {
    if (!saved || !Array.isArray(saved.order)) return null
    const inPool = new Set(items)
    const pos = Number.isFinite(saved.pos) ? Math.max(0, Math.floor(saved.pos)) : 0
    const played: string[] = []
    const seen = new Set<string>()
    for (const x of saved.order.slice(0, pos)) if (inPool.has(x) && !seen.has(x)) (played.push(x), seen.add(x))
    let remaining: string[] = []
    for (const x of saved.order.slice(pos)) if (inPool.has(x) && !seen.has(x)) (remaining.push(x), seen.add(x))
    const added = items.filter((x) => !seen.has(x))
    // New lines join the part of the bag still to come, so they turn up soon
    if (added.length) remaining = shuffle([...remaining, ...added])
    return { order: [...played, ...remaining], pos: played.length }
  }

  function bag<T extends string>(name: string, pool: readonly T[]): () => T {
    const items = [...new Set(pool)] as string[]
    if (items.length === 0) throw new Error(`empty voice pool ${name}`)
    return () => {
      const s = load()
      let b = reconcile(s.bags[name], items) ?? newCycle(items, [s.last])
      if (b.pos >= b.order.length) b = newCycle(items, [b.order[b.order.length - 1], s.last])
      if (items.length > 1 && b.order[b.pos] === s.last) {
        const j = b.order.findIndex((x, k) => k > b.pos && x !== s.last)
        if (j > 0) {
          ;[b.order[b.pos], b.order[j]] = [b.order[j], b.order[b.pos]]
        } else {
          // The only line left in this cycle is the one just spoken (in another category):
          // start the next cycle now, with that line anywhere but first.
          b = newCycle(items, [s.last])
        }
      }
      // Step around lines heard lately in other categories (swap within what's left of this cycle,
      // so every line still plays once per cycle)
      const recent = new Set(s.recent ?? [])
      if (recent.has(b.order[b.pos])) {
        const j = b.order.findIndex((x, k) => k > b.pos && !recent.has(x) && x !== s.last)
        if (j > 0) [b.order[b.pos], b.order[j]] = [b.order[j], b.order[b.pos]]
      }
      const pick = b.order[b.pos]
      b.pos += 1
      s.bags[name] = b
      s.last = pick
      s.recent = [...(s.recent ?? []).filter((x) => x !== pick), pick].slice(-RECENT_AVOID)
      save()
      return pick as T
    }
  }

  return { bag, last: () => load().last }
}
