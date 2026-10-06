/**
 * 9.30-i: ask the board worker for a Remix / Endless board. Falls back to building on the main
 * thread (after a paint) if workers aren't available. Same inputs give the same board either way.
 */
import type { Difficulty, Puzzle } from './types'
import { buildEndlessBoard, buildRemixBoard, type RemixSize } from './remix'

type Job = { kind: 'remix'; set: number; size: RemixSize } | { kind: 'endless'; difficulty: Difficulty; seed: number }

let worker: Worker | null | undefined
let nextJob = 1
const waiting = new Map<number, { job: Job; done: (p: Puzzle | null) => void }>()

function onMain(job: Job): Promise<Puzzle | null> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      try {
        resolve(job.kind === 'remix' ? buildRemixBoard(job.set, job.size) : buildEndlessBoard(job.difficulty, job.seed))
      } catch {
        resolve(null)
      }
    }, 30)
  })
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./boardWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ job: number; puzzle: Puzzle | null }>) => {
      const w = waiting.get(e.data.job)
      waiting.delete(e.data.job)
      w?.done(e.data.puzzle)
    }
    worker.onerror = () => {
      // Worker broke: finish anything waiting on the main thread and stop using it
      worker?.terminate()
      worker = null
      for (const [id, w] of waiting) {
        waiting.delete(id)
        void onMain(w.job).then(w.done)
      }
    }
  } catch {
    worker = null
  }
  return worker
}

function run(job: Job): Promise<Puzzle | null> {
  const w = getWorker()
  if (!w) return onMain(job)
  return new Promise((resolve) => {
    const id = nextJob++
    waiting.set(id, { job, done: resolve })
    w.postMessage({ job: id, ...job })
  })
}

export function buildRemixInBackground(set: number, size: RemixSize): Promise<Puzzle | null> {
  return run({ kind: 'remix', set, size })
}

export function buildEndlessInBackground(difficulty: Difficulty): Promise<Puzzle | null> {
  return run({ kind: 'endless', difficulty, seed: (Math.random() * 0xffffffff) >>> 0 })
}
