/**
 * Decisions for the one shared voice element (Roman, the coach, the Unseen).
 * Kept pure so the iOS "Roman is on screen but silent" races can be unit-tested.
 * sound.ts does the DOM work.
 */

export type PlayRejectionKind = 'not-allowed' | 'aborted' | 'failed'

/** How long after play() a pause is treated as iOS noise (rate change, src swap) rather than the end of the line. */
export const PAUSE_GRACE_MS = 350
/** A blocked line is retried once, and only if the player is still on that moment. */
export const VOICE_RETRY_TTL_MS = 8000

export function classifyPlayRejection(err: unknown): PlayRejectionKind {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : ''
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const blob = `${name} ${message}`.toLowerCase()
  if (
    name === 'NotAllowedError' ||
    blob.includes('notallowed') ||
    blob.includes('not allowed') ||
    blob.includes('user gesture') ||
    blob.includes("user didn't interact")
  ) {
    return 'not-allowed'
  }
  if (name === 'AbortError' || blob.includes('interrupted') || blob.includes('abort')) return 'aborted'
  return 'failed'
}

/**
 * Start the silent prime from this user gesture?
 * A line that is only *loading* is not audible, so it must not block the prime.
 * (The old check bailed out whenever any line was current, including one whose
 * play() had not run yet. That tap spent the gesture on nothing.)
 * An audible clip is left alone. A finished unlock is left alone until iOS
 * suspends the session (`needsGesture`, e.g. the page was hidden).
 */
export function shouldStartPrime(opts: {
  priming: boolean
  unlocked: boolean
  needsGesture: boolean
  audible: boolean
}): boolean {
  if (opts.priming || opts.audible) return false
  if (opts.unlocked && !opts.needsGesture) return false
  return true
}

/**
 * True when this pause is the line actually stopping.
 * A pause inside the grace window is the iOS blip after play() / playbackRate
 * and must not free the channel (that blip was cutting Roman off as he started).
 */
export function pauseEndsLine(opts: { paused: boolean; ended: boolean; sincePlayMs: number; graceMs?: number }): boolean {
  if (!opts.paused || opts.ended) return false
  return opts.sincePlayMs >= (opts.graceMs ?? PAUSE_GRACE_MS)
}

/** Seconds before the file's end that still count as the clip finishing. */
export const LINE_END_SLACK_SEC = 0.2

/**
 * Resume a line the browser paused.
 * A started clip keeps going while the page is showing and the file has not
 * finished. Leaving the page, the clip ending, or a real stop (mute, voice
 * off, a newer line that took the channel) does not resume.
 * Duration 0 / NaN means metadata is not in yet: keep the line while visible.
 */
export function shouldResumePausedLine(opts: {
  pageVisible: boolean
  ended: boolean
  currentTimeSec: number
  durationSec: number
  replaced: boolean
}): boolean {
  if (opts.replaced || opts.ended || !opts.pageVisible) return false
  if (!Number.isFinite(opts.durationSec) || opts.durationSec <= 0) return true
  return opts.currentTimeSec < opts.durationSec - LINE_END_SLACK_SEC
}

export function retryStillFresh(armedAt: number, now: number, ttlMs = VOICE_RETRY_TTL_MS, holdUntilGesture = false): boolean {
  if (!Number.isFinite(armedAt) || now < armedAt) return false
  if (holdUntilGesture) return true
  return now - armedAt <= ttlMs
}

/**
 * Once the voice element is piped into a running AudioContext it follows the
 * same iOS audio session as the sound effects. A bare element stays silent
 * when the ringer switch is on, which is why a tap could show Roman and play
 * the tap sound with no voice. Only attach when the context is actually running;
 * attaching earlier leaves the element silent until the context starts.
 */
export function shouldAttachVoiceGraph(ctxState: string, alreadyAttached: boolean): boolean {
  return !alreadyAttached && ctxState === 'running'
}
