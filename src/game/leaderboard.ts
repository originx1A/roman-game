/** One row from public.public_scores. Names are the player's public name only. */
export interface PublicScore {
  name: string
  score: number
  time_seconds: number
  mode: string
  created_at: string
  /** Set once migration 005 is applied. The daily puzzle's Toronto date. */
  daily_date?: string | null
}

export type BoardTab = 'today' | 'week' | 'all'

export interface RankedPlayer {
  rank: number
  name: string
  score: number
  timeSeconds: number
  mode: string
}

export type BoardLine = RankedPlayer | { gap: true }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** YYYY-MM-DD in America/Toronto. */
export function torontoDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  // Noon UTC stays on the same Toronto calendar day while we step.
  return torontoDateKey(new Date(Date.UTC(y, m - 1, d, 16) + days * 86_400_000))
}

/** Monday of the Toronto week that contains `now`, as YYYY-MM-DD. */
export function torontoWeekStart(now: Date = new Date()): string {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short' }).format(now)
  const idx = WEEKDAYS.indexOf(wd as (typeof WEEKDAYS)[number])
  const back = idx <= 0 ? 6 : idx - 1
  return addDays(torontoDateKey(now), -back)
}

function dayOf(row: PublicScore): string {
  if (row.mode === 'daily' && row.daily_date && /^\d{4}-\d{2}-\d{2}$/.test(row.daily_date)) return row.daily_date
  const at = new Date(row.created_at)
  if (Number.isNaN(at.getTime())) return ''
  return torontoDateKey(at)
}

function inTab(row: PublicScore, tab: BoardTab, now: Date): boolean {
  if (!row.name || !row.name.trim()) return false
  if (row.mode === 'practice') return false
  if (tab === 'all') return true
  const day = dayOf(row)
  if (!day) return false
  if (tab === 'today') return row.mode === 'daily' && day === torontoDateKey(now)
  const start = torontoWeekStart(now)
  const end = addDays(start, 6)
  return day >= start && day <= end
}

function better(a: { score: number; timeSeconds: number }, b: { score: number; timeSeconds: number }): boolean {
  if (a.score !== b.score) return a.score > b.score
  return a.timeSeconds < b.timeSeconds
}

/**
 * One row per public name. Highest score wins. The same score goes to the faster time.
 * Identical score and time share a rank.
 */
export function rankScores(rows: PublicScore[], tab: BoardTab, now: Date = new Date()): RankedPlayer[] {
  const best = new Map<string, { name: string; score: number; timeSeconds: number; mode: string }>()
  for (const row of rows) {
    if (!inTab(row, tab, now)) continue
    const name = row.name.trim()
    const next = {
      name,
      score: Number(row.score) || 0,
      timeSeconds: Math.max(0, Number(row.time_seconds) || 0),
      mode: row.mode,
    }
    const prev = best.get(name.toLowerCase())
    if (!prev || better(next, prev)) best.set(name.toLowerCase(), next)
  }
  const list = [...best.values()].sort(
    (a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds || a.name.localeCompare(b.name),
  )
  let rank = 0
  return list.map((row, i) => {
    const prev = list[i - 1]
    if (!prev || prev.score !== row.score || prev.timeSeconds !== row.timeSeconds) rank = i + 1
    return { rank, ...row }
  })
}

/**
 * Top 10, plus the signed-in player and the two names just above and below them
 * when that player is outside the top 10.
 */
export function sliceBoard(ranked: RankedPlayer[], youName: string, topN = 10): { lines: BoardLine[]; you: RankedPlayer | null } {
  const mine = youName.trim().toLowerCase()
  const you = mine ? ranked.find((r) => r.name.trim().toLowerCase() === mine) ?? null : null
  const lines: BoardLine[] = ranked.slice(0, topN)
  if (!you) return { lines, you: null }
  const idx = ranked.indexOf(you)
  if (idx >= topN) {
    const from = Math.max(topN, idx - 2)
    const to = Math.min(ranked.length, idx + 3)
    if (from > topN) lines.push({ gap: true })
    for (let i = from; i < to; i++) lines.push(ranked[i])
  }
  return { lines, you }
}

export function formatBoardTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds) || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const BOARD_TABS: { id: BoardTab; label: string; hint: string }[] = [
  { id: 'today', label: 'Today', hint: "Today's Daily. Best score. A tie goes to the faster time." },
  { id: 'week', label: 'This week', hint: 'Best score since Monday, Toronto time. A tie goes to the faster time.' },
  { id: 'all', label: 'All-time', hint: 'Best score ever. A tie goes to the faster time.' },
]
