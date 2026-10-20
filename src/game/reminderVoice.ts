import { playVoice, voiceOutputOn } from './sound'
import { isPlayableVoiceClip } from './voiceLines'
import { REMINDER_LINES, type ReminderId } from './unseenReminders'

/**
 * Clip id for each Home reminder. The file is public/voices/<id>.mp3.
 * Sign-in swaps to old_remind_signin_computer on a computer inside playVoice.
 * These are not in a random heckle bag. They only play from the Home reminder.
 */
export const REMINDER_CLIPS: Record<ReminderId, string> = {
  pets: 'old_remind_pets',
  signin: 'old_remind_signin',
  coins: 'old_remind_coins',
  daily: 'old_remind_daily',
  remix: 'old_remind_remix',
  streak: 'old_remind_streak',
}

export function reminderClipId(id: ReminderId): string {
  return REMINDER_CLIPS[id]
}

/**
 * Play the reminder on the shared voice channel.
 * The clip id starts with old_, so the Unseen takes priority and Roman does not talk over it.
 * One element only: a missing catalog clip stays silent rather than starting a second player.
 */
export function playReminderLine(id: ReminderId): boolean {
  if (!voiceOutputOn()) return false
  const clip = REMINDER_CLIPS[id]
  if (!isPlayableVoiceClip(clip)) return false
  playVoice(clip, { mood: 'neutral' })
  return true
}

/** Exact words that still have no catalog recording. */
export function missingReminderLines(): { id: string; text: string }[] {
  return (Object.keys(REMINDER_LINES) as ReminderId[])
    .filter((id) => !isPlayableVoiceClip(REMINDER_CLIPS[id]))
    .map((id) => ({ id: REMINDER_CLIPS[id], text: REMINDER_LINES[id] }))
}
