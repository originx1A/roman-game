/**
 * Portal stand-in for src/game/publicUrl.ts.
 * Share hashes stay on the page that is open. They do not point at play.romansgame.com.
 */
export const SHARE_LINK_QUERY = ''

function here(): URL {
  const url = new URL(typeof location !== 'undefined' ? location.href : 'https://localhost/')
  url.hash = ''
  url.search = ''
  return url
}

export function publicPlayUrl(): string {
  return here().toString()
}

export function publicLinkWithHash(hash: string): string {
  const url = here()
  url.hash = hash.startsWith('#') ? hash.slice(1) : hash
  return url.toString()
}
