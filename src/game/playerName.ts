/** Long enough for a leaderboard name plus the server's 02, 03… suffix */
export const PLAYER_NAME_MAX = 32

/** Trim, drop control characters, squash spaces, cap at PLAYER_NAME_MAX */
export function cleanPlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return Array.from(s).slice(0, PLAYER_NAME_MAX).join('').trim()
}

/**
 * A name the player never chose. The live default looks like "Roman's Game official".
 * That must not replace the name they already picked on this device.
 */
export function isUnsetAccountName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/[’']/g, '')
  return n === 'romans game official' || n === 'romans game'
}

/**
 * One name for the bar, the nav, Stable, Share, challenges, the victory card, and the Board.
 * A chosen account name wins. A default account name yields to the name already on this device.
 */
export function getPlayerName(sources: {
  publicName?: string | null
  name?: string | null
  playerName?: string | null
  displayName?: string | null
}): string {
  const account = cleanPlayerName(sources.publicName) || cleanPlayerName(sources.name)
  const local = [sources.playerName, sources.displayName].map(cleanPlayerName).find(Boolean) ?? ''
  if (account && !isUnsetAccountName(account)) return account
  if (local) return local
  return account
}
