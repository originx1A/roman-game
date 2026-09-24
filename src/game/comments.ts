export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'
export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'
export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'
export interface Banter {
  text: string
  mood: CommentMood
  voiceMood: VoiceMood
  speak: boolean
  clip?: string
  giggle?: boolean
  silent?: boolean
}
export function banterFor(
  event: string,
  _conflict?: ConflictKind,
): Banter {
  if (event === 'idle') {
    return { text: 'Roman says: any century now.', mood: 'neutral', voiceMood: 'soft', speak: true, clip: 'roman_idle_century' }
  }
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  if (event === 'place-bad') return { text: 'Nope.', mood: 'bad', voiceMood: 'disappointed', speak: true, clip: 'nope' }
  if (event === 'win') return { text: 'Nice!', mood: 'hype', voiceMood: 'excited', speak: true, clip: 'nice' }
  if (event === 'lose') return { text: 'Out of hearts.', mood: 'bad', voiceMood: 'disappointed', speak: true, clip: 'out_of_hearts' }
  return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
}
export function sparkProgressBanter(have: number, goal = 5): Banter {
  return {
    text: `${have} sparkles toward ${goal}.`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    clip: 'nice',
  }
}
