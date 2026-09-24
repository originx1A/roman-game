/** Pre-recorded TTS clips (edge-tts / en-US-JennyNeural) under public/voices/ */

export const VOICE_LINES = {
  nice: '/voices/nice.mp3',
  solid: '/voices/solid.mp3',
  good_call: '/voices/good_call.mp3',
  that_works: '/voices/that_works.mp3',
  clean: '/voices/clean.mp3',
  too_close: '/voices/too_close.mp3',
  row_taken: '/voices/row_taken.mp3',
  region_full: '/voices/region_full.mp3',
  nope: '/voices/nope.mp3',
  nudge: '/voices/nudge.mp3',
  cleared: '/voices/cleared.mp3',
  board_complete: '/voices/board_complete.mp3',
  roman_wins: '/voices/roman_wins.mp3',
  out_of_hearts: '/voices/out_of_hearts.mp3',
  tough_board: '/voices/tough_board.mp3',
  prize_time: '/voices/prize_time.mp3',
  new_badge: '/voices/new_badge.mp3',
  cosmic: '/voices/cosmic.mp3',
  ruins: '/voices/ruins.mp3',
  neon: '/voices/neon.mp3',
  ocean: '/voices/ocean.mp3',
  ember: '/voices/ember.mp3',
  crystal: '/voices/crystal.mp3',
} as const

export type VoiceLineId = keyof typeof VOICE_LINES

/** Resolve a voice clip id (or pool of ids) for a game event / theme. */
export function VOICE_BY_EVENT(
  event:
    | 'place-good'
    | 'place-bad'
    | 'hint'
    | 'win'
    | 'lose'
    | 'prize'
    | 'achievement'
    | 'theme-cosmic'
    | 'theme-ruins'
    | 'theme-neon'
    | 'theme-ocean'
    | 'theme-ember'
    | 'theme-crystal',
): VoiceLineId | readonly VoiceLineId[] {
  switch (event) {
    case 'place-good':
      return ['nice', 'solid', 'good_call', 'that_works', 'clean']
    case 'place-bad':
      return ['too_close', 'row_taken', 'region_full', 'nope']
    case 'hint':
      return 'nudge'
    case 'win':
      return ['cleared', 'board_complete', 'roman_wins']
    case 'lose':
      return ['out_of_hearts', 'tough_board']
    case 'prize':
      return 'prize_time'
    case 'achievement':
      return 'new_badge'
    case 'theme-cosmic':
      return 'cosmic'
    case 'theme-ruins':
      return 'ruins'
    case 'theme-neon':
      return 'neon'
    case 'theme-ocean':
      return 'ocean'
    case 'theme-ember':
      return 'ember'
    case 'theme-crystal':
      return 'crystal'
  }
}

/** Pick one id when VOICE_BY_EVENT returns a pool. */
export function pickVoiceForEvent(
  event: Parameters<typeof VOICE_BY_EVENT>[0],
): VoiceLineId {
  const v = VOICE_BY_EVENT(event)
  if (typeof v === 'string') return v
  return v[Math.floor(Math.random() * v.length)]
}
