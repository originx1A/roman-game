/** The recorded phone jab. Computers show different words and do not play this clip. */
export const PHONE_JAB_CLIP = 'old_jab_phone'
/**
 * Computer wording for the Unseen's phone jab.
 * The recording says "Is this your first time holding a phone?" so computers show this caption
 * and do not play that audio.
 */
export const DESKTOP_PHONE_JAB = 'The Unseen: Have you ever used a computer before?'

/**
 * A window this narrow is a phone or a tablet, even if the primary pointer is a mouse.
 * Wider than this, only a coarse pointer (finger) keeps the phone line.
 */
export const HANDHELD_MAX_WIDTH_PX = 900

export interface DeviceHints {
  /** matchMedia('(pointer: coarse)') */
  coarse: boolean
  /** matchMedia('(pointer: fine)') */
  fine: boolean
  /** CSS viewport width. 0 means we could not measure it. */
  width: number
}

/**
 * A computer is a fine pointer on a wide window.
 * Phones and tablets keep the phone line: a coarse pointer, or a narrow window.
 * When the device cannot be read, keep the phone line.
 * The user agent is not consulted.
 */
export function isComputerDevice(hints: DeviceHints | null | undefined): boolean {
  if (!hints || hints.width <= 0) return false
  if (hints.coarse || hints.width < HANDHELD_MAX_WIDTH_PX) return false
  return hints.fine
}

export function readDeviceHints(): DeviceHints | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    return {
      coarse: window.matchMedia('(pointer: coarse)').matches,
      fine: window.matchMedia('(pointer: fine)').matches,
      width: window.innerWidth || 0,
    }
  } catch {
    return null
  }
}

/** True only on a computer. Phones, tablets, and an unknown device stay false. */
export function isComputerPlayer(): boolean {
  return isComputerDevice(readDeviceHints())
}

/** Replacement caption, or undefined to keep the recorded line. */
export function desktopCaption(id: string, computer: boolean): string | undefined {
  if (id === PHONE_JAB_CLIP && computer) return DESKTOP_PHONE_JAB
  return undefined
}

/** False only for the phone jab on a computer, so the phone recording never plays there. */
export function clipAudible(id: string, computer: boolean): boolean {
  return !(id === PHONE_JAB_CLIP && computer)
}
