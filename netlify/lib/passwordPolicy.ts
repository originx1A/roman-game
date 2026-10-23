import { COMMON_PASSWORDS } from './commonPasswords.ts'

export const PASSWORD_HINT = 'Use 10 or more characters. Don\'t use your name or a password lots of people use.'

export type PasswordReject = 'short' | 'long' | 'name' | 'common' | 'pwned'

export function passwordRejectReason(password: unknown, nameParts: string[]): PasswordReject | null {
  if (typeof password !== 'string') return 'short'
  if (password.length < 10) return 'short'
  if (password.length > 128) return 'long'
  const lower = password.toLowerCase()
  const folded = lower.replace(/[^a-z0-9]/g, '')
  for (const part of nameParts) {
    const token = part.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (token.length >= 3 && (lower === part.toLowerCase() || folded.includes(token))) return 'name'
  }
  if (COMMON_PASSWORDS.has(lower)) return 'common'
  return null
}
