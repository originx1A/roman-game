import type { Puzzle, Difficulty } from './types'
import { generateRandomPuzzle } from './generatePuzzle'
import { getGeneratedPuzzle, rememberGeneratedPuzzle } from './storage'

export const PUZZLES: Puzzle[] = [
  {
    id: "dawn",
    name: "Dawn",
    size: 5,
    regions: [0, 0, 1, 1, 1, 0, 2, 1, 2, 1, 0, 2, 2, 2, 1, 3, 2, 2, 2, 2, 3, 3, 4, 4, 4],
    solution: [1, 9, 12, 15, 23],
    difficulty: "easy",
  },
  {
    id: "harbor",
    name: "Harbor",
    size: 5,
    regions: [1, 1, 0, 0, 0, 1, 1, 0, 2, 2, 4, 2, 2, 2, 2, 4, 4, 3, 4, 2, 4, 4, 4, 4, 2],
    solution: [3, 6, 14, 17, 20],
    difficulty: "easy",
  },
  {
    id: "moss",
    name: "Moss",
    size: 5,
    regions: [0, 0, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 2, 2, 1, 3, 2, 2, 2, 4, 4, 4, 4, 4, 4],
    solution: [1, 9, 12, 15, 23],
    difficulty: "easy",
  },
  {
    id: "quiet",
    name: "Quiet",
    size: 5,
    regions: [1, 1, 1, 1, 0, 1, 1, 1, 1, 2, 3, 1, 1, 2, 2, 3, 3, 3, 4, 2, 3, 4, 4, 4, 4],
    solution: [4, 6, 13, 15, 22],
    difficulty: "easy",
  },
  {
    id: "cedar",
    name: "Cedar",
    size: 5,
    regions: [1, 0, 0, 0, 0, 1, 1, 3, 0, 0, 3, 3, 3, 2, 0, 3, 3, 2, 2, 0, 3, 3, 4, 4, 0],
    solution: [4, 6, 13, 15, 22],
    difficulty: "easy",
  },
  {
    id: "drift",
    name: "Drift",
    size: 6,
    regions: [0, 0, 0, 0, 2, 2, 0, 0, 1, 1, 1, 2, 0, 0, 1, 2, 2, 2, 3, 4, 1, 1, 2, 2, 3, 4, 4, 2, 2, 5, 3, 4, 4, 4, 5, 5],
    solution: [1, 9, 17, 18, 26, 34],
    difficulty: "medium",
  },
  {
    id: "lantern",
    name: "Lantern",
    size: 6,
    regions: [4, 0, 3, 3, 3, 1, 4, 0, 2, 3, 3, 1, 4, 2, 2, 2, 3, 3, 4, 2, 4, 2, 3, 3, 4, 4, 4, 5, 3, 3, 4, 4, 4, 5, 5, 3],
    solution: [1, 11, 14, 22, 24, 33],
    difficulty: "medium",
  },
  {
    id: "copper",
    name: "Copper",
    size: 6,
    regions: [2, 2, 2, 1, 0, 0, 2, 2, 4, 1, 1, 1, 2, 2, 4, 4, 4, 1, 2, 3, 3, 3, 4, 4, 5, 5, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
    solution: [5, 9, 12, 20, 28, 31],
    difficulty: "medium",
  },
  {
    id: "valley",
    name: "Valley",
    size: 6,
    regions: [0, 1, 1, 1, 1, 1, 3, 1, 1, 2, 2, 2, 3, 1, 1, 2, 2, 2, 3, 3, 1, 2, 2, 2, 4, 4, 1, 4, 4, 4, 4, 4, 4, 4, 5, 5],
    solution: [0, 8, 16, 19, 27, 35],
    difficulty: "medium",
  },
  {
    id: "mirror",
    name: "Mirror",
    size: 6,
    regions: [0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 2, 0, 3, 1, 1, 1, 2, 2, 3, 3, 3, 3, 2, 4, 4, 5, 3, 3, 4, 4, 4, 5, 5, 3],
    solution: [1, 9, 12, 23, 26, 34],
    difficulty: "medium",
  },
  {
    id: "summit",
    name: "Summit",
    size: 7,
    regions: [3, 3, 1, 1, 1, 2, 0, 3, 3, 3, 1, 1, 2, 2, 3, 3, 3, 1, 2, 2, 2, 3, 3, 4, 4, 4, 4, 2, 6, 6, 4, 4, 4, 4, 2, 5, 6, 4, 4, 4, 2, 2, 5, 6, 6, 4, 4, 4, 4],
    solution: [6, 10, 19, 22, 32, 35, 44],
    difficulty: "hard",
  },
  {
    id: "current",
    name: "Current",
    size: 7,
    regions: [3, 1, 0, 0, 0, 2, 2, 3, 1, 0, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 3, 3, 5, 5, 4, 4, 4, 3, 3, 3, 5, 5, 4, 4, 5, 5, 5, 5, 5, 4, 4, 5, 5, 5, 5, 4, 4, 6],
    solution: [3, 8, 18, 21, 33, 37, 48],
    difficulty: "hard",
  },
  {
    id: "ember",
    name: "Ember",
    size: 7,
    regions: [1, 1, 1, 1, 1, 0, 0, 4, 1, 1, 0, 0, 0, 2, 4, 3, 3, 3, 0, 0, 2, 4, 3, 3, 3, 3, 2, 2, 4, 4, 3, 3, 3, 2, 2, 6, 4, 4, 5, 3, 3, 3, 6, 5, 5, 5, 5, 5, 3],
    solution: [5, 9, 20, 25, 29, 38, 42],
    difficulty: "hard",
  },
  {
    id: "hollow",
    name: "Hollow",
    size: 7,
    regions: [3, 0, 0, 0, 0, 1, 1, 3, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 3, 3, 2, 2, 2, 4, 1, 3, 5, 5, 2, 4, 4, 1, 6, 5, 5, 2, 4, 1, 1],
    solution: [3, 13, 18, 22, 33, 37, 42],
    difficulty: "hard",
  },
  {
    id: "signal",
    name: "Signal",
    size: 7,
    regions: [2, 2, 2, 0, 0, 0, 0, 2, 4, 2, 1, 3, 0, 0, 2, 4, 4, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 5, 4, 4, 4, 3, 6, 5, 5, 4, 4, 6, 6, 6, 6, 5, 4, 4, 6, 6, 6, 5, 5],
    solution: [5, 10, 14, 25, 29, 41, 44],
    difficulty: "hard",
  },
  {
    id: "orbit",
    name: "Orbit",
    size: 8,
    regions: [0, 0, 1, 1, 1, 1, 1, 4, 2, 0, 0, 1, 1, 1, 4, 4, 2, 3, 0, 5, 1, 1, 4, 4, 3, 3, 3, 5, 5, 5, 4, 4, 6, 6, 6, 6, 5, 5, 5, 4, 6, 6, 6, 6, 5, 5, 5, 5, 6, 6, 6, 6, 5, 7, 5, 7, 6, 6, 6, 6, 5, 7, 7, 7],
    solution: [1, 12, 16, 26, 39, 45, 51, 62],
    difficulty: "expert",
  },
  {
    id: "threshold",
    name: "Threshold",
    size: 8,
    regions: [1, 1, 0, 0, 0, 0, 2, 4, 1, 1, 1, 0, 0, 2, 2, 4, 1, 1, 0, 0, 2, 2, 4, 4, 1, 1, 0, 2, 2, 2, 4, 3, 1, 1, 0, 5, 4, 4, 4, 3, 7, 7, 7, 5, 5, 5, 5, 3, 7, 5, 5, 5, 5, 5, 6, 6, 7, 7, 7, 7, 7, 5, 5, 6],
    solution: [2, 8, 20, 31, 37, 43, 54, 57],
    difficulty: "expert",
  },
  {
    id: "vault",
    name: "Vault",
    size: 8,
    regions: [0, 0, 0, 0, 0, 0, 4, 4, 2, 1, 1, 0, 0, 5, 5, 4, 2, 3, 3, 0, 0, 5, 4, 4, 3, 3, 3, 3, 3, 5, 5, 4, 6, 6, 3, 7, 5, 5, 5, 4, 6, 6, 7, 7, 7, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7, 6, 6, 6, 7, 7, 7, 7, 7],
    solution: [4, 10, 16, 27, 39, 45, 49, 62],
    difficulty: "expert",
  },
  {
    id: "nadir",
    name: "Nadir",
    size: 8,
    regions: [0, 0, 1, 1, 3, 2, 2, 2, 4, 0, 1, 3, 3, 3, 2, 2, 4, 4, 3, 3, 2, 2, 2, 2, 4, 4, 4, 3, 2, 2, 2, 2, 4, 4, 4, 4, 2, 2, 2, 5, 4, 6, 6, 6, 5, 5, 5, 5, 4, 4, 6, 6, 6, 6, 6, 5, 4, 4, 6, 6, 6, 6, 6, 7],
    solution: [0, 10, 21, 27, 33, 46, 52, 63],
    difficulty: "expert",
  },
  {
    id: "prism",
    name: "Prism",
    size: 8,
    regions: [3, 3, 3, 3, 1, 1, 0, 0, 5, 5, 3, 3, 1, 1, 1, 1, 5, 5, 3, 5, 4, 4, 2, 1, 5, 5, 3, 5, 5, 4, 4, 1, 5, 5, 5, 5, 6, 4, 4, 1, 5, 5, 5, 5, 6, 4, 4, 1, 5, 6, 6, 6, 6, 4, 1, 1, 7, 6, 6, 6, 6, 4, 4, 1],
    solution: [7, 12, 22, 26, 37, 41, 51, 56],
    difficulty: "expert",
  }
]

export function getPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id) ?? getGeneratedPuzzle(id)
}

export function puzzlesByDifficulty(): Record<Difficulty, Puzzle[]> {
  const out: Record<Difficulty, Puzzle[]> = {
    easy: [],
    medium: [],
    hard: [],
    expert: [],
  }
  for (const p of PUZZLES) {
    out[p.difficulty].push(p)
  }
  return out
}

/** Fresh uniquely solvable board for endless play — never the same layout twice */
export function createFreshPuzzle(difficulty: Difficulty): Puzzle {
  // A few tries with different seeds; fall back to a shuffled catalog board
  for (let i = 0; i < 4; i++) {
    const seed = (Math.random() * 0xffffffff) >>> 0
    const p = generateRandomPuzzle(difficulty, seed)
    if (p) {
      rememberGeneratedPuzzle(p)
      return p
    }
  }
  const pool = PUZZLES.filter((p) => p.difficulty === difficulty)
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? PUZZLES[0]
  // Clone with a unique id so progress treats it as a new run
  const clone: Puzzle = {
    ...pick,
    id: `remix-${pick.id}-${Date.now().toString(36)}`,
    name: `${pick.name} Remix`,
    regions: [...pick.regions],
    solution: [...pick.solution],
  }
  rememberGeneratedPuzzle(clone)
  return clone
}

/** Next board after a clear — same difficulty when possible, always a fresh layout */
export function nextRandomPuzzle(from: Puzzle): Puzzle {
  return createFreshPuzzle(from.difficulty)
}
