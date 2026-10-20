/** Which sign-in and device-link choices this device can actually use, best first. */

export type AuthMethod = 'passkey' | 'google' | 'qr' | 'scan' | 'code' | 'email'

export interface AuthCaps {
  /** Platform authenticator (Face ID, fingerprint, Windows Hello) or a passkey already saved. */
  passkey: boolean
  /** Supabase Google provider is switched on. */
  google: boolean
  /** A videoinput showed up from enumerateDevices. Permission was not requested. */
  camera: boolean
  /** Desktop or a large tablet. Phones are false. */
  largeScreen: boolean
  /** Remembered method on this device. It becomes the big button when it is still available. */
  last?: AuthMethod | null
  /** Email code is the backup. Device-link screens can hide it. */
  includeEmail?: boolean
}

const ORDER: AuthMethod[] = ['passkey', 'google', 'qr', 'scan', 'code', 'email']

export function availableAuthMethods(caps: AuthCaps): AuthMethod[] {
  const email = caps.includeEmail !== false
  const set = new Set<AuthMethod>()
  if (caps.passkey) set.add('passkey')
  if (caps.google) set.add('google')
  // A screen without a camera cannot scan. It can still show a QR for a camera to read.
  if (!caps.camera) set.add('qr')
  else if (caps.largeScreen) {
    set.add('qr')
    set.add('scan')
  } else {
    set.add('scan')
    set.add('qr')
  }
  set.add('code')
  if (email) set.add('email')
  const list = ORDER.filter((method) => set.has(method))
  // On a phone with a camera, Scan is the camera choice and sits ahead of Show my QR.
  if (!caps.largeScreen && caps.camera) {
    const scanAt = list.indexOf('scan')
    const qrAt = list.indexOf('qr')
    if (scanAt > -1 && qrAt > -1 && scanAt > qrAt) {
      list.splice(scanAt, 1)
      list.splice(qrAt, 0, 'scan')
    }
  }
  const last = caps.last
  if (last && list.includes(last)) {
    return [last, ...list.filter((method) => method !== last)]
  }
  return list
}

export const AUTH_LABEL: Record<AuthMethod, string> = {
  passkey: 'Use passkey',
  google: 'Continue with Google',
  qr: 'Show my QR',
  scan: 'Scan code',
  code: 'Enter device code',
  email: 'Email code',
}

/** Email codes follow Supabase (default 8). Accept 6 to 10. Device codes are exactly 6. */
export function emailCodeDigits(raw: string): string {
  return raw.replace(/\s/g, '').replace(/\D/g, '').slice(0, 10)
}

export function emailCodeReady(raw: string): boolean {
  return /^\d{6,10}$/.test(emailCodeDigits(raw))
}

export function deviceCodeDigits(raw: string): string {
  return raw.replace(/\s/g, '').replace(/\D/g, '').slice(0, 6)
}

export function deviceCodeReady(raw: string): boolean {
  return /^\d{6}$/.test(raw.replace(/\s/g, '').replace(/\D/g, ''))
}

export const DEVICE_CODE_TTL_MS = 5 * 60 * 1000
export const DEVICE_CODE_ATTEMPT_CAP = 8

export function deviceLinkUsable(input: { createdAt: number; now: number; used: boolean; attempts: number }): boolean {
  if (input.used) return false
  if (input.attempts >= DEVICE_CODE_ATTEMPT_CAP) return false
  return input.now - input.createdAt <= DEVICE_CODE_TTL_MS
}

export function nextDeviceAttempt(attempts: number, matched: boolean): { attempts: number; ok: boolean; locked: boolean } {
  if (!matched) {
    const next = attempts + 1
    return { attempts: next, ok: false, locked: next >= DEVICE_CODE_ATTEMPT_CAP }
  }
  if (attempts >= DEVICE_CODE_ATTEMPT_CAP) return { attempts, ok: false, locked: true }
  return { attempts, ok: true, locked: false }
}
