export type CellState = 'empty' | 'mark' | 'stone'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type ThemeId =
  | 'classic'
  | 'cosmic'
  | 'ruins'
  | 'neon'
  | 'ocean'
  | 'ember'
  | 'crystal'

export interface Puzzle {
  id: string
  name: string
  size: number
  regions: number[]
  solution: number[]
  difficulty: Difficulty
  theme?: ThemeId
}

export interface ClearRecord {
  puzzleId: string
  bestMs: number
  bestScore: number
  clears: number
  hintsOnBest: number
  clearedAt: string
}

export interface Profile {
  email: string
  displayName: string
  createdAt: string
  totalScore: number
  clears: ClearRecord[]
}

export interface Challenge {
  code: string
  puzzleId: string
  fromEmail: string
  fromName: string
  message: string
  createdAt: string
  /** Optional target email for invite */
  toEmail?: string
  /** Challenger's time in ms (shown to the friend) */
  scoreMs?: number
  /** Challenger's score points */
  scorePts?: number
}

/** Head-to-head result packed in a #duel= link so both can see scores */
export interface DuelResult {
  code: string
  puzzleId: string
  aName: string
  aMs: number
  aPts: number
  bName: string
  bMs: number
  bPts: number
}

export type Screen =
  | 'home'
  | 'levels'
  | 'play'
  | 'profile'
  | 'challenge'
  | 'how'
  | 'rewards'
  | 'duel'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}

export const REGION_HUES = [168, 28, 210, 48, 320, 112, 255, 8]
