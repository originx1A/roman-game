import { createShuffleBag } from './lineBag'
import { voiceLineText } from './sound'

export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'

export type VoiceClipId =
  | 'nice'
  | 'solid'
  | 'that_works'
  | 'good_call'
  | 'clean'
  | 'too_close'
  | 'row_taken'
  | 'region_full'
  | 'nope'
  | 'nudge'
  | 'cleared'
  | 'board_complete'
  | 'out_of_hearts'
  | 'tough_board'
  | 'prize_time'
  | 'new_badge'
  | 'roman_awesome'
  | 'roman_legend'
  | 'roman_highfive'
  | 'roman_win'
  | 'roman_brain'
  | 'roman_boss'
  | 'roman_sparkle'
  | 'roman_proud'
  | 'roman_clutch'
  | 'roman_smooth'
  | 'roman_cheer'
  | 'roman_cook'
  | 'roman_critter'
  | 'roman_stash'
  | 'roman_prize'
  | 'roman_hint'
  | 'roman_nudge'
  | 'roman_close'
  | 'roman_oops'
  | 'roman_bonk'
  | 'roman_nope'
  | 'roman_silly'
  | 'roman_brainfart'
  | 'roman_retry'
  | 'roman_hearts'
  | 'roman_colorblind'
  | 'roman_samecolor'
  | 'roman_rowmate'
  | 'roman_coltaken'
  | 'roman_cuddle'
  | 'roman_highhopes'
  | 'roman_cantwin'
  | 'roman_trying'
  | 'roman_stillbetter'
  | 'roman_skillissue'
  | 'roman_warmup'
  | 'roman_almost'
  | 'roman_sleeping'
  | 'roman_practice'
  | 'roman_myboard'
  | 'roman_sandwich'
  | 'roman_itchy'
  | 'roman_plotwin'
  | 'roman_okayfine'
  | 'roman_cocky'
  | 'roman_sock'
  | 'roman_taco'
  | 'roman_juice'
  | 'roman_dino'
  | 'roman_nugget'
  | 'roman_shoe'
  | 'roman_potato'
  | 'roman_sneeze'
  | 'roman_fridge'
  | 'roman_nap'
  | 'roman_spaghetti'
  | 'roman_raccoon'
  | 'roman_shrug'
  | 'roman_dance'
  | 'roman_forgot'
  | 'roman_toes'
  | 'roman_eyeballs'
  | 'roman_victoryburp'
  | 'roman_highfiveself'
  | 'roman_broccoli'
  | 'roman_pickle'
  | 'roman_banana'
  | 'roman_cheese'
  | 'roman_pants'
  | 'roman_booger'
  | 'roman_lizard'
  | 'roman_ghost'
  | 'roman_unicorn'
  | 'roman_worm'
  | 'roman_trumpet'
  | 'roman_bubblegum'
  | 'roman_helicopter'
  | 'roman_underpants'
  | 'roman_moonwalk'
  | 'roman_idle_hello'
  | 'roman_idle_century'
  | 'roman_idle_sandwich'
  | 'roman_idle_blink'
  | 'roman_idle_loading'
  | 'roman_idle_admire'
  | 'roman_idle_sphinx'
  | 'roman_idle_snore'
  | 'roman_wrong_bold'
  | 'roman_wrong_complaint'
  | 'roman_wrong_oof'
  | 'roman_wrong_politely'
  | 'roman_wrong_grandma'
  | 'roman_wrong_wifi'
  | 'roman_wrong_drama'
  | 'roman_wrong_trophy'
  | 'roman_lose_nap'
  | 'roman_lose_fought'
  | 'roman_lose_snacks'
  | 'roman_lose_round'
  | 'roman_hint_psst'
  | 'roman_hint_secret'
  | 'roman_hint_clue'
  | 'roman_badge_shiny'
  | 'roman_badge_fridge'
  | 'roman_badge_wear'
  | 'roman_badge_impressed'
  | 'roman_spin_spoken'
  | 'roman_spin_ooh'
  | 'roman_spin_lucky'
  | 'roman_stash_party'
  | 'roman_stash_jazz'
  | 'old_wrong_stick'
  | 'old_wrong_pigeon'
  | 'old_wrong_love'
  | 'old_wrong_choice'
  | 'old_wrong_money'
  | 'old_wrong_tea'
  | 'old_wrong_chaos'
  | 'old_wrong_knees'
  | 'old_wrong_personal'
  | 'old_wrong_close'
  | 'old_wrong_again'
  | 'old_wrong_refund'
  | 'old_wrong_nickel'
  | 'old_wrong_teacher'
  | 'old_wrong_loudly'
  | 'old_idle_twenty'
  | 'old_idle_crossword'
  | 'old_idle_kettle'
  | 'old_idle_nap'
  | 'old_idle_glacier'
  | 'old_idle_younger'
  | 'old_idle_gossip'
  | 'old_hint_stare'
  | 'old_hint_tell'
  | 'old_hint_wheels'
  | 'old_hint_push'
  | 'old_hint_smart'
  | 'old_undo_hokey'
  | 'old_undo_dizzy'
  | 'old_undo_rocking'
  | 'old_undo_vacation'
  | 'old_lose_tape'
  | 'old_lose_goldfish'
  | 'old_lose_sideways'
  | 'old_lose_popcorn'
  | 'old_win_eventually'
  | 'old_win_ugly'
  | 'old_win_paint'
  | 'old_win_yesterday'
  | 'old_win_gaveup'
  | 'old_rescue_modern'
  | 'old_rescue_refund'
  | 'old_rescue_coins'
  | 'old_rescue_cat'
  | 'spark_1'
  | 'spark_2'
  | 'spark_3'
  | 'spark_4'
  | 'spark_unlocked'
  | 'spark_have_1'
  | 'spark_have_2'
  | 'spark_have_3'
  | 'spark_have_4'

export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'

export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'

export interface Banter {
  text: string
  mood: CommentMood
  voiceMood: VoiceMood
  speak: boolean
  clip?: VoiceClipId
  /** Other clips in the same pool if the chosen file fails to play. */
  alts?: readonly VoiceClipId[]
  giggle?: boolean
  silent?: boolean
  /** Voice channel priority: a line only interrupts a lower-priority line (see VOICE_PRIORITY). */
  priority?: number
  /** If the channel is busy with an equal/higher line, wait up to this long for it instead of skipping. */
  waitMs?: number
}

/**
 * Voice channel priorities. A new line interrupts only a lower-priority one; equal/lower is skipped
 * (or waits, for lines with waitMs). Win/lose beat everything, then a hint the player asked for.
 */
export const VOICE_PRIORITY = { idle: 1, chatter: 2, wrong: 3, hint: 4, prize: 4, win: 5, lose: 5 } as const

// All roman_* clips are the deeper Roman voice (en-US-BrianNeural, see scripts/voice-manifest.json).
// old_* clips are the old-timer heckler (en-AU-WilliamMultilingualNeural + rasp). Coach clips are en-US-JennyNeural.

/** Win cheers (Roman). Every id has a clip under public/voices. */
export const ROMAN_CHEER_CLIPS = [
  'roman_awesome',
  'roman_legend',
  'roman_highfive',
  'roman_win',
  'roman_brain',
  'roman_boss',
  'roman_sparkle',
  'roman_proud',
  'roman_clutch',
  'roman_smooth',
  'roman_cheer',
  'roman_cook',
  'roman_itchy',
  'roman_plotwin',
  'roman_okayfine',
  'roman_cocky',
  'roman_sandwich',
  'roman_sock',
  'roman_taco',
  'roman_juice',
  'roman_dino',
  'roman_nugget',
  'roman_shoe',
  'roman_potato',
  'roman_sneeze',
  'roman_fridge',
  'roman_nap',
  'roman_spaghetti',
  'roman_raccoon',
  'roman_shrug',
  'roman_dance',
  'roman_forgot',
  'roman_toes',
  'roman_eyeballs',
  'roman_victoryburp',
  'roman_highfiveself',
  'roman_broccoli',
  'roman_pickle',
  'roman_banana',
  'roman_cheese',
  'roman_pants',
  'roman_booger',
  'roman_lizard',
  'roman_ghost',
  'roman_unicorn',
  'roman_worm',
  'roman_trumpet',
  'roman_bubblegum',
  'roman_helicopter',
  'roman_underpants',
  'roman_moonwalk',
] as const satisfies readonly VoiceClipId[]

/** Wrong-move putdowns (Roman). */
export const ROMAN_WRONG_CLIPS = [
  'roman_close',
  'roman_oops',
  'roman_bonk',
  'roman_nope',
  'roman_silly',
  'roman_brainfart',
  'roman_retry',
  'roman_colorblind',
  'roman_samecolor',
  'roman_rowmate',
  'roman_coltaken',
  'roman_cuddle',
  'roman_highhopes',
  'roman_cantwin',
  'roman_trying',
  'roman_stillbetter',
  'roman_skillissue',
  'roman_warmup',
  'roman_almost',
  'roman_sleeping',
  'roman_practice',
  'roman_myboard',
  'roman_wrong_bold',
  'roman_wrong_complaint',
  'roman_wrong_oof',
  'roman_wrong_politely',
  'roman_wrong_grandma',
  'roman_wrong_wifi',
  'roman_wrong_drama',
  'roman_wrong_trophy',
] as const satisfies readonly VoiceClipId[]

/** Idle pokes while the player waits (Roman). */
export const ROMAN_IDLE_CLIPS = [
  'roman_idle_hello',
  'roman_idle_century',
  'roman_idle_sandwich',
  'roman_idle_blink',
  'roman_idle_loading',
  'roman_idle_admire',
  'roman_idle_sphinx',
  'roman_idle_snore',
] as const satisfies readonly VoiceClipId[]

/** Out of hearts (Roman). */
export const ROMAN_LOSE_CLIPS = [
  'roman_hearts',
  'roman_lose_nap',
  'roman_lose_fought',
  'roman_lose_snacks',
  'roman_lose_round',
] as const satisfies readonly VoiceClipId[]

/** Hint / rescue (Roman). */
export const ROMAN_HINT_CLIPS = [
  'roman_hint',
  'roman_nudge',
  'roman_hint_psst',
  'roman_hint_secret',
  'roman_hint_clue',
] as const satisfies readonly VoiceClipId[]

/** Badge unlocked (Roman). */
export const ROMAN_BADGE_CLIPS = [
  'roman_badge_shiny',
  'roman_badge_fridge',
  'roman_badge_wear',
  'roman_badge_impressed',
] as const satisfies readonly VoiceClipId[]

/** Prize wheel result (Roman). */
export const ROMAN_PRIZE_CLIPS = [
  'roman_prize',
  'roman_spin_spoken',
  'roman_spin_ooh',
  'roman_spin_lucky',
] as const satisfies readonly VoiceClipId[]

/** Fifth spark critter — stash complete (Roman). */
export const ROMAN_STASH_CLIPS = [
  'roman_stash',
  'roman_critter',
  'roman_stash_party',
  'roman_stash_jazz',
] as const satisfies readonly VoiceClipId[]

/** Old-timer heckles for a wrong move. */
export const OLDTIMER_WRONG_CLIPS = [
  'old_wrong_stick',
  'old_wrong_pigeon',
  'old_wrong_love',
  'old_wrong_choice',
  'old_wrong_money',
  'old_wrong_tea',
  'old_wrong_chaos',
  'old_wrong_knees',
  'old_wrong_personal',
  'old_wrong_close',
  'old_wrong_again',
  'old_wrong_refund',
  'old_wrong_nickel',
  'old_wrong_teacher',
  'old_wrong_loudly',
] as const satisfies readonly VoiceClipId[]

/** Old-timer grumbles when the player is slow. */
export const OLDTIMER_IDLE_CLIPS = [
  'old_idle_twenty',
  'old_idle_crossword',
  'old_idle_kettle',
  'old_idle_nap',
  'old_idle_glacier',
  'old_idle_younger',
  'old_idle_gossip',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on hints. */
export const OLDTIMER_HINT_CLIPS = [
  'old_hint_stare',
  'old_hint_tell',
  'old_hint_wheels',
  'old_hint_push',
  'old_hint_smart',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on undo/redo spam. */
export const OLDTIMER_UNDO_CLIPS = [
  'old_undo_hokey',
  'old_undo_dizzy',
  'old_undo_rocking',
  'old_undo_vacation',
] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player runs out of hearts. */
export const OLDTIMER_LOSE_CLIPS = [
  'old_lose_tape',
  'old_lose_goldfish',
  'old_lose_sideways',
  'old_lose_popcorn',
] as const satisfies readonly VoiceClipId[]

/** Old-timer backhanded compliments after a slow or sloppy win. */
export const OLDTIMER_WIN_CLIPS = [
  'old_win_eventually',
  'old_win_ugly',
  'old_win_paint',
  'old_win_yesterday',
  'old_win_gaveup',
] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player buys a rescue. */
export const OLDTIMER_RESCUE_CLIPS = [
  'old_rescue_modern',
  'old_rescue_refund',
  'old_rescue_coins',
  'old_rescue_cat',
] as const satisfies readonly VoiceClipId[]

/**
 * The old-timer is an occasional heckler, not a narrator: he takes roughly a third of the
 * wrong-move / idle / hint / lose slots (instead of Roman or the coach, never on top of them)
 * and keeps a quiet gap between heckles. Each of his pools is its own never-repeat-last-3 bag.
 */
export const OLDTIMER_SHARE = 0.36
export const OLDTIMER_COOLDOWN_MS = 6500
let oldtimerLastAt = Number.NEGATIVE_INFINITY

function oldtimerTurn(share = OLDTIMER_SHARE): boolean {
  const now = Date.now()
  if (now - oldtimerLastAt < OLDTIMER_COOLDOWN_MS) return false
  if (Math.random() >= share) return false
  oldtimerLastAt = now
  return true
}

function bag(pool: readonly VoiceClipId[]) {
  const next = createShuffleBag(pool)
  return () => ({ clip: next(), pool })
}

const oldWrong = bag(OLDTIMER_WRONG_CLIPS)
const oldIdle = bag(OLDTIMER_IDLE_CLIPS)
const oldHint = bag(OLDTIMER_HINT_CLIPS)
const oldUndo = bag(OLDTIMER_UNDO_CLIPS)
const oldLose = bag(OLDTIMER_LOSE_CLIPS)
const oldWin = bag(OLDTIMER_WIN_CLIPS)
const oldRescue = bag(OLDTIMER_RESCUE_CLIPS)

/** Coach (female) lines for the moments she has always voiced */
const COACH_LOSE_CLIPS = ['out_of_hearts', 'tough_board'] as const satisfies readonly VoiceClipId[]
const COACH_HINT_CLIPS = ['nudge'] as const satisfies readonly VoiceClipId[]
const COACH_BADGE_CLIPS = ['new_badge'] as const satisfies readonly VoiceClipId[]
const COACH_PRIZE_CLIPS = ['prize_time'] as const satisfies readonly VoiceClipId[]
const COACH_STASH_CLIPS = ['spark_unlocked'] as const satisfies readonly VoiceClipId[]

const nextCheer = createShuffleBag(ROMAN_CHEER_CLIPS)
const nextWrong = createShuffleBag(ROMAN_WRONG_CLIPS)
const nextIdle = createShuffleBag(ROMAN_IDLE_CLIPS)

/**
 * Shared moments (lose, hint, badge, prize, stash): Roman and the coach take turns, one line per
 * event. Each speaker keeps its own shuffle bag, so Roman still never repeats one of his last 3.
 */
function takeTurns(roman: readonly VoiceClipId[], coach: readonly VoiceClipId[]) {
  const nextRoman = createShuffleBag(roman)
  const nextCoach = createShuffleBag(coach)
  let coachTurn = Math.random() < 0.5
  return (): { clip: VoiceClipId; pool: readonly VoiceClipId[] } => {
    const turnIsCoach = coachTurn
    coachTurn = !coachTurn
    return turnIsCoach ? { clip: nextCoach(), pool: coach } : { clip: nextRoman(), pool: roman }
  }
}

const nextLose = takeTurns(ROMAN_LOSE_CLIPS, COACH_LOSE_CLIPS)
const nextHint = takeTurns(ROMAN_HINT_CLIPS, COACH_HINT_CLIPS)
const nextBadge = takeTurns(ROMAN_BADGE_CLIPS, COACH_BADGE_CLIPS)
const nextPrize = takeTurns(ROMAN_PRIZE_CLIPS, COACH_PRIZE_CLIPS)
const nextStash = takeTurns(ROMAN_STASH_CLIPS, COACH_STASH_CLIPS)

function voiced(
  pick: { clip: VoiceClipId; pool: readonly VoiceClipId[] },
  mood: CommentMood,
  voiceMood: VoiceMood,
  priority: number,
  extra: Partial<Banter> = {},
): Banter {
  return {
    text: voiceLineText(pick.clip) ?? 'Roman says: okay, next!',
    mood,
    voiceMood,
    speak: true,
    clip: pick.clip,
    alts: pick.pool.filter((id) => id !== pick.clip),
    priority,
    ...extra,
  }
}

const roman = (clip: VoiceClipId, pool: readonly VoiceClipId[]) => ({ clip, pool })

export function banterFor(
  event:
    | 'place-good'
    | 'place-bad'
    | 'mark'
    | 'hint'
    | 'win'
    | 'lose'
    | 'prize'
    | 'achievement'
    | 'critter'
    | 'critter-stash'
    | 'idle'
    | 'rescue'
    | 'undo-spam'
    | 'win-heckle',
  _conflict?: ConflictKind,
): Banter {
  const silent: Banter = { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'idle') {
    if (oldtimerTurn()) return voiced(oldIdle(), 'bad', 'neutral', VOICE_PRIORITY.idle)
    return voiced(roman(nextIdle(), ROMAN_IDLE_CLIPS), 'bad', 'disappointed', VOICE_PRIORITY.idle)
  }
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  if (event === 'place-bad') {
    if (oldtimerTurn()) return voiced(oldWrong(), 'bad', 'neutral', VOICE_PRIORITY.wrong)
    return voiced(roman(nextWrong(), ROMAN_WRONG_CLIPS), 'bad', 'disappointed', VOICE_PRIORITY.wrong)
  }
  if (event === 'win') return voiced(roman(nextCheer(), ROMAN_CHEER_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  if (event === 'hint') {
    if (oldtimerTurn()) return voiced(oldHint(), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  if (event === 'rescue') {
    if (oldtimerTurn(0.5)) return voiced(oldRescue(), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  // Undo/redo spam: only the old-timer comments, and only now and then
  if (event === 'undo-spam') return oldtimerTurn(0.6) ? voiced(oldUndo(), 'bad', 'neutral', VOICE_PRIORITY.chatter) : silent
  // After a slow/sloppy win: sometimes a backhanded compliment, once Roman's cheer has finished
  if (event === 'win-heckle') {
    return oldtimerTurn(0.45) ? voiced(oldWin(), 'bad', 'neutral', VOICE_PRIORITY.chatter, { waitMs: 7000 }) : silent
  }
  if (event === 'lose') {
    if (oldtimerTurn()) return voiced(oldLose(), 'bad', 'neutral', VOICE_PRIORITY.lose)
    return voiced(nextLose(), 'bad', 'disappointed', VOICE_PRIORITY.lose)
  }
  if (event === 'prize') return voiced(nextPrize(), 'hype', 'excited', VOICE_PRIORITY.prize)
  // Badges pop a few seconds after a win: wait for Roman's win line to finish instead of cutting it
  if (event === 'achievement') return voiced(nextBadge(), 'hype', 'excited', VOICE_PRIORITY.chatter, { waitMs: 6000 })
  if (event === 'critter-stash') return voiced(nextStash(), 'hype', 'excited', VOICE_PRIORITY.wrong)
  if (event === 'critter') return voiced({ clip: 'nice', pool: ['nice'] }, 'hype', 'happy', VOICE_PRIORITY.chatter)
  return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
}

/** Spark progress after a critter catch — coach counts them (one line per catch) */
export function sparkProgressBanter(have: number, goal = 5): Banter {
  const left = Math.max(0, goal - have)
  return {
    text: have === 1 ? 'One sparkle so far. Four more for the bonus!' : `${have} sparkles. ${left} more for the bonus!`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    clip: have === 1 ? 'spark_1' : have === 2 ? 'spark_2' : have === 3 ? 'spark_3' : 'spark_4',
    priority: VOICE_PRIORITY.chatter,
    waitMs: 2500,
  }
}
