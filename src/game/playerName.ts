/** Long enough for a leaderboard name plus the server's 02, 03… suffix */
export const PLAYER_NAME_MAX = 32

/** Trim, drop control characters, squash spaces, cap at PLAYER_NAME_MAX */
export function cleanPlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return Array.from(s).slice(0, PLAYER_NAME_MAX).join('').trim()
}

/**
 * One name for shares, challenges, and labels.
 * Account name first (publicName ?? name), then settings.playerName, then the old local profile.
 */
export function getPlayerName(sources: {
  publicName?: string | null
  name?: string | null
  playerName?: string | null
  displayName?: string | null
}): string {
  const account = cleanPlayerName(sources.publicName) || cleanPlayerName(sources.name)
  if (account) return account
  for (const raw of [sources.playerName, sources.displayName]) {
    const cleaned = cleanPlayerName(raw)
    if (cleaned) return cleaned
  }
  return ''
}
