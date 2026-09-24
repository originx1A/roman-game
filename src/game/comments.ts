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
}

/** Win cheers. Every id has a clip under public/voices. */
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

/** Wrong-move putdowns. */
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

/** Idle pokes while the player waits. */
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

const nextCheer = createShuffleBag(ROMAN_CHEER_CLIPS)
const nextWrong = createShuffleBag(ROMAN_WRONG_CLIPS)
const nextIdle = createShuffleBag(ROMAN_IDLE_CLIPS)

function romanBanter(
  clip: VoiceClipId,
  pool: readonly VoiceClipId[],
  mood: CommentMood,
  voiceMood: VoiceMood,
): Banter {
  return {
    text: voiceLineText(clip) ?? 'Roman says: okay, next!',
    mood,
    voiceMood,
    speak: true,
    clip,
    alts: pool.filter((id) => id !== clip),
  }
}

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
    | 'idle',
  _conflict?: ConflictKind,
): Banter {
  if (event === 'idle') return romanBanter(nextIdle(), ROMAN_IDLE_CLIPS, 'bad', 'disappointed')
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  if (event === 'place-bad') return romanBanter(nextWrong(), ROMAN_WRONG_CLIPS, 'bad', 'disappointed')
  if (event === 'hint') return { text: "Here's a nudge.", mood: 'neutral', voiceMood: 'happy', speak: true, clip: 'nudge' }
  if (event === 'win') return romanBanter(nextCheer(), ROMAN_CHEER_CLIPS, 'hype', 'excited')
  if (event === 'lose') return { text: 'Out of hearts. Rematch?', mood: 'bad', voiceMood: 'disappointed', speak: true, clip: 'out_of_hearts' }
  if (event === 'prize' || event === 'achievement' || event === 'critter-stash') {
    return { text: 'Sparkle mode unlocked!', mood: 'hype', voiceMood: 'excited', speak: true, clip: 'spark_unlocked' }
  }
  if (event === 'critter') return { text: 'Nice catch!', mood: 'hype', voiceMood: 'happy', speak: true, clip: 'nice' }
  return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
}

export function sparkProgressBanter(have: number, goal = 5): Banter {
  const left = Math.max(0, goal - have)
  return {
    text: have === 1 ? 'One sparkle so far. Four more for the bonus!' : `${have} sparkles. ${left} more for the bonus!`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    clip: have === 1 ? 'spark_1' : have === 2 ? 'spark_2' : have === 3 ? 'spark_3' : 'spark_4',
  }
}
