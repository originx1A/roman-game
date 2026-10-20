/** The recorded phone jab. Desktop shows different words and does not play this clip. */
export const PHONE_JAB_CLIP = 'old_jab_phone'
/**
 * Desktop wording for the Unseen's phone jab.
 * The recording says "Is this your first time holding a phone?" so computers show this caption
 * and do not play that audio.
 */
export const DESKTOP_PHONE_JAB = 'The Unseen: Have you ever used a computer before?'

/** Replacement caption, or undefined to keep the recorded line. */
export function desktopCaption(id: string, computer: boolean): string | undefined {
  if (id === PHONE_JAB_CLIP && computer) return DESKTOP_PHONE_JAB
  return undefined
}

/** False only for the phone jab on a computer. */
export function clipAudible(id: string, computer: boolean): boolean {
  return !(id === PHONE_JAB_CLIP && computer)
}
