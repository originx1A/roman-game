/**
 * The Unseen, between runs. Snarky and helpful. Never during a run.
 * At most one pointer every 4 finished runs, and 3 a day.
 * The same line waits 7 days before it can repeat.
 * No ghost and no replay of where to press.
 */

export interface PointerLine {
  id: string
  text: string
  /** Absolute https URL, or a special in-game target. */
  href?: string
  /** Where this line fits. 'any' is the fallback. */
  when: PointerWhen
}

export type PointerWhen = 'pb' | 'slow' | 'near' | 'losses' | 'cards' | 'home' | 'stable' | 'weekly' | 'any'

const SITE = 'https://romansgame.com'

export const POINTER_LINES: readonly PointerLine[] = [
  { id: 'p1', when: 'pb', text: "New best. Don't get cocky. Your card collection is still missing pieces.", href: `${SITE}/stories/cards/?from=unseen` },
  { id: 'p2', when: 'cards', text: "You've got cards you haven't even looked at. I have. They're nice.", href: `${SITE}/stories/cards/?from=unseen` },
  { id: 'p3', when: 'slow', text: "That was slow. The defenders' stories are faster reads.", href: `${SITE}/defenders/?from=unseen` },
  { id: 'p4', when: 'any', text: 'Lupa has a backstory, you know. Unlike you, apparently.', href: `${SITE}/defenders/lupa.html?from=unseen` },
  { id: 'p5', when: 'any', text: "Want to know who I am? You won't find out here. Try the lore.", href: `${SITE}/lore.html?from=unseen` },
  { id: 'p6', when: 'near', text: 'A hair off your best. I felt that from here.', href: undefined },
  { id: 'p7', when: 'any', text: "Stuck? Mark X's first. They're free. Unlike my advice." },
  { id: 'p8', when: 'weekly', text: "The swamp's foggy today. News says so.", href: `${SITE}/news/?from=unseen` },
  { id: 'p9', when: 'weekly', text: "Roman's World News has a new story. I read it before you did.", href: `${SITE}/news/?from=unseen` },
  { id: 'p10', when: 'weekly', text: "There's a podcast. I'm not in it. Yet.", href: `${SITE}/podcast/?from=unseen` },
  { id: 'p11', when: 'weekly', text: "Listen while you lose. The soundtrack's on the site.", href: `${SITE}/music/?from=unseen` },
  { id: 'p12', when: 'weekly', text: "Yes, the music has a song named after me. You're welcome.", href: `${SITE}/music/?from=unseen` },
  { id: 'p13', when: 'home', text: 'Need a new phone background? Something with me in it, maybe.', href: `${SITE}/wallpapers/?from=unseen` },
  { id: 'p14', when: 'cards', text: "Stories have cards too. You're missing some. I counted.", href: `${SITE}/stories/?from=unseen` },
  { id: 'p15', when: 'losses', text: 'Three losses. Try a 5x5 to warm up. Even I warm up.' },
  { id: 'p16', when: 'slow', text: 'Combo broke. Quick moves keep it alive. Quick. Moves.' },
  { id: 'p17', when: 'stable', text: 'Your buddy looks hungry. Feed it and it fights harder.' },
  { id: 'p18', when: 'stable', text: 'A happy buddy pays more. A hungry one pouts. Just saying.' },
  { id: 'p19', when: 'home', text: "Daily's waiting. Same board for everyone. Let's see." },
  { id: 'p20', when: 'pb', text: "You beat yesterday's you. Yesterday's you is sulking." },
  { id: 'p21', when: 'any', text: 'The leaderboard has room for one more name. Probably not yours. Prove me wrong.' },
  { id: 'p22', when: 'weekly', text: "Merch is coming. I'll be on a shirt. Obviously.", href: `${SITE}/?from=unseen` },
  { id: 'p23', when: 'home', text: "I'm everywhere at romansgame.com. Go look. I'll wait.", href: `${SITE}/?from=unseen` },
  { id: 'p24', when: 'slow', text: 'That was almost good. The how-to page on the site makes it great.', href: `${SITE}/play/?from=unseen` },
  { id: 'p25', when: 'any', text: 'Watch how the pros do it. Well, how Roman does it.', href: `${SITE}/watch.html?from=unseen` },
  { id: 'p26', when: 'cards', text: "Every card tells a story. Yours says 'try again.'", href: `${SITE}/stories/cards/?from=unseen` },
]

export const POINTER_MAX_PER_DAY = 3
export const POINTER_RUN_GAP = 4
export const POINTER_REPEAT_MS = 7 * 86_400_000

export interface PointerMemory {
  day: string
  shown: number
  /** Finished runs since the last pointer. */
  runsSince: number
  recent: { id: string; at: number }[]
}

export function emptyPointerMemory(day: string): PointerMemory {
  return { day, shown: 0, runsSince: 0, recent: [] }
}

export function rollPointerDay(m: PointerMemory, day: string): PointerMemory {
  if (m.day === day) return m
  return { ...m, day, shown: 0 }
}

export function notePointerRun(m: PointerMemory, day: string): PointerMemory {
  const d = rollPointerDay(m, day)
  return { ...d, runsSince: d.runsSince + 1 }
}

export interface PointerContext {
  duringRun: boolean
  when: PointerWhen
  now: number
  day: string
  /** Voice and tips both off: stay quiet. */
  muted: boolean
}

export function pickPointer(m: PointerMemory, ctx: PointerContext, rand: () => number = Math.random): { memory: PointerMemory; line: PointerLine | null } {
  const memory = rollPointerDay(m, ctx.day)
  if (ctx.duringRun || ctx.muted) return { memory, line: null }
  if (memory.shown >= POINTER_MAX_PER_DAY) return { memory, line: null }
  if (memory.runsSince < POINTER_RUN_GAP) return { memory, line: null }
  const fresh = POINTER_LINES.filter((line) => {
    const prev = memory.recent.find((r) => r.id === line.id)
    if (prev && ctx.now - prev.at < POINTER_REPEAT_MS) return false
    return line.when === ctx.when || line.when === 'any'
  })
  const pool = fresh.filter((line) => line.when === ctx.when)
  const choices = pool.length ? pool : fresh.filter((line) => line.when === 'any')
  if (!choices.length) return { memory, line: null }
  const line = choices[Math.floor(rand() * choices.length) % choices.length]
  return {
    line,
    memory: {
      ...memory,
      shown: memory.shown + 1,
      runsSince: 0,
      recent: [...memory.recent.filter((r) => r.id !== line.id), { id: line.id, at: ctx.now }].slice(-40),
    },
  }
}
