export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'
export type VoiceClipId = string
export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'
export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'

export interface Banter {
  text: string
  mood: CommentMood
  voiceMood: VoiceMood
  speak: boolean
  clip?: VoiceClipId
  giggle?: boolean
  silent?: boolean
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
  if (event === 'idle') {
    return { text: 'Any century now.', mood: 'bad', voiceMood: 'disappointed', speak: true, clip: 'roman_idle_hello' }
  }
  return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
}

export function sparkProgressBanter(have: number, goal = 5): Banter {
  return {
    text: `${have}/${goal} sparkles`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: false,
  }
}
