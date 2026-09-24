/** Pre-recorded voice clips under public/voices/ */

export const VOICE_LINES = {
  // Coach — female Jenny
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
  // Roman — human male BrianNeural (cheers + putdowns)
  roman_awesome: '/voices/roman_awesome.mp3',
  roman_legend: '/voices/roman_legend.mp3',
  roman_highfive: '/voices/roman_highfive.mp3',
  roman_win: '/voices/roman_win.mp3',
  roman_brain: '/voices/roman_brain.mp3',
  roman_boss: '/voices/roman_boss.mp3',
  roman_sparkle: '/voices/roman_sparkle.mp3',
  roman_proud: '/voices/roman_proud.mp3',
  roman_clutch: '/voices/roman_clutch.mp3',
  roman_smooth: '/voices/roman_smooth.mp3',
  roman_cheer: '/voices/roman_cheer.mp3',
  roman_cook: '/voices/roman_cook.mp3',
  roman_critter: '/voices/roman_critter.mp3',
  roman_stash: '/voices/roman_stash.mp3',
  roman_prize: '/voices/roman_prize.mp3',
  roman_hint: '/voices/roman_hint.mp3',
  roman_nudge: '/voices/roman_nudge.mp3',
  roman_close: '/voices/roman_close.mp3',
  roman_oops: '/voices/roman_oops.mp3',
  roman_bonk: '/voices/roman_bonk.mp3',
  roman_nope: '/voices/roman_nope.mp3',
  roman_silly: '/voices/roman_silly.mp3',
  roman_brainfart: '/voices/roman_brainfart.mp3',
  roman_retry: '/voices/roman_retry.mp3',
  roman_hearts: '/voices/roman_hearts.mp3',
  roman_colorblind: '/voices/roman_colorblind.mp3',
  roman_samecolor: '/voices/roman_samecolor.mp3',
  roman_rowmate: '/voices/roman_rowmate.mp3',
  roman_coltaken: '/voices/roman_coltaken.mp3',
  roman_cuddle: '/voices/roman_cuddle.mp3',
  roman_highhopes: '/voices/roman_highhopes.mp3',
  roman_cantwin: '/voices/roman_cantwin.mp3',
  roman_trying: '/voices/roman_trying.mp3',
  roman_stillbetter: '/voices/roman_stillbetter.mp3',
  roman_skillissue: '/voices/roman_skillissue.mp3',
  roman_warmup: '/voices/roman_warmup.mp3',
  roman_almost: '/voices/roman_almost.mp3',
  roman_sleeping: '/voices/roman_sleeping.mp3',
  roman_practice: '/voices/roman_practice.mp3',
  roman_myboard: '/voices/roman_myboard.mp3',
  spark_unlocked: '/voices/spark_unlocked.mp3',
  spark_1: '/voices/spark_1.mp3',
  spark_2: '/voices/spark_2.mp3',
  spark_3: '/voices/spark_3.mp3',
  spark_4: '/voices/spark_4.mp3',
  spark_have_1: '/voices/spark_have_1.mp3',
  spark_have_2: '/voices/spark_have_2.mp3',
  spark_have_3: '/voices/spark_have_3.mp3',
  spark_have_4: '/voices/spark_have_4.mp3',
  // Buddy giggles
  buddy_giggle_1: '/voices/buddy_giggle_1.mp3',
  buddy_giggle_2: '/voices/buddy_giggle_2.mp3',
  buddy_giggle_3: '/voices/buddy_giggle_3.mp3',
} as const

export type VoiceLineId = keyof typeof VOICE_LINES

export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'

export type VoiceRole = 'coach' | 'roman' | 'buddy'

export function roleForClip(id: string): VoiceRole {
  if (id.startsWith('roman_')) return 'roman'
  if (id.startsWith('buddy_')) return 'buddy'
  return 'coach'
}

export function moodPlayback(mood: VoiceMood): { rate: number; volume: number } {
  switch (mood) {
    case 'excited':
      // Coach uplift — brighter & a touch faster
      return { rate: 1.08, volume: 0.96 }
    case 'happy':
      return { rate: 1.06, volume: 0.93 }
    case 'soft':
      return { rate: 1.0, volume: 0.86 }
    case 'disappointed':
      // Still gentle — not gloomy
      return { rate: 0.97, volume: 0.88 }
    default:
      return { rate: 1.03, volume: 0.9 }
  }
}
