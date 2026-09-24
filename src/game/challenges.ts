/* Challenge invite links — board + optional score duel payload. */

import type { Challenge } from './types'

function randomCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => alphabet[b % 32]).join('')
}

export function createChallenge(input: {
  puzzleId: string
  fromEmail: string
  fromName: string
  message?: string
  toEmail?: string
  score?: number
  elapsedMs?: number
}): Challenge {
  return {
    code: randomCode(6),
    puzzleId: input.puzzleId,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    message: input.message?.trim() || 'Beat my time on this board.',
    createdAt: new Date().toISOString(),
    toEmail: input.toEmail?.trim().toLowerCase() || undefined,
    score: typeof input.score === 'number' ? input.score : undefined,
    elapsedMs: typeof input.elapsedMs === 'number' ? input.elapsedMs : undefined,
  }
}

export function encodeChallengeLink(c: Challenge): string {
  const payloadObj: Record<string, string | number> = {
    c: c.code,
    p: c.puzzleId,
    f: c.fromName,
    e: c.fromEmail,
    m: c.message,
  }
  if (typeof c.score === 'number') payloadObj.s = Math.round(c.score)
  if (typeof c.elapsedMs === 'number') payloadObj.t = Math.round(c.elapsedMs)

  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObj))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `challenge=${payload}`
  return url.toString()
}

export function parseChallengeFromHash(
  hash: string,
): Omit<Challenge, 'createdAt'> | null {
  const m = hash.match(/challenge=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '==='.slice((b64.length + 3) % 4)
    const json = decodeURIComponent(escape(atob(b64)))
    const data = JSON.parse(json) as {
      c?: string
      p?: string
      f?: string
      e?: string
      m?: string
      s?: number
      t?: number
    }
    if (!data.p || !data.c) return null
    return {
      code: data.c,
      puzzleId: data.p,
      fromName: data.f || 'A friend',
      fromEmail: data.e || 'friend@roman.game',
      message: data.m || 'Can you beat Roman on this board?',
      score: typeof data.s === 'number' ? data.s : undefined,
      elapsedMs: typeof data.t === 'number' ? data.t : undefined,
    }
  } catch {
    return null
  }
}

export function mailtoChallenge(c: Challenge, link: string): string {
  const to = c.toEmail || ''
  const subject = encodeURIComponent(`${c.fromName} challenged you on Roman's Game`)
  const duelLine =
    typeof c.score === 'number'
      ? `\nTheir score: ${c.score} pts${typeof c.elapsedMs === 'number' ? ` in ${Math.round(c.elapsedMs / 1000)}s` : ''}\n`
      : ''
  const body = encodeURIComponent(
    `${c.message}${duelLine}\nPuzzle: ${c.puzzleId}\nCode: ${c.code}\n\nOpen this link to play:\n${link}\n\n— Roman's Game`,
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}

export function duelOutcome(opts: {
  yourScore: number
  opponentScore: number
}): 'win' | 'lose' | 'tie' {
  if (opts.yourScore > opts.opponentScore) return 'win'
  if (opts.yourScore < opts.opponentScore) return 'lose'
  return 'tie'
}
