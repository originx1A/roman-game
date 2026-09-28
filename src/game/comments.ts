import { browserBagStore, createBagSet } from './lineBag'
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
  | 'roman_record_best'
  | 'roman_record_faster'
  | 'roman_record_beat'
  | 'roman_nearmiss'
  | 'roman_trial_clear'
  | 'roman_daily_done'
  | 'old_record_head'
  | 'old_record_tea'
  | 'old_nearmiss'
  | 'old_win_paint'
  | 'old_win_yesterday'
  | 'old_win_gaveup'
  | 'old_rescue_modern'
  | 'old_rescue_refund'
  | 'old_rescue_coins'
  | 'old_rescue_cat'
  | 'old_aside_smell'
  | 'old_aside_heat'
  | 'old_aside_glasses'
  | 'old_aside_stove'
  | 'old_aside_tuesday'
  | 'old_aside_tea'
  | 'old_aside_knees'
  | 'old_aside_remote'
  | 'old_aside_cat'
  | 'old_aside_socks'
  | 'old_jab_mitts'
  | 'old_jab_bingo'
  | 'old_jab_phone'
  | 'old_jab_backday'
  | 'old_jab_buddy'
  | 'old_jab_square'
  | 'old_jab_thinking'
  | 'old_jab_patience'
  | 'old_jab_map'
  | 'old_jab_shoes'
  | 'old_good_fine'
  | 'old_good_accident'
  | 'old_good_tea'
  | 'old_good_knees'
  | 'old_good_once'
  | 'old_good_square'
  | 'old_good_grumble'
  | 'old_good_day'
  | 'spark_1'
  | 'spark_2'
  | 'spark_3'
  | 'spark_4'
  | 'spark_unlocked'
  | 'spark_have_1'
  | 'spark_have_2'
  | 'spark_have_3'
  | 'spark_have_4'
  | 'coach_hint_look'
  | 'coach_hint_help'
  | 'coach_hint_glow'
  | 'coach_hint_clue'
  | 'coach_hint_peek'
  | 'coach_hint_step'
  | 'coach_hint_try'
  | 'coach_lose_breathe'
  | 'coach_lose_again'
  | 'coach_lose_next'
  | 'coach_prize_ooh'
  | 'coach_prize_see'
  | 'coach_badge_earned'
  | 'coach_badge_look'
  | 'roman_hint_wink'
  | 'roman_hint_spy'
  | 'roman_hint_treasure'
  | 'roman_lose_cape'
  | 'roman_lose_shake'
  | 'roman_lose_pillow'
  | 'old_wrong_toaster'
  | 'old_wrong_bold'
  | 'old_wrong_hallway'
  | 'old_wrong_history'
  | 'old_wrong_spectacles'
  | 'old_good_clock'
  | 'old_good_surprised'
  | 'old_good_lucky'
  | 'old_good_clap'
  | 'old_hint_flashlight'
  | 'old_hint_grandkid'
  | 'old_hint_cane'
  | 'old_hint_cheating'
  | 'old_undo_face'
  | 'old_undo_yoyo'
  | 'old_undo_regret'
  | 'old_undo_aging'
  | 'old_undo_eraser'
  | 'old_win_squirrel'
  | 'old_win_frame'
  | 'old_win_napped'
  | 'old_win_twothree'
  | 'old_lose_called'
  | 'old_lose_sandwich'
  | 'old_lose_nephew'
  | 'old_lose_deal'
  | 'old_idle_mail'
  | 'old_idle_beard'
  | 'old_idle_birthday'
  | 'old_aside_humming'
  | 'old_aside_pigeons'
  | 'old_rescue_lifeguard'
  | 'old_rescue_parachute'

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
  'roman_lose_cape',
  'roman_lose_shake',
  'roman_lose_pillow',
] as const satisfies readonly VoiceClipId[]

/** Hint / rescue (Roman). */
export const ROMAN_HINT_CLIPS = [
  'roman_hint',
  'roman_nudge',
  'roman_hint_psst',
  'roman_hint_secret',
  'roman_hint_clue',
  'roman_hint_wink',
  'roman_hint_spy',
  'roman_hint_treasure',
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
  'old_jab_mitts',
  'old_jab_bingo',
  'old_jab_phone',
  'old_jab_backday',
  'old_jab_buddy',
  'old_jab_square',
  'old_jab_thinking',
  'old_jab_patience',
  'old_jab_map',
  'old_jab_shoes',
  'old_wrong_toaster',
  'old_wrong_bold',
  'old_wrong_hallway',
  'old_wrong_history',
  'old_wrong_spectacles',
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
  'old_idle_mail',
  'old_idle_beard',
  'old_idle_birthday',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on hints. */
export const OLDTIMER_HINT_CLIPS = [
  'old_hint_stare',
  'old_hint_tell',
  'old_hint_wheels',
  'old_hint_push',
  'old_hint_smart',
  'old_hint_flashlight',
  'old_hint_grandkid',
  'old_hint_cane',
  'old_hint_cheating',
] as const satisfies readonly VoiceClipId[]

/** Old-timer on undo/redo spam. */
export const OLDTIMER_UNDO_CLIPS = [
  'old_undo_hokey',
  'old_undo_dizzy',
  'old_undo_rocking',
  'old_undo_vacation',
  'old_undo_face',
  'old_undo_yoyo',
  'old_undo_regret',
  'old_undo_aging',
  'old_undo_eraser',
] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player runs out of hearts. */
export const OLDTIMER_LOSE_CLIPS = [
  'old_lose_tape',
  'old_lose_goldfish',
  'old_lose_sideways',
  'old_lose_popcorn',
  'old_lose_called',
  'old_lose_sandwich',
  'old_lose_nephew',
  'old_lose_deal',
] as const satisfies readonly VoiceClipId[]

/** Old-timer backhanded compliments after a slow or sloppy win. */
export const OLDTIMER_WIN_CLIPS = [
  'old_win_eventually',
  'old_win_ugly',
  'old_win_paint',
  'old_win_yesterday',
  'old_win_gaveup',
  'old_win_squirrel',
  'old_win_frame',
  'old_win_napped',
  'old_win_twothree',
] as const satisfies readonly VoiceClipId[]

/** Old-timer when the player buys a rescue. */
export const OLDTIMER_RESCUE_CLIPS = [
  'old_rescue_modern',
  'old_rescue_refund',
  'old_rescue_coins',
  'old_rescue_cat',
  'old_rescue_lifeguard',
  'old_rescue_parachute',
] as const satisfies readonly VoiceClipId[]

/** Offhand remarks that have nothing to do with the move. */
export const OLDTIMER_ASIDE_CLIPS = [
  'old_aside_smell',
  'old_aside_heat',
  'old_aside_glasses',
  'old_aside_stove',
  'old_aside_tuesday',
  'old_aside_tea',
  'old_aside_knees',
  'old_aside_remote',
  'old_aside_cat',
  'old_aside_socks',
  'old_aside_humming',
  'old_aside_pigeons',
] as const satisfies readonly VoiceClipId[]

/** Grudging praise after a correct buddy. */
export const OLDTIMER_GOOD_CLIPS = [
  'old_good_fine',
  'old_good_accident',
  'old_good_tea',
  'old_good_knees',
  'old_good_once',
  'old_good_square',
  'old_good_grumble',
  'old_good_day',
  'old_good_clock',
  'old_good_surprised',
  'old_good_lucky',
  'old_good_clap',
] as const satisfies readonly VoiceClipId[]

/**
 * The old-timer takes about one in three shared voice moments (wrong move, idle, hint, lose),
 * instead of Roman or the coach, never on top of them. A quiet gap keeps him from stacking
 * heckles. Each pool is its own saved shuffle bag (see voiceBags below).
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

/**
 * Every category, for all three voices, is a shuffle bag: each line plays once in random order
 * before any line repeats, a new shuffle never opens with the line just played, a line shared by
 * two categories never plays twice in a row, and bag positions are saved in localStorage so a
 * reload doesn't bring the same lines back first.
 */
const voiceBags = createBagSet({ store: browserBagStore() })

function bag(name: string, pool: readonly VoiceClipId[]) {
  const next = voiceBags.bag(name, pool)
  return () => ({ clip: next(), pool })
}

const oldWrong = bag('old.wrong', OLDTIMER_WRONG_CLIPS)
const oldIdle = bag('old.idle', OLDTIMER_IDLE_CLIPS)
const oldHint = bag('old.hint', OLDTIMER_HINT_CLIPS)
const oldUndo = bag('old.undo', OLDTIMER_UNDO_CLIPS)
const oldLose = bag('old.lose', OLDTIMER_LOSE_CLIPS)
const oldWin = bag('old.win', OLDTIMER_WIN_CLIPS)
const oldRescue = bag('old.rescue', OLDTIMER_RESCUE_CLIPS)
const oldAside = bag('old.aside', OLDTIMER_ASIDE_CLIPS)
const oldGood = bag('old.good', OLDTIMER_GOOD_CLIPS)
/** Buddy Hunt misses: the general jabs (not the wrong-buddy lines, which talk about squares/rules) */
const OLDTIMER_HUNT_MISS_CLIPS = [
  'old_jab_mitts',
  'old_jab_bingo',
  'old_jab_backday',
  'old_jab_thinking',
  'old_jab_patience',
  'old_jab_shoes',
  'old_jab_phone',
] as const satisfies readonly VoiceClipId[]
const oldHuntMiss = bag('old.huntMiss', OLDTIMER_HUNT_MISS_CLIPS)
/** New personal best / near miss (replay challenge) */
export const ROMAN_RECORD_CLIPS = ['roman_record_best', 'roman_record_faster', 'roman_record_beat'] as const satisfies readonly VoiceClipId[]
const OLDTIMER_RECORD_CLIPS = ['old_record_head', 'old_record_tea'] as const satisfies readonly VoiceClipId[]
const oldRecord = bag('old.record', OLDTIMER_RECORD_CLIPS)
const oldNearMiss = bag('old.nearMiss', ['old_nearmiss'] as const satisfies readonly VoiceClipId[])
const nextRecord = voiceBags.bag('roman.record', ROMAN_RECORD_CLIPS)

/** Old-timer draw. The bag set already keeps a line from playing twice in a row across bags. */
function pickOld(draw: () => { clip: VoiceClipId; pool: readonly VoiceClipId[] }) {
  return draw()
}

/** Coach (female) lines for the moments she has always voiced */
const COACH_LOSE_CLIPS = ['out_of_hearts', 'tough_board', 'coach_lose_breathe', 'coach_lose_again', 'coach_lose_next'] as const satisfies readonly VoiceClipId[]
const COACH_HINT_CLIPS = ['nudge', 'coach_hint_look', 'coach_hint_help', 'coach_hint_glow', 'coach_hint_clue', 'coach_hint_peek', 'coach_hint_step', 'coach_hint_try'] as const satisfies readonly VoiceClipId[]
const COACH_BADGE_CLIPS = ['new_badge', 'coach_badge_earned', 'coach_badge_look'] as const satisfies readonly VoiceClipId[]
const COACH_PRIZE_CLIPS = ['prize_time', 'coach_prize_ooh', 'coach_prize_see'] as const satisfies readonly VoiceClipId[]
const COACH_STASH_CLIPS = ['spark_unlocked'] as const satisfies readonly VoiceClipId[]

/** Quick coach praise (critter catch, Buddy Hunt finds) */
const COACH_CHEER_CLIPS = ['nice', 'solid', 'good_call', 'that_works', 'clean'] as const satisfies readonly VoiceClipId[]

const nextCheer = voiceBags.bag('roman.cheer', ROMAN_CHEER_CLIPS)
const nextWrong = voiceBags.bag('roman.wrong', ROMAN_WRONG_CLIPS)
const nextIdle = voiceBags.bag('roman.idle', ROMAN_IDLE_CLIPS)
const nextCoachCheer = bag('coach.cheer', COACH_CHEER_CLIPS)

/**
 * Shared moments (lose, hint, badge, prize, stash): Roman and the coach take turns, one line per
 * event. Each speaker keeps its own saved shuffle bag for the moment.
 */
function takeTurns(name: string, roman: readonly VoiceClipId[], coach: readonly VoiceClipId[]) {
  const nextRoman = voiceBags.bag(`roman.${name}`, roman)
  const nextCoach = voiceBags.bag(`coach.${name}`, coach)
  let coachTurn = Math.random() < 0.5
  return (): { clip: VoiceClipId; pool: readonly VoiceClipId[] } => {
    const turnIsCoach = coachTurn
    coachTurn = !coachTurn
    return turnIsCoach ? { clip: nextCoach(), pool: coach } : { clip: nextRoman(), pool: roman }
  }
}

const nextLose = takeTurns('lose', ROMAN_LOSE_CLIPS, COACH_LOSE_CLIPS)
const nextHint = takeTurns('hint', ROMAN_HINT_CLIPS, COACH_HINT_CLIPS)
const nextBadge = takeTurns('badge', ROMAN_BADGE_CLIPS, COACH_BADGE_CLIPS)
const nextPrize = takeTurns('prize', ROMAN_PRIZE_CLIPS, COACH_PRIZE_CLIPS)
const nextStash = takeTurns('stash', ROMAN_STASH_CLIPS, COACH_STASH_CLIPS)

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
    | 'win-heckle'
    | 'aside'
    | 'hunt-miss'
    | 'hunt-some'
    | 'hunt-all'
    | 'hunt-none'
    | 'record'
    | 'near-miss'
    | 'trial-clear'
    | 'daily-done',
  _conflict?: ConflictKind,
): Banter {
  const silent: Banter = { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'idle') {
    if (oldtimerTurn()) return voiced(pickOld(oldIdle), 'bad', 'neutral', VOICE_PRIORITY.idle)
    return voiced(roman(nextIdle(), ROMAN_IDLE_CLIPS), 'bad', 'disappointed', VOICE_PRIORITY.idle)
  }
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') {
    // Buddy giggle still plays from the board. Praise is a voice line, so leave giggle unset.
    if (oldtimerTurn()) return voiced(pickOld(oldGood), 'good', 'neutral', VOICE_PRIORITY.chatter)
    return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  }
  if (event === 'place-bad') {
    if (oldtimerTurn()) return voiced(pickOld(oldWrong), 'bad', 'neutral', VOICE_PRIORITY.wrong)
    return voiced(roman(nextWrong(), ROMAN_WRONG_CLIPS), 'bad', 'disappointed', VOICE_PRIORITY.wrong)
  }
  if (event === 'win') return voiced(roman(nextCheer(), ROMAN_CHEER_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  if (event === 'hint') {
    if (oldtimerTurn()) return voiced(pickOld(oldHint), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  if (event === 'rescue') {
    if (oldtimerTurn(0.5)) return voiced(pickOld(oldRescue), 'neutral', 'neutral', VOICE_PRIORITY.hint)
    return voiced(nextHint(), 'neutral', 'happy', VOICE_PRIORITY.hint)
  }
  // Undo/redo spam: only the old-timer comments, and only now and then
  if (event === 'undo-spam') return oldtimerTurn(0.6) ? voiced(pickOld(oldUndo), 'bad', 'neutral', VOICE_PRIORITY.chatter) : silent
  // After a slow/sloppy win: sometimes a backhanded compliment, once Roman's cheer has finished
  if (event === 'win-heckle') {
    return oldtimerTurn(0.45) ? voiced(pickOld(oldWin), 'bad', 'neutral', VOICE_PRIORITY.chatter, { waitMs: 7000 }) : silent
  }
  // Free-channel remark. The caller already waited; share is 1 so only the cooldown applies.
  if (event === 'aside') {
    return oldtimerTurn(1) ? voiced(pickOld(oldAside), 'neutral', 'neutral', VOICE_PRIORITY.idle) : silent
  }
  if (event === 'lose') {
    if (oldtimerTurn()) return voiced(pickOld(oldLose), 'bad', 'neutral', VOICE_PRIORITY.lose)
    return voiced(nextLose(), 'bad', 'disappointed', VOICE_PRIORITY.lose)
  }
  // Buddy Hunt bonus round: existing clips only, same one-voice-at-a-time channel
  if (event === 'hunt-miss') return oldtimerTurn(0.5) ? voiced(pickOld(oldHuntMiss), 'bad', 'neutral', VOICE_PRIORITY.chatter) : silent
  if (event === 'hunt-some') {
    if (oldtimerTurn(0.5)) return voiced(pickOld(oldGood), 'good', 'neutral', VOICE_PRIORITY.prize)
    return voiced(nextCoachCheer(), 'hype', 'happy', VOICE_PRIORITY.prize)
  }
  if (event === 'hunt-all') return voiced(roman(nextCheer(), ROMAN_CHEER_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  if (event === 'hunt-none') return voiced(nextLose(), 'bad', 'disappointed', VOICE_PRIORITY.prize)
  if (event === 'prize') return voiced(nextPrize(), 'hype', 'excited', VOICE_PRIORITY.prize)
  // Replay challenge: these replace the win cheer (never on top of it)
  if (event === 'record') {
    if (oldtimerTurn(0.35)) return voiced(pickOld(oldRecord), 'hype', 'neutral', VOICE_PRIORITY.win)
    return voiced(roman(nextRecord(), ROMAN_RECORD_CLIPS), 'hype', 'excited', VOICE_PRIORITY.win)
  }
  if (event === 'near-miss') {
    if (oldtimerTurn(0.5)) return voiced(pickOld(oldNearMiss), 'neutral', 'neutral', VOICE_PRIORITY.win)
    return voiced(roman('roman_nearmiss', ['roman_nearmiss']), 'neutral', 'happy', VOICE_PRIORITY.win)
  }
  if (event === 'trial-clear') return voiced(roman('roman_trial_clear', ['roman_trial_clear']), 'hype', 'excited', VOICE_PRIORITY.win)
  if (event === 'daily-done') return voiced(roman('roman_daily_done', ['roman_daily_done']), 'hype', 'excited', VOICE_PRIORITY.win)
  // Badges pop a few seconds after a win: wait for Roman's win line to finish instead of cutting it
  if (event === 'achievement') return voiced(nextBadge(), 'hype', 'excited', VOICE_PRIORITY.chatter, { waitMs: 6000 })
  if (event === 'critter-stash') return voiced(nextStash(), 'hype', 'excited', VOICE_PRIORITY.wrong)
  if (event === 'critter') return voiced(nextCoachCheer(), 'hype', 'happy', VOICE_PRIORITY.chatter)
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
