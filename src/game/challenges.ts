import type { Challenge, DuelResult } from './types'
import { publicLinkWithHash } from './publicUrl'

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

export function boardLabel(c: { puzzleName?: string; difficulty?: string; puzzleId: string }): string {
  if (c.puzzleName && c.difficulty) return `${c.puzzleName} (${c.difficulty})`
  if (c.puzzleName) return c.puzzleName
  return c.puzzleId
}

export function rankLabel(badgePower?: number, bonusPct?: number): string {
  if (badgePower == null || badgePower <= 0) return 'Unranked'
  const bonus = bonusPct != null ? ` · +${bonusPct % 1 === 0 ? bonusPct : bonusPct.toFixed(1)}% coins` : ''
  return `Badge Power ${badgePower}${bonus}`
}

export function createChallenge(input: {
  puzzleId: string
  fromEmail: string
  fromName: string
  message?: string
  toEmail?: string
  scoreMs?: number
  scorePts?: number
  badgePower?: number
  bonusPct?: number
  puzzleName?: string
  difficulty?: string
}): Challenge {
  const hasScore = input.scoreMs != null && input.scorePts != null
  const board = boardLabel({
    puzzleId: input.puzzleId,
    puzzleName: input.puzzleName,
    difficulty: input.difficulty,
  })
  const rank = rankLabel(input.badgePower, input.bonusPct)
  return {
    code: alphabetCode(6),
    puzzleId: input.puzzleId,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    message:
      input.message?.trim() ||
      (hasScore
        ? `Beat my ${formatShareTime(input.scoreMs!)} · ${input.scorePts} pts on ${board}! (${rank})`
        : `Beat me on ${board}.`),
    createdAt: new Date().toISOString(),
    toEmail: input.toEmail?.trim().toLowerCase() || undefined,
    scoreMs: input.scoreMs,
    scorePts: input.scorePts,
    badgePower: input.badgePower,
    bonusPct: input.bonusPct,
    puzzleName: input.puzzleName,
    difficulty: input.difficulty,
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
    ...(c.badgePower != null ? { bp: c.badgePower } : {}),
    ...(c.bonusPct != null ? { bb: c.bonusPct } : {}),
    ...(c.puzzleName ? { pn: c.puzzleName } : {}),
    ...(c.difficulty ? { d: c.difficulty } : {}),
  })
  return publicLinkWithHash(`challenge=${payload}`)
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
      badgePower: typeof data.bp === 'number' ? data.bp : undefined,
      bonusPct: typeof data.bb === 'number' ? data.bb : undefined,
      puzzleName: typeof data.pn === 'string' ? data.pn : undefined,
      difficulty: typeof data.d === 'string' ? data.d : undefined,
    }
  } catch {
    return null
  }
}

export function challengeShareText(c: Challenge): string {
  const board = boardLabel(c)
  const rank = rankLabel(c.badgePower, c.bonusPct)
  if (c.scoreMs != null && c.scorePts != null) {
    return `${c.fromName} cleared ${board} in ${formatShareTime(c.scoreMs)} · ${c.scorePts} pts (${rank}) — can you beat it on Roman's Game?`
  }
  return c.message || `${c.fromName} challenged you on ${board}!`
}

export function createDuelResult(input: {
  code: string
  puzzleId: string
  puzzleName?: string
  difficulty?: string
  aName: string
  aMs: number
  aPts: number
  aPower?: number
  aBonus?: number
  bName: string
  bMs: number
  bPts: number
  bPower?: number
  bBonus?: number
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
    ...(d.puzzleName ? { pn: d.puzzleName } : {}),
    ...(d.difficulty ? { d: d.difficulty } : {}),
    ...(d.aPower != null ? { aw: d.aPower } : {}),
    ...(d.aBonus != null ? { ab: d.aBonus } : {}),
    ...(d.bPower != null ? { bw: d.bPower } : {}),
    ...(d.bBonus != null ? { bb: d.bBonus } : {}),
  })
  return publicLinkWithHash(`duel=${payload}`)
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
      puzzleName: typeof data.pn === 'string' ? data.pn : undefined,
      difficulty: typeof data.d === 'string' ? data.d : undefined,
      aName: String(data.an || 'Player A'),
      aMs: Number(data.am),
      aPts: Number(data.ap || 0),
      aPower: typeof data.aw === 'number' ? data.aw : undefined,
      aBonus: typeof data.ab === 'number' ? data.ab : undefined,
      bName: String(data.bn || 'Player B'),
      bMs: Number(data.bm),
      bPts: Number(data.bp || 0),
      bPower: typeof data.bw === 'number' ? data.bw : undefined,
      bBonus: typeof data.bb === 'number' ? data.bb : undefined,
    }
  } catch {
    return null
  }
}

export function duelShareText(d: DuelResult): string {
  const aWin = d.aPts > d.bPts || (d.aPts === d.bPts && d.aMs <= d.bMs)
  const winner = aWin ? d.aName : d.bName
  const board = boardLabel(d)
  const aP = d.aPower != null ? ` · P${d.aPower}` : ''
  const bP = d.bPower != null ? ` · P${d.bPower}` : ''
  return `Roman's Game · ${board}: ${d.aName} ${formatShareTime(d.aMs)} (${d.aPts} pts${aP}) vs ${d.bName} ${formatShareTime(d.bMs)} (${d.bPts} pts${bP}) — ${winner} wins!`
}

export function duelWinner(d: DuelResult): 'a' | 'b' | 'tie' {
  if (d.aPts === d.bPts && d.aMs === d.bMs) return 'tie'
  if (d.aPts > d.bPts) return 'a'
  if (d.bPts > d.aPts) return 'b'
  return d.aMs <= d.bMs ? 'a' : 'b'
}

export function mailtoChallenge(c: Challenge, link: string): string {
  const to = c.toEmail || ''
  const board = boardLabel(c)
  const subject = encodeURIComponent(`${c.fromName} challenged you on ${board}`)
  const scoreLine =
    c.scoreMs != null && c.scorePts != null
      ? `\nTheir score: ${formatShareTime(c.scoreMs)} · ${c.scorePts} pts` +
        (c.badgePower != null ? ` · ${rankLabel(c.badgePower, c.bonusPct)}` : '') +
        `\n`
      : ''
  const body = encodeURIComponent(
    `${c.message}${scoreLine}\nBoard: ${board}\nCode: ${c.code}\n\nOpen this link to play:\n${link}\n\n— Roman's Game`,
  )
  return `mailto:${to}?subject=${subject}&body=${body}`
}
