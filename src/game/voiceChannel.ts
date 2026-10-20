/*
 * One shared voice channel (Roman, the coach and the Unseen), kept pure so it is unit-tested.
 *
 * - A line the player can already hear is never cut off. A new line waits or is skipped.
 * - The same speaker does not chain-talk. A paired reply may wait a short gap.
 * - A line that is still loading (nothing heard yet) can be replaced by a higher one.
 * - Higher lines wait until the current one ends, then go stale after a few seconds.
 * - At a board end only queued lines below the win/lose line are dropped.
 */
export type VoiceSpeaker = 'roman' | 'oldtimer' | 'other'

export interface ChannelLine {
  priority: number
  /** the clip has actually started playing (the player can hear it) */
  audible: boolean
  /** performance.now() when it should end (0 = not known yet) */
  endsAt: number
  /** Who is using the channel. Missing means the older "don't cut a started line" rule. */
  speaker?: VoiceSpeaker
}
export interface VoiceRequest {
  priority: number
  waitMs?: number
  speaker?: VoiceSpeaker
  /** A reply written to follow the line that is playing. It may wait; it does not cut in. */
  paired?: boolean
}

/** Quiet beat between two speakers so they do not run into each other. */
export const SPEAKER_GAP_MS = 500

/** How long past the current line's end a line that outranks it is still worth saying */
export const STALE_AFTER_MS = { high: 4000, normal: 1500 } as const
/** Win / lose lines and up */
export const HIGH_PRIORITY = 5
/** Wait assumed when the playing line's end isn't known yet */
export const UNKNOWN_REMAINING_MS = 7000

export type VoiceDecision = { kind: 'play' } | { kind: 'preempt' } | { kind: 'wait'; until: number } | { kind: 'skip' }

export function decideVoice(current: ChannelLine | null, req: VoiceRequest, now: number): VoiceDecision {
  if (!current) return { kind: 'play' }
  // Still loading: a more important line may take the slot. Nothing has been heard.
  if (!current.audible && req.priority > current.priority) return { kind: 'preempt' }
  if (current.audible) {
    // One speaker at a time. A written-back-and-forth may wait; it never cuts the line.
    if (req.speaker && current.speaker && req.speaker === current.speaker && !req.paired) return { kind: 'skip' }
    if (req.priority > current.priority || req.waitMs || req.paired) {
      const remaining = current.endsAt > now ? current.endsAt - now : current.endsAt ? 0 : UNKNOWN_REMAINING_MS
      const grace = req.priority >= HIGH_PRIORITY ? STALE_AFTER_MS.high : STALE_AFTER_MS.normal
      return { kind: 'wait', until: now + Math.max(req.waitMs ?? 0, remaining + grace) }
    }
    return { kind: 'skip' }
  }
  if (req.waitMs || req.paired) return { kind: 'wait', until: now + Math.max(req.waitMs ?? SPEAKER_GAP_MS, SPEAKER_GAP_MS) }
  return { kind: 'skip' }
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
