/** Public site for every share, challenge, and duel link.
 *  Change this if the site moves (a custom domain or a store link).
 */
export const PUBLIC_GAME_URL = 'https://romans-game.netlify.app'

/**
 * Cache-buster on every shared link. X and Facebook cache the exact URL,
 * and they cached the site root before og-image.png existed.
 * Bump the value (`s=3`, `s=4`, …) when the share card should be fetched again.
 * Keep `og:url` in index.html on this same URL.
 */
export const SHARE_LINK_QUERY = 's=2'

function publicUrl(): URL {
  const url = new URL(PUBLIC_GAME_URL)
  url.hash = ''
  const eq = SHARE_LINK_QUERY.indexOf('=')
  url.search = ''
  url.searchParams.set(SHARE_LINK_QUERY.slice(0, eq), SHARE_LINK_QUERY.slice(eq + 1))
  return url
}

/** Site root used when sharing the game itself. */
export function publicPlayUrl(): string {
  return publicUrl().toString()
}

/** Same public origin, with a challenge or duel hash after the cache-bust query. */
export function publicLinkWithHash(hash: string): string {
  const url = publicUrl()
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash
  return url.toString()
}

/** Short share link. The ?s= query stays so link previews still use the card image. */
export function publicShortLink(id: string): string {
  const url = publicUrl()
  url.pathname = `/c/${id}`
  return url.toString()
}

export function shareIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([a-z0-9]{8})\/?$/)
  return match ? match[1] : null
}
