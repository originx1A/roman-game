/*
 * Rules for the one shared voice channel (Roman, the coach and the Unseen), kept pure so they
 * are unit-tested. Trigger moments stay where they are; only the spacing changes.
 *
 * - One speaker at a time. A line the player can already hear always finishes.
 * - A short gap (SPEAKER_GAP_MS) sits between speakers.
 * - Two triggers at once: the higher-priority line plays first. The other waits, but only
 *   until WAIT_LIMIT_MS after it was asked for.
 * - A waiting line is skipped once that wait has passed (the move it answers is old).
 * - One line waits. A same-or-higher line replaces it, so lower-priority lines don't pile up.
 * - A line still LOADING (nothing heard) yields to a higher one that fired with it. The yielded
 *   line waits; it is not cut off after it has started.
 * - At a board end only QUEUED lines below the win/lose line are dropped.
 */
export interface ChannelLine {
  priority: number
  /** the clip has actually started playing (the player can hear it) */
  audible: boolean
  /** performance.now() when it should end (0 = not known yet) */
  endsAt: number
}
export interface VoiceRequest {
  priority: number
  waitMs?: number
}

/** Silence between two speakers, inside the 400–600ms range. */
export const SPEAKER_GAP_MS = 500
/** A waiting line is stale after this long: the move it answers is old. */
export const WAIT_LIMIT_MS = 2000
/** Win / lose lines and up */
export const HIGH_PRIORITY = 5

export type VoiceDecision = { kind: 'play' } | { kind: 'preempt' } | { kind: 'wait'; until: number } | { kind: 'skip' }

export function decideVoice(current: ChannelLine | null, req: VoiceRequest, now: number): VoiceDecision {
  if (!current) return { kind: 'play' }
  // Nothing heard yet: the higher line goes first. The caller keeps the other one waiting.
  if (req.priority > current.priority && !current.audible) return { kind: 'preempt' }
  const remaining = current.endsAt > now ? current.endsAt - now : 0
  // priority 0 is the gap already being held; its endsAt is the gap, so don't add another.
  const gap = current.priority === 0 ? 0 : SPEAKER_GAP_MS
  if (remaining + gap > WAIT_LIMIT_MS) return { kind: 'skip' }
  return { kind: 'wait', until: now + WAIT_LIMIT_MS }
}

/** Only one line waits; a new waiter replaces it if it ranks the same or higher */
export function replacesWaiting(waitingPriority: number | null, priority: number): boolean {
  return waitingPriority == null || priority >= waitingPriority
}

/** A board ended: what to drop so nothing from the live board plays after the win/lose line */
export function boardEndCancel(current: ChannelLine | null, waitingPriority: number | null, minPriority: number) {
  return {
    dropWaiting: waitingPriority != null && waitingPriority < minPriority,
    // a line already playing finishes; one still loading (not heard yet) is dropped
    stopCurrent: !!current && current.priority < minPriority && !current.audible,
  }
}

/** When a playing clip should end, given its length and playback rate (plus a little slack) */
export function clipEndsAt(now: number, durationSec: number, rate: number, remainingSec = durationSec): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0
  return now + (Math.max(0, remainingSec) / Math.max(0.5, rate || 1)) * 1000
}
