import { sanitizeTips } from './voiceTips'
import { sanitizeMeter } from './buddyHunt'
import { PETS_KEY, sanitizePets, type PetState } from './pets'
import type { Challenge, ClearRecord, Profile } from './types'
import { DEFAULT_WALLET, type Wallet } from './rewards'
import { migrateRecords, type ComboState, type RecordsBlob, type RunMode } from './replay'

const KEYS = {
  profile: 'roman.profile.v1',
  guestProgress: 'roman.guest.v1',
  settings: 'roman.settings.v1',
  challenges: 'roman.challenges.v1',
  boardDraft: 'roman.draft.v1',
  wallet: 'roman.wallet.v1',
  generated: 'roman.generated.v1',
  remix: 'roman.remix.v1',
  endless: 'roman.endless.v1',
  buddyMeter: 'roman.buddymeter.v1',
  records: 'roman.records.v1',
  tips: 'roman.tips.v1',
  pets: PETS_KEY,
} as const

export interface Settings {
  sound: boolean
  voice: boolean
  reduceMotion: boolean
  /** Name on share cards/text (local only). Empty = "I scored…" */
  playerName?: string
  /** The one-time "what should we call you?" prompt was shown */
  namePrompted?: boolean
  /** How to play was shown once (it opens by itself before the first board) */
  howSeen?: boolean
  /** Voice tips (teaching lines). Undefined = on. */
  voiceTips?: boolean
  /** Buddy Parade between games (every 5-7 wins). Undefined = on. */
  parade?: boolean
}

export const PLAYER_NAME_MAX = 16

/** Trim, drop control characters, squash spaces, cap at 16 characters */
export function cleanPlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  return Array.from(s).slice(0, PLAYER_NAME_MAX).join('').trim()
}

export interface ProgressBlob {
  clears: ClearRecord[]
  totalScore: number
}

export interface BoardDraft {
  puzzleId: string
  cells: string[]
  elapsedMs: number
  hintsUsed: number
  startedAt: string
  /** Undo steps, oldest first. Older saves have none. */
  past?: string[][]
  /** Redo steps, next first. */
  future?: string[][]
  /** This attempt had a wrong buddy, a rescue or a revive (not a perfect win). */
  flawed?: boolean
  /** Replay challenge state for this attempt (older saves have none) */
  mode?: RunMode
  /** Daily Challenge date key when this attempt is today's first (scored) daily try */
  daily?: string
  combo?: ComboState
  undos?: number
  splits?: number[]
}

const defaultSettings: Settings = { sound: true, voice: true, reduceMotion: false }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadSettings(): Settings {
  return { ...defaultSettings, ...read(KEYS.settings, {}) }
}

export function saveSettings(s: Settings) {
  write(KEYS.settings, s)
}

export function loadWallet(): Wallet {
  const raw = read<Partial<Wallet>>(KEYS.wallet, {})
  const merged = {
    ...DEFAULT_WALLET,
    ...raw,
    achievements: raw.achievements ?? DEFAULT_WALLET.achievements,
    badgeRanks: raw.badgeRanks ?? {},
    critterStash: raw.critterStash ?? 0,
    // Older builds saved the Full hearts prize as a flag that never paid out; honor it once.
    bonusHearts: (raw.bonusHearts ?? 0) + (raw.heartRefillPending ? 1 : 0),
    heartRefillPending: undefined,
  }
  // Lazy import-safe normalize: unlock ranks for legacy achievement lists
  const ranks: Record<string, number> = { ...merged.badgeRanks }
  for (const id of merged.achievements) {
    if ((ranks[id] ?? 0) < 1) ranks[id] = 1
  }
  return { ...merged, badgeRanks: ranks }
}

export function saveWallet(wallet: Wallet) {
  write(KEYS.wallet, wallet)
}

export function loadProfile(): Profile | null {
  return read<Profile | null>(KEYS.profile, null)
}

export function saveProfile(profile: Profile) {
  write(KEYS.profile, profile)
}

export function clearProfile() {
  localStorage.removeItem(KEYS.profile)
}

export function loadGuestProgress(): ProgressBlob {
  return read(KEYS.guestProgress, { clears: [], totalScore: 0 })
}

export function saveGuestProgress(p: ProgressBlob) {
  write(KEYS.guestProgress, p)
}

/** Active score source: signed-in profile or guest device save */
export function getProgress(): ProgressBlob {
  const profile = loadProfile()
  if (profile) {
    return { clears: profile.clears, totalScore: profile.totalScore }
  }
  return loadGuestProgress()
}

export function recordClear(input: {
  puzzleId: string
  elapsedMs: number
  score: number
  hintsUsed: number
}): ProgressBlob {
  const profile = loadProfile()
  const base = profile
    ? { clears: [...profile.clears], totalScore: profile.totalScore }
    : loadGuestProgress()

  const existing = base.clears.find((c) => c.puzzleId === input.puzzleId)
  let clears: ClearRecord[]
  if (!existing) {
    clears = [
      ...base.clears,
      {
        puzzleId: input.puzzleId,
        bestMs: input.elapsedMs,
        bestScore: input.score,
        clears: 1,
        hintsOnBest: input.hintsUsed,
        clearedAt: new Date().toISOString(),
        lastClearedAt: new Date().toISOString(),
      },
    ]
  } else {
    const better = input.score > existing.bestScore
    clears = base.clears.map((c) =>
      c.puzzleId !== input.puzzleId
        ? c
        : {
            ...c,
            clears: c.clears + 1,
            bestScore: better ? input.score : c.bestScore,
            bestMs: better ? input.elapsedMs : c.bestMs,
            hintsOnBest: better ? input.hintsUsed : c.hintsOnBest,
            clearedAt: better ? new Date().toISOString() : c.clearedAt,
            lastClearedAt: new Date().toISOString(),
          },
    )
  }

  const totalScore = clears.reduce((sum, c) => sum + c.bestScore, 0)
  const next = { clears, totalScore }

  if (profile) {
    saveProfile({ ...profile, clears, totalScore })
  } else {
    saveGuestProgress(next)
  }
  return next
}

export function signInWithEmail(email: string, displayName?: string): Profile {
  const normalized = email.trim().toLowerCase()
  const guest = loadGuestProgress()
  const existing = loadProfile()

  // Same email → keep; new email merges guest clears if profile empty
  if (existing && existing.email === normalized) {
    return existing
  }

  const name =
    displayName?.trim() ||
    normalized.split('@')[0].replace(/[._]/g, ' ') ||
    'Player'

  const profile: Profile = {
    email: normalized,
    displayName: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    createdAt: new Date().toISOString(),
    totalScore: guest.totalScore,
    clears: guest.clears,
  }
  saveProfile(profile)
  return profile
}

export function signOutKeepDevice() {
  const profile = loadProfile()
  if (profile) {
    saveGuestProgress({ clears: profile.clears, totalScore: profile.totalScore })
  }
  clearProfile()
}

export function loadChallenges(): Challenge[] {
  return read(KEYS.challenges, [])
}

export function saveChallenges(list: Challenge[]) {
  write(KEYS.challenges, list)
}

export function addChallenge(c: Challenge) {
  const list = loadChallenges().filter((x) => x.code !== c.code)
  list.unshift(c)
  saveChallenges(list.slice(0, 40))
}

export function saveDraft(draft: BoardDraft | null) {
  if (!draft) localStorage.removeItem(KEYS.boardDraft)
  else write(KEYS.boardDraft, draft)
}

export function loadDraft(): BoardDraft | null {
  return read(KEYS.boardDraft, null)
}

/** Personal bests, stars, Trial and Daily state. Missing/broken data falls back safely. */
export function loadRecords(boardInfo: (id: string) => { size: number; difficulty?: string } | undefined): RecordsBlob {
  let raw: unknown = null
  try {
    raw = JSON.parse(localStorage.getItem(KEYS.records) || 'null')
  } catch {
    raw = null
  }
  let clears: ClearRecord[] = []
  try {
    clears = getProgress().clears ?? []
  } catch {
    clears = []
  }
  return migrateRecords(raw, clears, boardInfo)
}

export function saveRecords(blob: RecordsBlob) {
  try {
    write(KEYS.records, blob)
  } catch {
    /* storage full or blocked: keep playing */
  }
}

export function exportSaveJson(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      guest: loadGuestProgress(),
      settings: loadSettings(),
      challenges: loadChallenges(),
      wallet: loadWallet(),
      records: read(KEYS.records, null),
      pets: read(KEYS.pets, null),
    },
    null,
    2,
  )
}

export function importSaveJson(raw: string): boolean {
  try {
    const data = JSON.parse(raw)
    if (data.profile) saveProfile(data.profile)
    if (data.guest) saveGuestProgress(data.guest)
    if (data.settings) saveSettings(data.settings)
    if (data.challenges) saveChallenges(data.challenges)
    if (data.wallet) saveWallet({ ...DEFAULT_WALLET, ...data.wallet })
    if (data.records && data.records.v === 1) write(KEYS.records, data.records)
    if (data.pets) write(KEYS.pets, sanitizePets(data.pets))
    return true
  } catch {
    return false
  }
}

/** Runtime-generated boards (endless random) — keep a rolling cache */
const GENERATED_MAX = 40

export function loadGeneratedPuzzles(): Record<string, import('./types').Puzzle> {
  return read<Record<string, import('./types').Puzzle>>(KEYS.generated, {})
}

export function rememberGeneratedPuzzle(puzzle: import('./types').Puzzle) {
  const all = loadGeneratedPuzzles()
  all[puzzle.id] = puzzle
  const ids = Object.keys(all)
  if (ids.length > GENERATED_MAX) {
    for (const id of ids.slice(0, ids.length - GENERATED_MAX)) delete all[id]
  }
  write(KEYS.generated, all)
}

export function getGeneratedPuzzle(id: string): import('./types').Puzzle | undefined {
  return loadGeneratedPuzzles()[id]
}

/** 9.30-i: Remix boards built for the live set (older sets are dropped when a new set is saved) */
export function loadRemixBoards(set: number): Record<string, import('./types').Puzzle> {
  const c = read<{ set?: number; boards?: Record<string, import('./types').Puzzle> } | null>(KEYS.remix, null)
  return c && c.set === set && c.boards && typeof c.boards === 'object' ? c.boards : {}
}

export function saveRemixBoard(set: number, puzzle: import('./types').Puzzle) {
  try {
    write(KEYS.remix, { set, boards: { ...loadRemixBoards(set), [puzzle.id]: puzzle } })
  } catch {
    /* storage full: the board is rebuilt from its seed next time */
  }
}

export function getRemixBoard(id: string): import('./types').Puzzle | undefined {
  const c = read<{ boards?: Record<string, import('./types').Puzzle> } | null>(KEYS.remix, null)
  return c?.boards?.[id]
}

/** 9.30-i Endless mode: boards cleared (all sizes, and per size) */
export interface EndlessStats {
  cleared: number
  bySize: Record<string, number>
}

export function loadEndless(): EndlessStats {
  const e = read<Partial<EndlessStats> | null>(KEYS.endless, null)
  const cleared = typeof e?.cleared === 'number' && e.cleared >= 0 ? Math.floor(e.cleared) : 0
  const bySize: Record<string, number> = {}
  for (const [k, v] of Object.entries(e?.bySize ?? {})) if (typeof v === 'number' && v >= 0) bySize[k] = Math.floor(v)
  return { cleared, bySize }
}

export function noteEndlessClear(size: number): EndlessStats {
  const e = loadEndless()
  const next = { cleared: e.cleared + 1, bySize: { ...e.bySize, [size]: (e.bySize[size] ?? 0) + 1 } }
  try {
    write(KEYS.endless, next)
  } catch {
    /* keep playing */
  }
  return next
}

export function loadBuddyMeter(): import('./buddyHunt').BuddyMeter {
  return sanitizeMeter(read<unknown>(KEYS.buddyMeter, null))
}

export function saveBuddyMeter(meter: import('./buddyHunt').BuddyMeter) {
  write(KEYS.buddyMeter, meter)
}

export function loadTips(): import('./voiceTips').TipState {
  return sanitizeTips(read<unknown>(KEYS.tips, null))
}

export function saveTips(t: import('./voiceTips').TipState) {
  write(KEYS.tips, t)
}

/** 9.30-a: buddies (The Stable). Older saves have none: Solo, no coupons. */
export function loadPets(): PetState {
  return sanitizePets(read<unknown>(KEYS.pets, null))
}

export function savePets(p: PetState) {
  try {
    write(KEYS.pets, p)
  } catch {
    /* storage full / private mode: keep playing */
  }
}
