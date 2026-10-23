import { decideName } from './namePolicy.ts'

/**
 * Kid-safe words for a server-generated player name.
 * A name is one adjective, one noun, and a number: "Sunny Otter 7".
 */
export const GROUP_ADJECTIVES = [
  'sunny',
  'brave',
  'calm',
  'happy',
  'kind',
  'swift',
  'bright',
  'gentle',
  'merry',
  'cozy',
  'lucky',
  'jolly',
  'peppy',
  'tidy',
  'nifty',
  'bubbly',
  'cheery',
  'plucky',
  'snug',
  'zippy',
] as const

export const GROUP_NOUNS = [
  'otter',
  'panda',
  'bunny',
  'robin',
  'duck',
  'fawn',
  'mouse',
  'pony',
  'seal',
  'whale',
  'finch',
  'heron',
  'crane',
  'koala',
  'puppy',
  'cub',
  'dove',
  'lark',
  'frog',
  'fox',
] as const

export type GroupName = { displayName: string; normalized: string }

function titleWord(word: string): string {
  return word.slice(0, 1).toUpperCase() + word.slice(1)
}

/** Build one candidate. Null when it would fail the player-name rules. */
export function groupPlayerName(adjective: string, noun: string, number: number): GroupName | null {
  if (!Number.isInteger(number) || number < 1 || number > 99) return null
  const displayName = `${titleWord(adjective)} ${titleWord(noun)} ${number}`
  if (displayName.includes('@')) return null
  const decision = decideName(displayName)
  if (!decision.ok) return null
  return { displayName: decision.displayName, normalized: decision.normalized }
}

/**
 * Pick an unused name from the group lists.
 * `taken` is true when that normalized name is already a player.
 */
export async function allocateGroupName(
  taken: (normalized: string) => Promise<boolean>,
  random: () => number = Math.random,
): Promise<GroupName | null> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const adjective = GROUP_ADJECTIVES[Math.floor(random() * GROUP_ADJECTIVES.length)] ?? GROUP_ADJECTIVES[0]
    const noun = GROUP_NOUNS[Math.floor(random() * GROUP_NOUNS.length)] ?? GROUP_NOUNS[0]
    const number = 1 + Math.floor(random() * 99)
    const built = groupPlayerName(adjective, noun, number)
    if (!built) continue
    if (await taken(built.normalized)) continue
    return built
  }
  return null
}
