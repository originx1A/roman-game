/* Reconstructed from https://roman-game.surge.sh production JS (index-ChNfA4F8.js).
 * Logic matches the deployed build; formatting/names may differ from original source.
 */

import type { Challenge, ClearRecord, Profile } from './types'

const KEYS = {
  profile: 'roman.profile.v1',
  guestProgress: 'roman.guest.v1',
  settings: 'roman.settings.v1',
  challenges: 'roman.challenges.v1',
  boardDraft: 'roman.draft.v1',
  wallet: 'roman.wallet.v1',
} as const

export interface Settings {
  sound: boolean
  voice: boolean
  reduceMotion: boolean
}

export interface Wallet {
  coins: number
  freeHints: number
  shields: number
  spins: number
  achievements: string[]
  totalWins: number
  perfectWins: number
  totalMistakes: number
  critterStash: number
}

const DEFAULT_SETTINGS: Settings = { sound: true, voice: true, reduceMotion: false }

export const DEFAULT_WALLET: Wallet = {
  coins: 50,
  freeHints: 2,
  shields: 0,
  spins: 0,
  achievements: [],
  totalWins: 0,
  perfectWins: 0,
  totalMistakes: 0,
  critterStash: 0,
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) }
}

export function saveSettings(s: Settings) {
  write(KEYS.settings, s)
}

export function loadWallet(): Wallet {
  const w = read<Partial<Wallet>>(KEYS.wallet, {})
  return {
    ...DEFAULT_WALLET,
    ...w,
    achievements: w.achievements ?? DEFAULT_WALLET.achievements,
    critterStash: w.critterStash ?? 0,
  }
}

export function saveWallet(w: Wallet) {
  write(KEYS.wallet, w)
}

export function loadProfile(): Profile | null {
  return read<Profile | null>(KEYS.profile, null)
}

function saveProfile(p: Profile) {
  write(KEYS.profile, p)
}

function clearProfile() {
  localStorage.removeItem(KEYS.profile)
}

function loadGuest(): { clears: ClearRecord[]; totalScore: number } {
  return read(KEYS.guestProgress, { clears: [], totalScore: 0 })
}

function saveGuest(g: { clears: ClearRecord[]; totalScore: number }) {
  write(KEYS.guestProgress, g)
}

export function getProgress(): { clears: ClearRecord[]; totalScore: number } {
  const p = loadProfile()
  return p ? { clears: p.clears, totalScore: p.totalScore } : loadGuest()
}

export function recordClear(e: {
  puzzleId: string
  elapsedMs: number
  score: number
  hintsUsed: number
}): { clears: ClearRecord[]; totalScore: number } {
  const profile = loadProfile()
  const base = profile
    ? { clears: [...profile.clears], totalScore: profile.totalScore }
    : loadGuest()
  const existing = base.clears.find((c) => c.puzzleId === e.puzzleId)
  let clears: ClearRecord[]
  if (!existing) {
    clears = [
      ...base.clears,
      {
        puzzleId: e.puzzleId,
        bestMs: e.elapsedMs,
        bestScore: e.score,
        clears: 1,
        hintsOnBest: e.hintsUsed,
        clearedAt: new Date().toISOString(),
      },
    ]
  } else {
    const better = e.score > existing.bestScore
    clears = base.clears.map((c) =>
      c.puzzleId === e.puzzleId
        ? {
            ...c,
            clears: c.clears + 1,
            bestScore: better ? e.score : c.bestScore,
            bestMs: better ? e.elapsedMs : c.bestMs,
            hintsOnBest: better ? e.hintsUsed : c.hintsOnBest,
            clearedAt: better ? new Date().toISOString() : c.clearedAt,
          }
        : c,
    )
  }
  const totalScore = clears.reduce((sum, c) => sum + c.bestScore, 0)
  const out = { clears, totalScore }
  if (profile) saveProfile({ ...profile, clears, totalScore })
  else saveGuest(out)
  return out
}

export function signInWithEmail(email: string, displayName?: string): Profile {
  const n = email.trim().toLowerCase()
  const guest = loadGuest()
  const existing = loadProfile()
  if (existing && existing.email === n) return existing
  const profile: Profile = {
    email: n,
    displayName: (
      displayName?.trim() ||
      n.split('@')[0].replace(/[._]/g, ' ') ||
      'Player'
    ).replace(/\b\w/g, (ch) => ch.toUpperCase()),
    createdAt: new Date().toISOString(),
    totalScore: guest.totalScore,
    clears: guest.clears,
  }
  saveProfile(profile)
  return profile
}

export function signOutKeepDevice() {
  const p = loadProfile()
  if (p) saveGuest({ clears: p.clears, totalScore: p.totalScore })
  clearProfile()
}

export function loadChallenges(): Challenge[] {
  return read<Challenge[]>(KEYS.challenges, [])
}

function saveChallenges(list: Challenge[]) {
  write(KEYS.challenges, list)
}

export function addChallenge(c: Challenge) {
  const next = loadChallenges().filter((x) => x.code !== c.code)
  next.unshift(c)
  saveChallenges(next.slice(0, 40))
}

export function saveDraft(draft: unknown | null) {
  if (draft) write(KEYS.boardDraft, draft)
  else localStorage.removeItem(KEYS.boardDraft)
}

export function loadDraft<T = unknown>(): T | null {
  return read<T | null>(KEYS.boardDraft, null)
}

export function exportSaveJson(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: loadProfile(),
      guest: loadGuest(),
      settings: loadSettings(),
      challenges: loadChallenges(),
      wallet: loadWallet(),
    },
    null,
    2,
  )
}

export function importSaveJson(raw: string): boolean {
  try {
    const data = JSON.parse(raw)
    if (data.profile) saveProfile(data.profile)
    if (data.guest) saveGuest(data.guest)
    if (data.settings) saveSettings(data.settings)
    if (data.challenges) saveChallenges(data.challenges)
    if (data.wallet) saveWallet({ ...DEFAULT_WALLET, ...data.wallet })
    return true
  } catch {
    return false
  }
}
