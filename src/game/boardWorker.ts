/** 9.30-i: builds Remix / Endless boards off the main thread (the 8×8 can take a while on a phone). */
import { buildEndlessBoard, buildRemixBoard, type RemixSize } from './remix'
import type { Difficulty } from './types'

export type BoardJob =
  | { job: number; kind: 'remix'; set: number; size: RemixSize }
  | { job: number; kind: 'endless'; difficulty: Difficulty; seed: number }

self.onmessage = (e: MessageEvent<BoardJob>) => {
  const m = e.data
  let puzzle = null
  try {
    puzzle = m.kind === 'remix' ? buildRemixBoard(m.set, m.size) : buildEndlessBoard(m.difficulty, m.seed)
  } catch {
    puzzle = null
  }
  ;(self as unknown as Worker).postMessage({ job: m.job, puzzle })
}
