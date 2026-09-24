export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'
export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'
export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'
export type VoiceClipId = string

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
  if (event === 'mark') return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }
  if (event === 'place-good') return { text: '', mood: 'good', voiceMood: 'happy', speak: false, giggle: true, silent: true }
  if (event === 'win' || event === 'prize' || event === 'achievement' || event === 'critter' || event === 'critter-stash') {
    return { text: 'Nice!', mood: 'hype', voiceMood: 'excited', speak: true, clip: 'nice' }
  }
  if (event === 'place-bad' || event === 'lose' || event === 'idle') {
    return { text: 'Try again.', mood: 'bad', voiceMood: 'disappointed', speak: true, clip: 'nope' }
  }
  return { text: 'Here\'s a nudge.', mood: 'neutral', voiceMood: 'soft', speak: true, clip: 'nudge' }
}

export function sparkProgressBanter(have: number, goal = 5): Banter {
  const left = Math.max(0, goal - have)
  return {
    text: have === 1 ? 'One sparkle so far.' : `${have} sparkles. ${left} more for the bonus!`,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    clip: 'nice',
  }
}
