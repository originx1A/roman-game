import type { Challenge, DuelResult } from './types'

function alphabetCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function toB64Url(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64Url(raw: string): unknown {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64 + '==='.slice((b64.length + 3) % 4)
  return JSON.parse(decodeURIComponent(escape(atob(pad))))
}

export function createChallenge(input: {
  puzzleId: string
  fromEmail: string
  fromName: string
  message?: string
  toEmail?: string
  scoreMs?: number
  scorePts?: number
}): Challenge {
  const hasScore = input.scoreMs != null && input.scorePts != null
  return {
    code: alphabetCode(6),
    puzzleId: input.puzzleId,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    message:
      input.message?.trim() ||
      (hasScore
        ? `Beat my ${formatShareTime(input.scoreMs!)} · ${input.scorePts} pts!`
        : 'Beat my time on this board.'),
    createdAt: new Date().toISOString(),
    toEmail: input.toEmail?.trim().toLowerCase() || undefined,
    scoreMs: input.scoreMs,
    scorePts: input.scorePts,
  }
}

export function formatShareTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

export function encodeChallengeLink(c: Challenge): string {
  const payload = toB64Url({
    c: c.code,
    p: c.puzzleId,
    f: c.fromName,
    e: c.fromEmail,
    m: c.message,
    ...(c.scoreMs != null ? { t: c.scoreMs } : {}),
    ...(c.scorePts != null ? { s: c.scorePts } : {}),
  })
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `challenge=${payload}`
  return url.toString()
}

export function parseChallengeFromHash(hash: string): Omit<Challenge, 'createdAt'> | null {
  const m = hash.match(/challenge=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    const data = fromB64Url(m[1]) as Record<string, unknown>
    if (!data.p || !data.c) return null
    return {
      code: String(data.c),
      puzzleId: String(data.p),
      fromName: String(data.f || 'A friend'),
      fromEmail: String(data.e || 'friend@roman.game'),
      message: String(data.m || 'Can you beat Roman on this board?'),
      scoreMs: typeof data.t === 'number' ? data.t : undefined,
      scorePts: typeof data.s === 'number' ? data.s : undefined,
    }
  } catch {
    return null
  }
}

export function challengeShareText(c: Challenge): string {
  if (c.scoreMs != null && c.scorePts != null) {
    return `${c.fromName} scored ${formatShareTime(c.scoreMs)} · ${c.scorePts} pts on Roman's Game — can you beat it?`
  }
  return c.message || `${c.fromName} challenged you on Roman's Game!`
}

export function createDuelResult(input: {
  code: string
  puzzleId: string
  aName: string
  aMs: number
  aPts: number
  bName: string
  bMs: number
  bPts: number
}): DuelResult {
  return { ...input }
}

export function encodeDuelLink(d: DuelResult): string {
  const payload = toB64Url({
    c: d.code,
    p: d.puzzleId,
    an: d.aName,
    am: d.aMs,
    ap: d.aPts,
    bn: d.bName,
    bm: d.bMs,
    bp: d.bPts,
  })
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `duel=${payload}`
  return url.toString()
}

export function parseDuelFromHash(hash: string): DuelResult | null {
  const m = hash.match(/duel=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    const data = fromB64Url(m[1]) as Record<string, unknown>
    if (!data.p || typeof data.am !== 'number' || typeof data.bm !== 'number') return null
    return {
      code: String(data.c || 'DUEL'),
      puzzleId: String(data.p),
      aName: String(data.an || 'Player A'),
      aMs: Number(data.am),
      aPts: Number(data.ap || 0),
      bName: String(data.bn || 'Player B'),
      bMs: Number(data.bm),
      bPts: Number(data.bp || 0),
    }
  } catch {
    return null
  }
}

export function duelShareText(d: DuelResult): string {
  const aWin = d.aPts > d.bPts || (d.aPts === d.bPts && d.aMs <= d.bMs)
  const winner = aWin ? d.aName : d.bName
  return `Roman's Game duel: ${d.aName} ${formatShareTime(d.aMs)} (${d.aPts}) vs ${d.bName} ${formatShareTime(d.bMs)} (${d.bPts}) — ${winner} wins!`
}

export function duelWinner(d: DuelResult): 'a' | 'b' | 'tie' {
  if (d.aPts === d.bPts && d.aMs === d.bMs) return 'tie'
  if (d.aPts > d.bPts) return 'a'
  if (d.bPts > d.aPts) return 'b'
  return d.aMs <= d.bMs ? 'a' : 'b'
}

export function mailtoChallenge(c: Challenge, link: string): string {
  const to = c.toEmail || ''
  const subject = encodeURIComponent(`${c.fromName} challenged you on Roman's Game`)
  const scoreLine =
    c.scoreMs != null && c.scorePts != null
      ? `\nTheir score: ${formatShareTime(c.scoreMs)} · ${c.scorePts} pts\n`
      : ''
  const body = encodeURIComponent(
    `${c.message}${scoreLine}\nPuzzle: ${c.puzzleId}\nCode: ${c.code}\n\nOpen this link to play:\n${link}\n\n— Roman's Game`,
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}
