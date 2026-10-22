/**
 * When a character may be on screen. The picture follows the audio element's
 * `playing` event: a request, a queue slot, a stale skip, a blocked play, or a
 * start later than the limit never shows anyone. Once playback has started in
 * time, he stays up for the whole line and leaves when the audio ends.
 */
export const VISUAL_START_LIMIT_MS = 1500

export type VisualEvent = 'request' | 'queued' | 'playing' | 'ended' | 'error' | 'timeout' | 'stale' | 'blocked'

export function unseenFrame(state: 'off' | 'on', event: VisualEvent, elapsedMs = 0, limitMs = VISUAL_START_LIMIT_MS): 'off' | 'on' {
  if (event === 'playing') return elapsedMs <= limitMs ? 'on' : 'off'
  // Asked for, or still waiting: never turns the picture on. An end, a failure,
  // a stale skip, or the deadline turns it off.
  if (event === 'request' || event === 'queued') return state === 'on' ? 'on' : 'off'
  return 'off'
}

export interface CueTarget {
  addEventListener(type: string, fn: () => void): void
  removeEventListener(type: string, fn: () => void): void
}

/**
 * Show the visual only if `playing` fires within the limit of arming this watch.
 * A timeout, an error, or a cancel leaves him hidden and tells the caller to stop the audio,
 * so a late start cannot speak with nobody on screen.
 */
export function bindVisualToPlaying(
  el: CueTarget,
  opts: {
    limitMs?: number
    now?: () => number
    schedule?: (fn: () => void, ms: number) => number
    clear?: (id: number) => void
    onShow: () => void
    onAbort: () => void
  },
): { done: Promise<'started' | 'aborted'>; cancel: () => void } {
  const limit = opts.limitMs ?? VISUAL_START_LIMIT_MS
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const schedule = opts.schedule ?? ((fn, ms) => window.setTimeout(fn, ms) as unknown as number)
  const clear = opts.clear ?? ((id) => window.clearTimeout(id))
  const startedAt = now()
  let settled = false
  let resolve: (v: 'started' | 'aborted') => void = () => {}
  const done = new Promise<'started' | 'aborted'>((r) => {
    resolve = r
  })
  const finish = (result: 'started' | 'aborted') => {
    if (settled) return
    settled = true
    el.removeEventListener('playing', onPlaying)
    el.removeEventListener('error', onError)
    clear(timer)
    if (result === 'started') opts.onShow()
    else opts.onAbort()
    resolve(result)
  }
  const onPlaying = () => {
    const elapsed = now() - startedAt
    finish(unseenFrame('off', 'playing', elapsed, limit) === 'on' ? 'started' : 'aborted')
  }
  const onError = () => finish('aborted')
  const timer = schedule(() => finish('aborted'), limit)
  el.addEventListener('playing', onPlaying)
  el.addEventListener('error', onError)
  return { done, cancel: () => finish('aborted') }
}
