/** America/Toronto wall clock. Netlify cron is UTC; the daily job uses this to act once. */

export interface TorontoParts {
  year: string
  month: string
  day: string
  hour: number
  minute: number
  dateKey: string
}

const TZ = 'America/Toronto'

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

export function torontoParts(now: Date): TorontoParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const year = part(parts, 'year')
  const month = part(parts, 'month')
  const day = part(parts, 'day')
  return {
    year,
    month,
    day,
    hour: Number(part(parts, 'hour')),
    minute: Number(part(parts, 'minute')),
    dateKey: `${year}-${month}-${day}`,
  }
}

export function torontoDateKey(now: Date): string {
  return torontoParts(now).dateKey
}

/**
 * Scheduled at 13:20 and 14:20 UTC.
 * EDT (UTC-4): 13:20 UTC is 09:20, 14:20 UTC is 10:20.
 * EST (UTC-5): 13:20 UTC is 08:20, 14:20 UTC is 09:20.
 * The 09:xx hour happens for exactly one of those crons, including the March
 * and November transition days (the clock change is at 02:00, not 09:20).
 * Minute >= 20 so a late invoke still counts, and the other hour never does.
 */
export function torontoShouldSend(now: Date): boolean {
  const p = torontoParts(now)
  return p.hour === 9 && p.minute >= 20
}

/** 09:07 America/Toronto on a YYYY-MM-DD edition date. The site stores a date only. */
export function editionInstant(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return new Date(NaN)
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  let guess = Date.UTC(y, m - 1, d, 13, 7, 0)
  for (let i = 0; i < 4; i++) {
    const p = torontoParts(new Date(guess))
    const have = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), p.hour, p.minute)
    const want = Date.UTC(y, m - 1, d, 9, 7)
    const delta = want - have
    if (delta === 0) break
    guess += delta
  }
  return new Date(guess)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** RFC 822 / RSS pubDate in UTC. */
export function rfc822Utc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${WEEKDAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`
}
