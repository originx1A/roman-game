/*
 * Voice tips (build 9.28-b): short, funny, slightly naggy teaching lines that fire on context
 * triggers and retire once the player shows they get the feature.
 *
 * Lines go through the three existing voices (deep Roman, the coach, the old-timer) and the same
 * one-at-a-time voice channel as every other line. Each tip keeps a saved shuffle bag per voice
 * (via comments.ts), and the voices take turns. A line only plays if it has a recorded clip: new
 * lines are written here and in /workspace/roman-audit/voice-tips-draft.md, and stay silent until
 * Tony approves them and they are recorded (add the id to VOICE_LINES in voiceLines.ts).
 */

export type TipId = 'stall' | 'undo-spam' | 'three-star' | 'stuck' | 'first-trial' | 'first-daily'
export type TipVoice = 'roman' | 'coach' | 'old'
/** Why a win missed 3 stars (three-star tip); 'any' lines fit every reason. */
export type TipReason = 'time' | 'undo' | 'score' | 'any'

export interface TipLine {
  /** Clip id. Existing recorded ids are reused as-is; new ones start with `tip_`. */
  id: string
  voice: TipVoice
  text: string
  reason?: TipReason
}

const R = (id: string, text: string, reason?: TipReason): TipLine => ({ id, voice: 'roman', text: `Roman says: ${text}`, reason })
const C = (id: string, text: string, reason?: TipReason): TipLine => ({ id, voice: 'coach', text, reason })
const O = (id: string, text: string, reason?: TipReason): TipLine => ({ id, voice: 'old', text: `Old-timer: ${text}`, reason })

/** NEW lines (not recorded yet — silent until approved + recorded). */
export const NEW_TIP_LINES: Record<TipId, TipLine[]> = {
  stall: [
    R('tip_stall_roman_clock', 'the clock is still running. Roman checked. Twice.'),
    R('tip_stall_roman_combo', 'every second you think, your combo takes a nap.'),
    R('tip_stall_roman_beg', 'tap something. Anything. Roman is begging politely.'),
    C('tip_stall_coach_combo', 'Quick moves keep your combo alive. Even a little X counts!'),
    C('tip_stall_coach_marks', "Stuck? Mark the squares that can't have a buddy. It opens things up."),
    C('tip_stall_coach_fewest', 'Try the row or region with the fewest open squares first.'),
    O('tip_stall_old_combo', "Your combo died of old age. And I'd know about old age."),
    O('tip_stall_old_timer', "The timer doesn't stop for thinking, kiddo. Neither do I. Well, I do. Often."),
    O('tip_stall_old_free', "Put an X somewhere. X's are free. Unlike my patience."),
  ],
  'undo-spam': [
    R('tip_undo_roman_count', 'every undo costs twenty-five points. Roman is counting. Roman is always counting.'),
    R('tip_undo_roman_sock', 'undo, undo, undo. Your score is shrinking like a wool sock.'),
    R('tip_undo_roman_rules', "three undos? No three stars for you. Roman's rules."),
    C('tip_undo_coach_cost', 'Heads up: each undo costs 25 points and resets your combo.'),
    C('tip_undo_coach_stars', 'Want three stars? Finish without any undos. Take a breath before you tap.'),
    C('tip_undo_coach_marks', "Try marking X's first. They're safer than guessing a buddy."),
    O('tip_undo_old_prices', "Twenty-five points a pop. At these prices I'd think before I tapped."),
    O('tip_undo_old_rent', "Undo again and I'm charging you rent on that button."),
    O('tip_undo_old_crying', 'Back in my day we had one undo. It was called crying.'),
  ],
  'three-star': [
    R('tip_star_roman_time', 'two stars? Cute. Beat the target time and bring me three.', 'time'),
    C('tip_star_coach_time', 'So close to three stars! Beat the target time on the start screen.', 'time'),
    O('tip_star_old_time', 'You finished. So did the ice age. Faster next time for the third star.', 'time'),
    R('tip_star_roman_recipe', "no undos, fast time, big score. That's the three-star recipe. Roman wrote it.", 'undo'),
    C('tip_star_coach_undo', 'Three stars means zero undos. Plan your moves, then tap.', 'undo'),
    O('tip_star_old_barber', "The third star doesn't like undos. Neither does my barber.", 'undo'),
    R('tip_star_roman_combo', "faster moves build a combo. Combo builds score. Score builds Roman's respect.", 'score'),
    C('tip_star_coach_score', 'For three stars you need a high score too. Keep the combo going with quick, clean moves.', 'score'),
    O('tip_star_old_coffee', "Score's too low for the third star. Try moving like you've had coffee.", 'score'),
    R('tip_star_roman_trial', "three stars unlocks Roman's Trial. Roman's waiting. Roman is always waiting.", 'any'),
    C('tip_star_coach_card', 'Tap the level card to see what you need for three stars.', 'any'),
    O('tip_star_old_motel', 'Two stars. Like a motel. Go get the third.', 'any'),
  ],
  stuck: [
    R('tip_stuck_roman_shiny', "the hint button is right there. It's shiny. Press it."),
    R('tip_stuck_roman_1987', 'even Roman uses a hint sometimes. Once. In 1987.'),
    R('tip_stuck_roman_row', 'stuck? Look for a row with only one spot left.'),
    C('tip_stuck_coach_hint', 'Feeling stuck? The Hint button lights up a safe square.'),
    C('tip_stuck_coach_region', 'Look for a region that fits in one row. Its buddy has to go there.'),
    C('tip_stuck_coach_learn', "Try a hint. It's not cheating, it's learning!"),
    O('tip_stuck_old_complaint', "You've been staring so long the squares filed a complaint. Try the hint."),
    O('tip_stuck_old_knees', "Hint button. Bottom of the screen. I'd press it for you, but my knees."),
    O('tip_stuck_old_pride', "Pride's nice. Hints are faster."),
  ],
  'first-trial': [
    R('tip_trial_roman_welcome', "welcome to Roman's Trial. Two hearts, no undo, and a clock. Roman is not sorry."),
    R('tip_trial_roman_coins', 'beat the clock and you get double coins. Lose, and Roman laughs. Gently.'),
    C('tip_trial_coach_rules', "This is the Trial: race the clock, two hearts, no undo. You've got this!"),
    C('tip_trial_coach_marks', "Tip: X's are free, and they never cost a heart. Use them."),
    O('tip_trial_old_life', 'No undo button in here. Welcome to how life works.'),
    O('tip_trial_old_doctor', "Two hearts and a timer. I've had doctor's appointments like this."),
  ],
  'first-daily': [
    R('tip_daily_roman_first', "it's the Daily Challenge. Everybody gets this board today. Only your first try counts."),
    R('tip_daily_roman_streak', "win today, win tomorrow, and your streak grows. Like Roman's ego."),
    C('tip_daily_coach_careful', 'Daily Challenge! Only one try counts, so take your time.'),
    C('tip_daily_coach_streak', 'Come back every day to build your streak and earn more coins.'),
    O('tip_daily_old_parking', 'One shot, kiddo. No do-overs. Like parking at the grocery store.'),
    O('tip_daily_old_glasses', "Daily puzzle. I do one every day too. It's called finding my glasses."),
  ],
}

/** EXISTING recorded lines that already fit a tip (used in 9.28-b; they stay in their old bags too). */
export const RECORDED_TIP_LINES: Record<TipId, { id: string; voice: TipVoice; reason?: TipReason }[]> = {
  stall: [
    { id: 'coach_lose_breathe', voice: 'coach' },
    { id: 'old_idle_glacier', voice: 'old' },
    { id: 'old_idle_mail', voice: 'old' },
  ],
  'undo-spam': [
    { id: 'old_undo_regret', voice: 'old' },
    { id: 'old_undo_eraser', voice: 'old' },
  ],
  'three-star': [
    { id: 'roman_warmup', voice: 'roman', reason: 'any' },
    { id: 'roman_practice', voice: 'roman', reason: 'any' },
    { id: 'old_win_twothree', voice: 'old', reason: 'any' },
    { id: 'old_win_yesterday', voice: 'old', reason: 'time' },
  ],
  stuck: [{ id: 'roman_nudge', voice: 'roman' }],
  'first-trial': [],
  'first-daily': [],
}

export interface TipRule {
  /** Times the player must show they get it before the tip retires. */
  masteryNeeded: number
  /** Retire anyway after this many plays (nagging has limits). */
  maxShows: number
  /** Minimum gap between two plays of this tip. */
  cooldownMs: number
}

export const TIP_RULES: Record<TipId, TipRule> = {
  stall: { masteryNeeded: 3, maxShows: 8, cooldownMs: 120_000 },
  'undo-spam': { masteryNeeded: 3, maxShows: 8, cooldownMs: 90_000 },
  'three-star': { masteryNeeded: 2, maxShows: 10, cooldownMs: 60_000 },
  stuck: { masteryNeeded: 3, maxShows: 8, cooldownMs: 90_000 },
  'first-trial': { masteryNeeded: 1, maxShows: 2, cooldownMs: 0 },
  'first-daily': { masteryNeeded: 1, maxShows: 2, cooldownMs: 0 },
}

/** Trigger thresholds used by the app. */
export const TIP_TRIGGERS = {
  /** No move for this long → stall tip. */
  stallMs: 25_000,
  /** Undos in one board → undo tip. */
  undoCount: 3,
  /** No new correct buddy for this long (with free space left) → stuck tip. */
  stuckMs: 50_000,
  /** Or this many wrong buddies within stuckWrongWindowMs. */
  stuckWrong: 2,
  stuckWrongWindowMs: 30_000,
  /** The voice channel must have been quiet this long before a tip speaks. */
  quietMs: 6_000,
  /** Gap between any two tips. */
  globalGapMs: 25_000,
  /** Tips per board, at most. */
  perBoard: 2,
  /** A stall counts as "got it" when the longest pause in a finished board stays under this. */
  steadyGapMs: 20_000,
} as const

export interface TipState {
  v: 1
  shows: Partial<Record<TipId, number>>
  mastery: Partial<Record<TipId, number>>
  lastAt: Partial<Record<TipId, number>>
  retired: TipId[]
}

export const TIPS_KEY = 'roman.tips.v1'
export const TIP_IDS = Object.keys(TIP_RULES) as TipId[]

export function emptyTips(): TipState {
  return { v: 1, shows: {}, mastery: {}, lastAt: {}, retired: [] }
}

export function sanitizeTips(raw: unknown): TipState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TipState>
  const nums = (o: unknown) => {
    const out: Partial<Record<TipId, number>> = {}
    if (o && typeof o === 'object') {
      for (const id of TIP_IDS) {
        const v = (o as Record<string, unknown>)[id]
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[id] = v
      }
    }
    return out
  }
  return {
    v: 1,
    shows: nums(r.shows),
    mastery: nums(r.mastery),
    lastAt: nums(r.lastAt),
    retired: Array.isArray(r.retired) ? TIP_IDS.filter((id) => r.retired!.includes(id)) : [],
  }
}

export function isRetired(s: TipState, id: TipId): boolean {
  return s.retired.includes(id)
}

/** Player showed they get it: count toward retiring the tip. */
export function noteMastery(s: TipState, id: TipId, by = 1): TipState {
  if (isRetired(s, id)) return s
  const m = (s.mastery[id] ?? 0) + by
  const retire = m >= TIP_RULES[id].masteryNeeded
  return { ...s, mastery: { ...s.mastery, [id]: m }, retired: retire ? [...s.retired, id] : s.retired }
}

export interface TipGate {
  now: number
  enabled: boolean
  /** Tips already played this board. */
  boardCount: number
  /** Tip ids already played this board (each tip at most once per board). */
  boardTips: readonly TipId[]
  /** When the last tip (any) played. */
  lastTipAt: number
}

/** Can this tip play right now? (Enabled, not retired, cooldowns and per-board caps.) */
export function canTip(s: TipState, id: TipId, g: TipGate): boolean {
  if (!g.enabled || isRetired(s, id)) return false
  if (g.boardCount >= TIP_TRIGGERS.perBoard || g.boardTips.includes(id)) return false
  if (g.now - g.lastTipAt < TIP_TRIGGERS.globalGapMs) return false
  const last = s.lastAt[id]
  if (last != null && g.now - last < TIP_RULES[id].cooldownMs) return false
  return true
}

/** Record a play; retires the tip once it hits maxShows. */
export function noteShown(s: TipState, id: TipId, now: number): TipState {
  const n = (s.shows[id] ?? 0) + 1
  const retire = n >= TIP_RULES[id].maxShows && !isRetired(s, id)
  return {
    ...s,
    shows: { ...s.shows, [id]: n },
    lastAt: { ...s.lastAt, [id]: now },
    retired: retire ? [...s.retired, id] : s.retired,
  }
}

/**
 * Lines that can actually play now for a tip (and reason): recorded clips only.
 * `hasClip` says whether a clip id has a recorded file.
 */
export function playableTipLines(
  id: TipId,
  reason: TipReason | undefined,
  hasClip: (clip: string) => boolean,
  textOf: (clip: string) => string | undefined,
): TipLine[] {
  const fits = (r?: TipReason) => !reason || reason === 'any' || !r || r === 'any' || r === reason
  const recorded: TipLine[] = RECORDED_TIP_LINES[id]
    .filter((l) => fits(l.reason) && hasClip(l.id))
    .map((l) => ({ ...l, text: textOf(l.id) ?? '' }))
  const fresh = NEW_TIP_LINES[id].filter((l) => fits(l.reason) && hasClip(l.id))
  return [...recorded, ...fresh]
}

/** Which of the three-star rules the run missed first (for the three-star tip). */
export function missedStarReason(o: { withinTime: boolean; undos: number; scoreOk: boolean }): TipReason {
  if (!o.withinTime) return 'time'
  if (o.undos > 0) return 'undo'
  if (!o.scoreOk) return 'score'
  return 'any'
}
