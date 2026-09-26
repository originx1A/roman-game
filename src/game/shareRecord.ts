/** Compact challenge/duel records stored for /c/<id> links and the older hash links. */

export type ShareKind = 'challenge' | 'duel'

export interface ShareRecord {
  kind: ShareKind
  payload: Record<string, string | number>
}

export interface ParsedChallenge {
  code: string
  puzzleId: string
  fromName: string
  fromEmail: string
  message: string
  scoreMs?: number
  scorePts?: number
  badgePower?: number
  bonusPct?: number
  puzzleName?: string
  difficulty?: string
  layout?: string
}

export interface ParsedDuel {
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
  layout?: string
}

const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'
const CHALLENGE_KEYS = ['c', 'p', 'f', 'e', 'm', 't', 's', 'bp', 'bb', 'pn', 'd', 'b'] as const
const DUEL_KEYS = ['c', 'p', 'an', 'am', 'ap', 'bn', 'bm', 'bp', 'pn', 'd', 'aw', 'ab', 'bw', 'bb', 'b'] as const

export function isShareId(id: string): boolean {
  return /^[a-z0-9]{8}$/.test(id)
}

export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let id = ''
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length]
  return id
}

function flatPayload(data: unknown, keys: readonly string[]): Record<string, string | number> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const src = data as Record<string, unknown>
  const out: Record<string, string | number> = {}
  for (const key of keys) {
    if (!(key in src) || src[key] == null) continue
    const value = src[key]
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null
      out[key] = value
      continue
    }
    if (typeof value === 'string') {
      const max = key === 'b' ? 8000 : key === 'm' ? 500 : 200
      if (value.length > max) return null
      out[key] = value
      continue
    }
    return null
  }
  return out
}

export function sanitizeShare(body: unknown): ShareRecord | null {
  if (!body || typeof body !== 'object') return null
  const kind = (body as { kind?: unknown }).kind
  const payload = (body as { payload?: unknown }).payload
  if (kind === 'challenge') {
    const flat = flatPayload(payload, CHALLENGE_KEYS)
    if (!flat || typeof flat.p !== 'string' || !flat.p || typeof flat.c !== 'string' || !flat.c) return null
    return { kind, payload: flat }
  }
  if (kind === 'duel') {
    const flat = flatPayload(payload, DUEL_KEYS)
    if (!flat || typeof flat.p !== 'string' || !flat.p || typeof flat.am !== 'number' || typeof flat.bm !== 'number') {
      return null
    }
    return { kind, payload: flat }
  }
  return null
}

export function challengeFromPayload(data: unknown): ParsedChallenge | null {
  const flat = flatPayload(data, CHALLENGE_KEYS)
  if (!flat || typeof flat.p !== 'string' || !flat.p || typeof flat.c !== 'string' || !flat.c) return null
  return {
    code: flat.c,
    puzzleId: flat.p,
    fromName: typeof flat.f === 'string' && flat.f ? flat.f : 'A friend',
    fromEmail: typeof flat.e === 'string' && flat.e ? flat.e : 'friend@roman.game',
    message: typeof flat.m === 'string' && flat.m ? flat.m : 'Can you beat Roman on this board?',
    scoreMs: typeof flat.t === 'number' ? flat.t : undefined,
    scorePts: typeof flat.s === 'number' ? flat.s : undefined,
    badgePower: typeof flat.bp === 'number' ? flat.bp : undefined,
    bonusPct: typeof flat.bb === 'number' ? flat.bb : undefined,
    puzzleName: typeof flat.pn === 'string' ? flat.pn : undefined,
    difficulty: typeof flat.d === 'string' ? flat.d : undefined,
    layout: typeof flat.b === 'string' ? flat.b : undefined,
  }
}

export function duelFromPayload(data: unknown): ParsedDuel | null {
  const flat = flatPayload(data, DUEL_KEYS)
  if (!flat || typeof flat.p !== 'string' || !flat.p || typeof flat.am !== 'number' || typeof flat.bm !== 'number') {
    return null
  }
  return {
    code: typeof flat.c === 'string' && flat.c ? flat.c : 'DUEL',
    puzzleId: flat.p,
    puzzleName: typeof flat.pn === 'string' ? flat.pn : undefined,
    difficulty: typeof flat.d === 'string' ? flat.d : undefined,
    aName: typeof flat.an === 'string' && flat.an ? flat.an : 'Player A',
    aMs: flat.am,
    aPts: typeof flat.ap === 'number' ? flat.ap : 0,
    aPower: typeof flat.aw === 'number' ? flat.aw : undefined,
    aBonus: typeof flat.ab === 'number' ? flat.ab : undefined,
    bName: typeof flat.bn === 'string' && flat.bn ? flat.bn : 'Player B',
    bMs: flat.bm,
    bPts: typeof flat.bp === 'number' ? flat.bp : 0,
    bPower: typeof flat.bw === 'number' ? flat.bw : undefined,
    bBonus: typeof flat.bb === 'number' ? flat.bb : undefined,
    layout: typeof flat.b === 'string' ? flat.b : undefined,
  }
}
