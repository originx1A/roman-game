/** The recorded phone jab. Computers play old_jab_computer instead of this file. */
export const PHONE_JAB_CLIP = 'old_jab_phone'
/** Computer substitute for the phone jab. Not part of the random heckle bag. */
export const COMPUTER_JAB_CLIP = 'old_jab_computer'
/** Home sign-in reminder that says "this phone". Computers play the computer file. */
export const PHONE_SIGNIN_CLIP = 'old_remind_signin'
/** Computer substitute for the sign-in reminder. Not part of any random bag. */
export const COMPUTER_SIGNIN_CLIP = 'old_remind_signin_computer'
/**
 * Computer wording for the Unseen's phone jab.
 * The phone recording says "Is this your first time holding a phone?"
 * Computers show this caption and play old_jab_computer.
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

/**
 * Whether this file may play on this device.
 * Phone recordings stay on phones and tablets. Computer substitutes stay on computers.
 */
export function clipAudible(id: string, computer: boolean): boolean {
  if (id === PHONE_JAB_CLIP || id === PHONE_SIGNIN_CLIP) return !computer
  if (id === COMPUTER_JAB_CLIP || id === COMPUTER_SIGNIN_CLIP) return computer
  return true
}

/**
 * The recording to play for this saying.
 * Phone and computer substitutes swap here. Null means the line stays silent on this device.
 * Other lines play the file they were asked for.
 */
export function spokenClip(id: string, computer: boolean): string | null {
  if (id === PHONE_JAB_CLIP) return computer ? COMPUTER_JAB_CLIP : PHONE_JAB_CLIP
  if (id === COMPUTER_JAB_CLIP) return computer ? COMPUTER_JAB_CLIP : null
  if (id === PHONE_SIGNIN_CLIP) return computer ? COMPUTER_SIGNIN_CLIP : PHONE_SIGNIN_CLIP
  if (id === COMPUTER_SIGNIN_CLIP) return computer ? COMPUTER_SIGNIN_CLIP : null
  return id
}
