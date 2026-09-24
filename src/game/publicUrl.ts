/** Public site for every share, challenge, and duel link.
 *  Change this if the site moves (a custom domain or a store link).
 */
export const PUBLIC_GAME_URL = 'https://roman-game.surge.sh'

/** Site root with no hash, used when sharing the game itself. */
export function publicPlayUrl(): string {
  const url = new URL(PUBLIC_GAME_URL)
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Same public origin, with a challenge or duel hash. */
export function publicLinkWithHash(hash: string): string {
  const url = new URL(PUBLIC_GAME_URL)
  url.search = ''
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash
  return url.toString()
}
