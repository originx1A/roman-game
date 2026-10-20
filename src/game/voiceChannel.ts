/*
 * One shared voice channel (Roman, the coach and the Unseen), kept pure so it is unit-tested.
 *
 * - Roman says one line per moment. A second Roman line is skipped, not queued behind the first.
 * - When the Unseen speaks, Roman's line stops and the Unseen plays. Roman does not start
 *   while the Unseen is speaking.
 * - Anyone else: a line that has started finishes. A higher line waits instead of cutting in.
 *   Equal or lower lines are skipped unless they asked to wait.
 * - A line that is still loading (nothing heard yet) can be replaced by a higher one.
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
}

/** How long past the current line's end a line that outranks it is still worth saying */
export const STALE_AFTER_MS = { high: 4000, normal: 1500 } as const
/** Win / lose lines and up */
export const HIGH_PRIORITY = 5
/** Wait assumed when the playing line's end isn't known yet */
export const UNKNOWN_REMAINING_MS = 7000

export type VoiceDecision = { kind: 'play' } | { kind: 'preempt' } | { kind: 'wait'; until: number } | { kind: 'skip' }

export function decideVoice(current: ChannelLine | null, req: VoiceRequest, now: number): VoiceDecision {
  if (!current) return { kind: 'play' }
  // The Unseen takes the channel from Roman so his line is the one you hear.
  if (req.speaker === 'oldtimer' && current.speaker === 'roman') return { kind: 'preempt' }
  // One Roman line per moment, and he stays quiet while the Unseen is speaking.
  if (req.speaker === 'roman' && (current.speaker === 'roman' || current.speaker === 'oldtimer')) {
    if (current.speaker === 'roman' && !current.audible && req.priority > current.priority) return { kind: 'preempt' }
    return { kind: 'skip' }
  }
  if (req.priority > current.priority && !current.audible) return { kind: 'preempt' }
  if (req.priority > current.priority) {
    const remaining = current.endsAt > now ? current.endsAt - now : current.endsAt ? 0 : UNKNOWN_REMAINING_MS
    const grace = req.priority >= HIGH_PRIORITY ? STALE_AFTER_MS.high : STALE_AFTER_MS.normal
    return { kind: 'wait', until: now + Math.max(req.waitMs ?? 0, remaining + grace) }
  }
  if (req.waitMs) return { kind: 'wait', until: now + req.waitMs }
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
