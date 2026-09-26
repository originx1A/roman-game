import type { Challenge, Difficulty, DuelResult, Puzzle } from './types'
import { publicLinkWithHash, publicShortLink } from './publicUrl'
import { PUZZLES } from './puzzles'
import { challengeFromPayload, duelFromPayload, isShareId } from './shareRecord'
import { mailBody } from './share'
import { rememberGeneratedPuzzle } from './storage'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert']

function isCatalogId(id: string): boolean {
  return PUZZLES.some((p) => p.id === id)
}

/** Real sender address only — never the device placeholder. */
function linkEmail(email: string | undefined): string | undefined {
  const e = email?.trim()
  if (!e || e.endsWith('@device.local')) return undefined
  return e
}

/** Compact size/regions/solution blob so a friend can load a non-catalog board. */
export function packBoardLayout(p: Puzzle): string {
  const cells = p.size * p.size
  const bytes = new Uint8Array(3 + cells + p.solution.length)
  bytes[0] = p.size & 255
  bytes[1] = Math.max(0, DIFFICULTIES.indexOf(p.difficulty))
  bytes[2] = p.solution.length & 255
  for (let i = 0; i < cells; i++) bytes[3 + i] = (p.regions[i] ?? 0) & 255
  for (let i = 0; i < p.solution.length; i++) bytes[3 + cells + i] = p.solution[i] & 255
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function registerSharedBoard(
  id: string,
  name: string | undefined,
  packed: string,
): Puzzle | null {
  try {
    const b64 = packed.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '==='.slice((b64.length + 3) % 4)
    const bin = atob(pad)
    if (bin.length < 4) return null
    const size = bin.charCodeAt(0)
    if (size < 4 || size > 12) return null
    const difficulty = DIFFICULTIES[bin.charCodeAt(1)] ?? 'easy'
    const solLen = bin.charCodeAt(2)
    const cells = size * size
    if (solLen < 1 || bin.length !== 3 + cells + solLen) return null
    const regions: number[] = []
    for (let i = 0; i < cells; i++) regions.push(bin.charCodeAt(3 + i))
    const solution: number[] = []
    const seen = new Set<number>()
    for (let i = 0; i < solLen; i++) {
      const s = bin.charCodeAt(3 + cells + i)
      if (s >= cells || seen.has(s)) return null
      seen.add(s)
      solution.push(s)
    }
    const puzzle: Puzzle = {
      id,
      name: name?.trim() || 'Shared board',
      size,
      regions,
      solution,
      difficulty,
    }
    rememberGeneratedPuzzle(puzzle)
    return puzzle
  } catch {
    return null
  }
}

function layoutField(board: Puzzle | null | undefined, puzzleId: string): string | undefined {
  if (!board || board.id !== puzzleId || isCatalogId(puzzleId)) return undefined
  if (board.size < 4 || board.regions.length !== board.size * board.size || board.solution.length < 1) {
    return undefined
  }
  return packBoardLayout(board)
}

function attachSharedLayout(puzzleId: string, name: unknown, packed: unknown) {
  if (typeof packed !== 'string' || isCatalogId(puzzleId)) return
  registerSharedBoard(puzzleId, typeof name === 'string' ? name : undefined, packed)
}

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

export function challengeLinkPayload(c: Challenge, board?: Puzzle | null): Record<string, string | number> {
  const email = linkEmail(c.fromEmail)
  const layout = layoutField(board, c.puzzleId)
  return {
    c: c.code,
    p: c.puzzleId,
    f: c.fromName,
    ...(email ? { e: email } : {}),
    m: c.message,
    ...(c.scoreMs != null ? { t: c.scoreMs } : {}),
    ...(c.scorePts != null ? { s: c.scorePts } : {}),
    ...(c.badgePower != null ? { bp: c.badgePower } : {}),
    ...(c.bonusPct != null ? { bb: c.bonusPct } : {}),
    ...(c.puzzleName ? { pn: c.puzzleName } : {}),
    ...(c.difficulty ? { d: c.difficulty } : {}),
    ...(layout ? { b: layout } : {}),
  }
}

function challengeFromData(data: unknown): Omit<Challenge, 'createdAt'> | null {
  const wire = challengeFromPayload(data)
  if (!wire) return null
  attachSharedLayout(wire.puzzleId, wire.puzzleName, wire.layout)
  return {
    code: wire.code,
    puzzleId: wire.puzzleId,
    fromName: wire.fromName,
    fromEmail: wire.fromEmail,
    message: wire.message,
    scoreMs: wire.scoreMs,
    scorePts: wire.scorePts,
    badgePower: wire.badgePower,
    bonusPct: wire.bonusPct,
    puzzleName: wire.puzzleName,
    difficulty: wire.difficulty,
  }
}

export function encodeChallengeLink(c: Challenge, board?: Puzzle | null): string {
  return publicLinkWithHash(`challenge=${toB64Url(challengeLinkPayload(c, board))}`)
}

export function parseChallengeFromHash(hash: string): Omit<Challenge, 'createdAt'> | null {
  const m = hash.match(/challenge=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    return challengeFromData(fromB64Url(m[1]))
  } catch {
    return null
  }
}

/** Save a short /c/<id> link. The long hash link is the fallback when the save fails. */
export async function shareChallengeLink(c: Challenge, board?: Puzzle | null): Promise<string> {
  const fallback = encodeChallengeLink(c, board)
  const id = await publishShare('challenge', challengeLinkPayload(c, board))
  return id ? publicShortLink(id) : fallback
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

export function duelLinkPayload(d: DuelResult, board?: Puzzle | null): Record<string, string | number> {
  const layout = layoutField(board, d.puzzleId)
  return {
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
    ...(layout ? { b: layout } : {}),
  }
}

function duelFromData(data: unknown): DuelResult | null {
  const wire = duelFromPayload(data)
  if (!wire) return null
  attachSharedLayout(wire.puzzleId, wire.puzzleName, wire.layout)
  return {
    code: wire.code,
    puzzleId: wire.puzzleId,
    puzzleName: wire.puzzleName,
    difficulty: wire.difficulty,
    aName: wire.aName,
    aMs: wire.aMs,
    aPts: wire.aPts,
    aPower: wire.aPower,
    aBonus: wire.aBonus,
    bName: wire.bName,
    bMs: wire.bMs,
    bPts: wire.bPts,
    bPower: wire.bPower,
    bBonus: wire.bBonus,
  }
}

export function encodeDuelLink(d: DuelResult, board?: Puzzle | null): string {
  return publicLinkWithHash(`duel=${toB64Url(duelLinkPayload(d, board))}`)
}

export function parseDuelFromHash(hash: string): DuelResult | null {
  const m = hash.match(/duel=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try {
    return duelFromData(fromB64Url(m[1]))
  } catch {
    return null
  }
}

export async function shareDuelLink(d: DuelResult, board?: Puzzle | null): Promise<string> {
  const fallback = encodeDuelLink(d, board)
  const id = await publishShare('duel', duelLinkPayload(d, board))
  return id ? publicShortLink(id) : fallback
}

async function publishShare(kind: 'challenge' | 'duel', payload: Record<string, string | number>): Promise<string | null> {
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, payload }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: unknown }
    return typeof data.id === 'string' && isShareId(data.id) ? data.id : null
  } catch {
    return null
  }
}

export async function fetchShare(id: string): Promise<{ kind: 'challenge' | 'duel'; challenge?: Omit<Challenge, 'createdAt'>; duel?: DuelResult } | null> {
  if (!isShareId(id)) return null
  try {
    const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { kind?: unknown; payload?: unknown }
    if (data.kind === 'challenge') {
      const challenge = challengeFromData(data.payload)
      return challenge ? { kind: 'challenge', challenge } : null
    }
    if (data.kind === 'duel') {
      const duel = duelFromData(data.payload)
      return duel ? { kind: 'duel', duel } : null
    }
    return null
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
  const prose = `${c.message}${scoreLine}\nBoard: ${board}\nCode: ${c.code}\n\n— Roman's Game`
  const body = encodeURIComponent(mailBody(prose, link))
  return `mailto:${to}?subject=${subject}&body=${body}`
}
