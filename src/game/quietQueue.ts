/** Quiet notices. They wait out an active round, then fade. Mute drops them. */

export interface QuietItem {
  id: number
  text: string
}

let seq = 1
let waiting: QuietItem[] = []
let current: QuietItem | null = null
let activeRound = false
let muted = false
let hideTimer: ReturnType<typeof setTimeout> | 0 = 0

function later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  return setTimeout(fn, ms)
}
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

export function quietSnapshot(): { current: QuietItem | null; waiting: number } {
  return { current, waiting: waiting.length }
}

export function onQuiet(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setQuietRound(active: boolean): void {
  activeRound = active
  if (!active) pump()
}

export function setQuietMuted(next: boolean): void {
  muted = next
  if (muted) {
    waiting = []
    current = null
    clearTimeout(hideTimer)
    emit()
  }
}

export function pushQuiet(text: string): void {
  const clean = text.trim()
  if (!clean || muted) return
  waiting.push({ id: seq++, text: clean })
  pump()
}

function pump() {
  if (muted || activeRound || current || waiting.length === 0) return
  current = waiting.shift() ?? null
  emit()
  clearTimeout(hideTimer)
  hideTimer = later(() => {
    current = null
    emit()
    pump()
  }, 4000)
}

/** Test hook. */
export function resetQuiet(): void {
  waiting = []
  current = null
  activeRound = false
  muted = false
  clearTimeout(hideTimer)
}
