/**
 * Slow hash for a 4-digit purchase PIN.
 * The stored string is salt + hash. It is never the digits themselves.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LEN = 32

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const key = (await scryptAsync(pin, salt, KEY_LEN)) as Buffer
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function pinMatches(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'base64url')
  const expected = Buffer.from(parts[2], 'base64url')
  if (salt.length === 0 || expected.length === 0) return false
  const key = (await scryptAsync(pin, salt, expected.length)) as Buffer
  if (key.length !== expected.length) return false
  return timingSafeEqual(key, expected)
}
