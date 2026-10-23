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

/** A phone can create the module worker and then never answer. Don't leave Remix on "Building…". */
const REMIX_WAIT_MS: Record<number, number> = { 5: 4000, 6: 7000, 7: 12000, 8: 22000 }

function waitMs(job: Job): number {
  if (job.kind === 'endless') return 12000
  return REMIX_WAIT_MS[job.size] ?? 8000
}

function dropWorker() {
  try {
    worker?.terminate()
  } catch {
    /* already gone */
  }
  worker = null
}

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
      const stuck = [...waiting.entries()]
      waiting.clear()
      dropWorker()
      for (const [, w] of stuck) void onMain(w.job).then(w.done)
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
    let settled = false
    const finish = (p: Puzzle | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      waiting.delete(id)
      resolve(p)
    }
    const timer = window.setTimeout(() => {
      const stuck = [...waiting.entries()]
      waiting.clear()
      dropWorker()
      for (const [oid, ow] of stuck) {
        if (oid === id) continue
        void onMain(ow.job).then(ow.done)
      }
      void onMain(job).then(finish)
    }, waitMs(job))
    waiting.set(id, { job, done: finish })
    try {
      w.postMessage({ job: id, ...job })
    } catch {
      dropWorker()
      void onMain(job).then(finish)
    }
  })
}

export function buildRemixInBackground(set: number, size: RemixSize): Promise<Puzzle | null> {
  return run({ kind: 'remix', set, size })
}

export function buildEndlessInBackground(difficulty: Difficulty): Promise<Puzzle | null> {
  return run({ kind: 'endless', difficulty, seed: (Math.random() * 0xffffffff) >>> 0 })
}
