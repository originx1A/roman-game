/* Reconstructed from https://roman-game.surge.sh production JS (index-ChNfA4F8.js).
 * Logic matches the deployed build; formatting/names may differ from original source.
 */

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
}): Challenge {
  return {
    code: randomCode(6),
    puzzleId: input.puzzleId,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    message: input.message?.trim() || 'Beat my time on this board.',
    createdAt: new Date().toISOString(),
    toEmail: input.toEmail?.trim().toLowerCase() || undefined,
  }
}

export function encodeChallengeLink(c: Challenge): string {
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          c: c.code,
          p: c.puzzleId,
          f: c.fromName,
          e: c.fromEmail,
          m: c.message,
        }),
      ),
    ),
  )
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
    }
    if (!data.p || !data.c) return null
    return {
      code: data.c,
      puzzleId: data.p,
      fromName: data.f || 'A friend',
      fromEmail: data.e || 'friend@roman.game',
      message: data.m || 'Can you beat Roman on this board?',
    }
  } catch {
    return null
  }
}

export function mailtoChallenge(c: Challenge, link: string): string {
  const to = c.toEmail || ''
  const subject = encodeURIComponent(`${c.fromName} challenged you on Roman's Game`)
  const body = encodeURIComponent(
    `${c.message}\n\nPuzzle: ${c.puzzleId}\nCode: ${c.code}\n\nOpen this link to play:\n${link}\n\n— Roman's Game`,
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}
