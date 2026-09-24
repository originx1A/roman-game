import type { ThemeId } from './themes'

export type { ThemeId }

export type CellState = 'empty' | 'mark' | 'stone'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

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
}

export interface Draft {
  puzzleId: string
  cells: CellState[]
  elapsedMs: number
  hintsUsed: number
  startedAt: string
}

export type Screen =
  | 'home'
  | 'levels'
  | 'play'
  | 'profile'
  | 'challenge'
  | 'how'
  | 'rewards'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
}

export const REGION_HUES = [168, 28, 210, 48, 320, 112, 255, 8]
