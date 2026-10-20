/** Friend codes look like ROMAN-4821. Share links carry one as ?ref= so a signed-in player connects on open. */

const CODE_RE = /^ROMAN-\d{4}$/

export function normalizeFriendCode(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '')
  const match = compact.match(/^ROMAN-?(\d{4})$/)
  if (!match) return ''
  const code = `ROMAN-${match[1]}`
  return CODE_RE.test(code) ? code : ''
}

export function withInviteRef(url: string, code: string | null | undefined): string {
  const friend = code ? normalizeFriendCode(code) : ''
  if (!friend) return url
  try {
    const next = new URL(url)
    next.searchParams.set('ref', friend)
    return next.toString()
  } catch {
    return url
  }
}

let current = ''

export function setActiveFriendRef(code: string | null | undefined): void {
  current = code ? normalizeFriendCode(code) : ''
}

export function activeFriendRef(): string {
  return current
}

export function applyFriendRef(url: string): string {
  return withInviteRef(url, current)
}

/** 'Sam beat you by 80' for the loser, 'You win' for the winner. A tie tells both. */
export function resultLines(myName: string, theirName: string, myScore: number, theirScore: number): { mine: string; theirs: string } {
  const mine = myName.trim() || 'You'
  const theirs = theirName.trim() || 'Friend'
  if (myScore === theirScore) return { mine: "It's a tie", theirs: "It's a tie" }
  if (myScore > theirScore) {
    const by = myScore - theirScore
    return { mine: 'You win', theirs: `${mine} beat you by ${by}` }
  }
  const by = theirScore - myScore
  return { mine: `${theirs} beat you by ${by}`, theirs: 'You win' }
}

export function bragLine(boardName: string, seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `I beat ${boardName} in ${s} ${s === 1 ? 'second' : 'seconds'}, can you?`
}
