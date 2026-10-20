/**
 * Gentle Unseen reminders. Text only. One per Home visit, never during a board.
 * Tony reviews the wording in REMINDER_LINES.
 */

export type ReminderId = 'streak' | 'daily' | 'pets' | 'remix' | 'coins' | 'signin'

export const REMINDER_LINES: Record<ReminderId, string> = {
  pets: "Your buddy's looking a bit peaky. Go look in on the Stable. They might need a treat.",
  signin: "You keep winning and then leaving it on this phone. Sign in, and the scores come with you. No password. I'm not carrying them.",
  coins: "That coin pile is getting smug. Spend some. The Stable sells treats and buddies. Rewards will take the rest.",
  daily: "Today's Daily is still sitting there. I checked. It hasn't done itself.",
  remix: "New Remix boards. Every three days, like clockwork. Go on, before I solve them out of boredom.",
  streak: "That streak of yours is hanging by a thread. One Daily today and it lives. I'm not saying I'm worried. I'm saying the fire is.",
}

/** Same sign-in reminder, for a computer. Phones and tablets keep REMINDER_LINES.signin. */
export const COMPUTER_SIGNIN_LINE =
  "You keep winning and then leaving it on this computer. Sign in, and the scores come with you. No password. I'm not carrying them."

/** Words the player sees. Phone wording unless this device is a computer. */
export function reminderText(id: ReminderId, computer: boolean): string {
  if (id === 'signin' && computer) return COMPUTER_SIGNIN_LINE
  return REMINDER_LINES[id]
}

/** Sign-in stops for good after this many dismissals. */
export const SIGNIN_DISMISS_CAP = 2
/** Sign-in is shown at most this many times in one browser session. */
export const SIGNIN_SESSION_CAP = 2

const HOUR = 3_600_000
/** Pets and coins can come back the next day, not every Home visit. */
const SLOW_COOLDOWN = 20 * HOUR

export interface ReminderMemory {
  shownAt: Partial<Record<ReminderId, number>>
  /** Toronto date (YYYY-MM-DD) a daily or streak reminder was last shown. */
  shownOn: Partial<Record<ReminderId, string>>
  dismissals: Partial<Record<ReminderId, number>>
  /** Remix set we already know about. Null until the first Home visit records it. */
  remixSeen: number | null
}

export interface ReminderFacts {
  now: number
  today: string
  /** Supabase has settled, so we know whether they are signed in. */
  cloudKnown: boolean
  signedIn: boolean
  /** They just finished a game and landed on Home. */
  afterGame: boolean
  sessionSignIns: number
  /** An owned buddy's mood has fallen to hungry. */
  hungryPet: boolean
  /** They can buy a treat, a buddy, or a badge upgrade right now. */
  canSpend: boolean
  dailyPlayed: boolean
  streakAtRisk: boolean
  remixSet: number
}

export interface ReminderChoice {
  pick: { id: ReminderId; text: string } | null
  /** First visit: remember the live set and stay quiet about it. */
  rememberRemixSet: number | null
}

export function emptyReminderMemory(): ReminderMemory {
  return { shownAt: {}, shownOn: {}, dismissals: {}, remixSeen: null }
}

function cooled(memory: ReminderMemory, id: ReminderId, now: number, ms: number): boolean {
  const at = memory.shownAt[id]
  return at == null || now - at >= ms
}

function notShownToday(memory: ReminderMemory, id: ReminderId, today: string): boolean {
  return memory.shownOn[id] !== today
}

/**
 * At most one reminder. Time-sensitive ones go first.
 * A streak at risk already means the Daily is waiting, so the Daily line waits for a day with no streak.
 */
export function pickReminder(facts: ReminderFacts, memory: ReminderMemory): ReminderChoice {
  const rememberRemixSet = memory.remixSeen == null ? facts.remixSet : null
  const candidates: ReminderId[] = []
  if (facts.streakAtRisk && notShownToday(memory, 'streak', facts.today)) candidates.push('streak')
  if (!facts.dailyPlayed && !facts.streakAtRisk && notShownToday(memory, 'daily', facts.today)) candidates.push('daily')
  if (facts.hungryPet && cooled(memory, 'pets', facts.now, SLOW_COOLDOWN)) candidates.push('pets')
  if (memory.remixSeen != null && memory.remixSeen !== facts.remixSet) candidates.push('remix')
  if (facts.canSpend && cooled(memory, 'coins', facts.now, SLOW_COOLDOWN)) candidates.push('coins')
  const signInDismissals = memory.dismissals.signin ?? 0
  if (
    facts.afterGame &&
    facts.cloudKnown &&
    !facts.signedIn &&
    facts.sessionSignIns < SIGNIN_SESSION_CAP &&
    signInDismissals < SIGNIN_DISMISS_CAP
  ) {
    candidates.push('signin')
  }
  const id = candidates[0]
  return { pick: id ? { id, text: REMINDER_LINES[id] } : null, rememberRemixSet }
}

export function markShown(memory: ReminderMemory, id: ReminderId, now: number, today: string, remixSet: number): ReminderMemory {
  return {
    ...memory,
    shownAt: { ...memory.shownAt, [id]: now },
    shownOn: { ...memory.shownOn, [id]: today },
    remixSeen: id === 'remix' ? remixSet : memory.remixSeen,
  }
}

export function markDismissed(memory: ReminderMemory, id: ReminderId, now: number, today: string, remixSet: number): ReminderMemory {
  const shown = markShown(memory, id, now, today, remixSet)
  return { ...shown, dismissals: { ...shown.dismissals, [id]: (shown.dismissals[id] ?? 0) + 1 } }
}

const STORE_KEY = 'roman.reminders.v1'
const SESSION_KEY = 'roman.reminders.session.v1'

export function loadReminderMemory(): ReminderMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as Partial<ReminderMemory> | null
    if (!raw || typeof raw !== 'object') return emptyReminderMemory()
    return {
      shownAt: raw.shownAt && typeof raw.shownAt === 'object' ? raw.shownAt : {},
      shownOn: raw.shownOn && typeof raw.shownOn === 'object' ? raw.shownOn : {},
      dismissals: raw.dismissals && typeof raw.dismissals === 'object' ? raw.dismissals : {},
      remixSeen: typeof raw.remixSeen === 'number' ? raw.remixSeen : null,
    }
  } catch {
    return emptyReminderMemory()
  }
}

export function saveReminderMemory(memory: ReminderMemory): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(memory))
  } catch {
    /* private mode: the reminder can repeat next visit */
  }
}

export function loadSessionSignIns(): number {
  try {
    const n = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '0')
    return typeof n === 'number' && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function bumpSessionSignIns(): number {
  const n = loadSessionSignIns() + 1
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(n))
  } catch {
    /* still counts for this call */
  }
  return n
}
