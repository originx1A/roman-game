import { isComputerPlayer } from './lineCaption'
import { playVoice, voiceOutputOn } from './sound'
import { isPlayableVoiceClip } from './voiceLines'
import { REMINDER_LINES, type ReminderId } from './unseenReminders'

/**
 * Clip id for each Home reminder. The file is public/voices/<id>.mp3.
 * Nothing is added to VOICE_LINES until that file exists, so the voice build check stays green.
 * playReminderLine plays a catalogued clip, or the mp3 itself if Cooper has dropped the file in.
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

/** Play the reminder if a recording is available. Silent when voice is off or the file is missing. */
export async function playReminderLine(id: ReminderId): Promise<boolean> {
  if (!voiceOutputOn()) return false
  // The sign-in recording talks about "this phone". A computer shows different words and stays silent.
  if (id === 'signin' && isComputerPlayer()) return false
  const clip = REMINDER_CLIPS[id]
  if (isPlayableVoiceClip(clip)) {
    playVoice(clip, { mood: 'neutral' })
    return true
  }
  try {
    const res = await fetch(`/voices/${clip}.mp3`, { method: 'HEAD' })
    if (!res.ok) return false
    const el = new Audio(`/voices/${clip}.mp3`)
    await el.play()
    return true
  } catch {
    return false
  }
}

/** Exact words Cooper still needs to record. */
export function missingReminderLines(): { id: string; text: string }[] {
  return (Object.keys(REMINDER_LINES) as ReminderId[])
    .filter((id) => !isPlayableVoiceClip(REMINDER_CLIPS[id]))
    .map((id) => ({ id: REMINDER_CLIPS[id], text: REMINDER_LINES[id] }))
}
