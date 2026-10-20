import { rankScores, type PublicScore } from './leaderboard.ts'

/**
 * Text-only Unseen lines that point at the leaderboard. No voice clips.
 * Tony reviews this wording. The low-rank line is his sentence.
 */
export const LEADERBOARD_TEASE = {
  low: 'Go check out your score on the scoreboard. Scroll down... further down... more down.',
  best: "New best. Don't frame it yet. Go see if the scoreboard even noticed.",
  top: 'Top ten. Your name is up where people can see it. Go look before someone sits on it.',
  passed: 'Someone just walked past you on the scoreboard. I watched. It was a little rude. Go look.',
} as const

export type TeaseSituation = keyof typeof LEADERBOARD_TEASE

const SEEN_KEY = 'roman.lb.seen.v1'

export interface BoardSeen {
  name: string
  rank: number
  situation: TeaseSituation | null
}

export function loadBoardSeen(you: string): BoardSeen | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null') as BoardSeen | null
    if (!raw || raw.name.trim().toLowerCase() !== you.trim().toLowerCase()) return null
    return raw
  } catch {
    return null
  }
}

export function saveBoardSeen(you: string, rank: number, situation: TeaseSituation | null): void {
  try {
    const prev = loadBoardSeen(you)
    const next: BoardSeen = { name: you.trim(), rank, situation: situation ?? prev?.situation ?? null }
    localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    /* private mode: the line can repeat next time */
  }
}

export interface TeaseInput {
  you: string
  score: number
  timeSeconds: number
  mode: string
  rows: PublicScore[]
  previousRank: number | null
  lastSituation: TeaseSituation | null
  now?: Date
}

export interface Tease {
  text: string | null
  situation: TeaseSituation | null
  rank: number | null
}

function better(score: number, time: number, other: { score: number; timeSeconds: number }): boolean {
  if (score !== other.score) return score > other.score
  return time < other.timeSeconds
}

/** Drop one copy of the run we just finished, in case it already uploaded. */
function withoutThisRun(rows: PublicScore[], you: string, score: number, timeSeconds: number): PublicScore[] {
  const mine = you.trim().toLowerCase()
  let dropped = false
  return rows.filter((row) => {
    if (dropped) return true
    const same =
      row.name.trim().toLowerCase() === mine &&
      row.score === score &&
      Math.abs(row.time_seconds - timeSeconds) < 1.5
    if (!same) return true
    dropped = true
    return false
  })
}

/**
 * Pick at most one line for the moment a scored game has just ended.
 * A standing place (top ten, or down the list) is not repeated every win.
 */
export function leaderboardTease(input: TeaseInput): Tease {
  const you = input.you.trim()
  if (!you) return { text: null, situation: null, rank: null }
  const now = input.now ?? new Date()
  const prior = withoutThisRun(input.rows, you, input.score, input.timeSeconds)
  const before = rankScores(prior, 'all', now).find((row) => row.name.toLowerCase() === you.toLowerCase())
  const afterRows: PublicScore[] = [
    ...prior,
    {
      name: you,
      score: input.score,
      time_seconds: input.timeSeconds,
      mode: input.mode,
      created_at: now.toISOString(),
    },
  ]
  const placed = rankScores(afterRows, 'all', now).find((row) => row.name.toLowerCase() === you.toLowerCase())
  if (!placed) return { text: null, situation: null, rank: null }

  const isNewBest = !before || better(input.score, input.timeSeconds, before)
  const passed = input.previousRank != null && placed.rank > input.previousRank
  let situation: TeaseSituation
  if (passed) situation = 'passed'
  else if (isNewBest && placed.rank <= 10) situation = 'top'
  else if (isNewBest) situation = 'best'
  else if (placed.rank <= 10) situation = 'top'
  else situation = 'low'

  const repeat = (situation === 'top' || situation === 'low') && situation === input.lastSituation
  return {
    text: repeat ? null : LEADERBOARD_TEASE[situation],
    situation,
    rank: placed.rank,
  }
}
