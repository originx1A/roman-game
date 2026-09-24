export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'

/** Clip id maps to /voices/{id}.mp3 — see voiceLines.ts */
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
  | 'roman_wins'
  | 'out_of_hearts'
  | 'tough_board'
  | 'prize_time'
  | 'new_badge'
  | 'cosmic'
  | 'ruins'
  | 'neon'
  | 'ocean'
  | 'ember'
  | 'crystal'

export interface Banter {
  text: string
  mood: CommentMood
  speak: boolean
  /** Voice clip to play when speak is true */
  clip?: VoiceClipId
  silent?: boolean
}

const GOOD_PLACE: Array<{ text: string; mood: 'good'; clip: VoiceClipId }> = [
  { text: 'Nice.', mood: 'good', clip: 'nice' },
  { text: 'Solid.', mood: 'good', clip: 'solid' },
  { text: 'That works.', mood: 'good', clip: 'that_works' },
  { text: 'Good call.', mood: 'good', clip: 'good_call' },
  { text: 'Clean.', mood: 'good', clip: 'clean' },
]

const BAD_PLACE: Array<{ text: string; mood: 'bad'; clip: VoiceClipId }> = [
  { text: 'Too close — buddies need space.', mood: 'bad', clip: 'too_close' },
  { text: 'That row is already taken.', mood: 'bad', clip: 'row_taken' },
  { text: 'That region already has one.', mood: 'bad', clip: 'region_full' },
  { text: 'Nope. Try another spot.', mood: 'bad', clip: 'nope' },
]

const HINT: Array<{ text: string; mood: CommentMood; clip: VoiceClipId }> = [
  { text: 'Here’s a nudge.', mood: 'neutral', clip: 'nudge' },
]

const WIN: Array<{ text: string; mood: 'hype'; clip: VoiceClipId }> = [
  { text: 'You cleared it!', mood: 'hype', clip: 'cleared' },
  { text: 'Board complete — nice work.', mood: 'hype', clip: 'board_complete' },
  { text: 'Roman wins this round.', mood: 'hype', clip: 'roman_wins' },
]

const LOSE: Array<{ text: string; mood: 'bad'; clip: VoiceClipId }> = [
  { text: 'Out of hearts. Rematch?', mood: 'bad', clip: 'out_of_hearts' },
  { text: 'Tough board — try again.', mood: 'bad', clip: 'tough_board' },
]

const PRIZE: Array<{ text: string; mood: 'hype'; clip: VoiceClipId }> = [
  { text: 'Prize time!', mood: 'hype', clip: 'prize_time' },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Banter is sparse: marks never talk, good places rarely, mistakes/win/lose more often.
 */
export function banterFor(
  event:
    | 'place-good'
    | 'place-bad'
    | 'mark'
    | 'hint'
    | 'win'
    | 'lose'
    | 'prize'
    | 'achievement',
): Banter {
  switch (event) {
    case 'mark':
      return { text: '', mood: 'neutral', speak: false, silent: true }
    case 'place-good': {
      // Only comment ~22% of good placements; almost never speak
      if (Math.random() > 0.22) return { text: '', mood: 'neutral', speak: false, silent: true }
      const line = pick(GOOD_PLACE)
      return { ...line, speak: Math.random() < 0.15 }
    }
    case 'place-bad': {
      const line = pick(BAD_PLACE)
      return { ...line, speak: Math.random() < 0.55 }
    }
    case 'hint': {
      if (Math.random() > 0.4) return { text: '', mood: 'neutral', speak: false, silent: true }
      const line = pick(HINT)
      return { ...line, speak: false }
    }
    case 'win': {
      const line = pick(WIN)
      return { ...line, speak: true }
    }
    case 'lose': {
      const line = pick(LOSE)
      return { ...line, speak: true }
    }
    case 'prize': {
      const line = pick(PRIZE)
      return { ...line, speak: Math.random() < 0.35 }
    }
    case 'achievement':
      return {
        text: 'New badge unlocked.',
        mood: 'hype',
        speak: true,
        clip: 'new_badge',
      }
  }
}
