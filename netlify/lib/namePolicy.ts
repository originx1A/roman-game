import { NAME_FILTER } from './nameFilterData.ts'

const RESERVED = new Set<string>(NAME_FILTER.reserved)
const SUBSTRING = NAME_FILTER.substring
const EXACT = new Set<string>(NAME_FILTER.exact)

const LEET: Record<string, string> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
}

export type NameReject = 'format' | 'reserved' | 'profanity' | 'pii'

export type NameDecision =
  | { ok: true; normalized: string; displayName: string }
  | { ok: false; reason: NameReject; normalized: string | null }

function stripControls(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code > 31 && code !== 127) out += char
  }
  return out
}

/** NFKC, lowercase, trim, collapse spaces to a single hyphen. */
export function normalizeName(raw: string): string | null {
  const cleaned = stripControls(raw.normalize('NFKC'))
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  if (!/^[a-z][a-z0-9-]{2,19}$/.test(cleaned)) return null
  return cleaned
}

export function displayForm(raw: string): string {
  return stripControls(raw.normalize('NFKC')).trim().replace(/\s+/g, ' ')
}

function fold(value: string, one: 'i' | 'l'): string {
  const mapped = value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$!|]/g, (ch) => (ch === '1' ? one : (LEET[ch] ?? ch)))
  return mapped
}

/** Leetspeak fold, then exact-word and substring checks. 1 is tried as both i and l. */
export function isBlockedWord(value: string): boolean {
  for (const one of ['i', 'l'] as const) {
    const folded = fold(value, one)
    const words = folded
      .replace(/[^a-z]+/g, ' ')
      .split(' ')
      .filter(Boolean)
    if (words.some((word) => EXACT.has(word))) return true
    const squashed = folded.replace(/[^a-z]/g, '')
    if (SUBSTRING.some((word) => squashed.includes(word))) return true
  }
  return false
}

function isReserved(normalized: string): boolean {
  const letters = normalized.replace(/-/g, '')
  if (RESERVED.has(normalized) || RESERVED.has(letters)) return true
  for (const one of ['i', 'l'] as const) {
    const folded = fold(letters, one).replace(/[^a-z]/g, '')
    if (RESERVED.has(folded)) return true
  }
  return false
}

function hasPii(raw: string): boolean {
  if (raw.includes('@')) return true
  const digits = raw.match(/\d/g)
  if (digits && digits.length >= 7) return true
  if (/https?:\/\/|www\./i.test(raw)) return true
  if (/\.(com|net|org|io)\b/i.test(raw)) return true
  return false
}

/**
 * Server name gate. The normalized value is the login key.
 * `normalized` on a rejection is null when the shape itself is illegal, so
 * a phone-like string is not written to the audit log.
 */
export function decideName(raw: unknown): NameDecision {
  if (typeof raw !== 'string') return { ok: false, reason: 'format', normalized: null }
  const displayName = displayForm(raw)
  if (displayName.length < 1 || displayName.length > 24) return { ok: false, reason: 'format', normalized: null }
  const normalized = normalizeName(displayName)
  if (!normalized) return { ok: false, reason: 'format', normalized: null }
  if (hasPii(displayName) || hasPii(normalized)) return { ok: false, reason: 'pii', normalized: null }
  if (isReserved(normalized)) return { ok: false, reason: 'reserved', normalized }
  if (isBlockedWord(displayName) || isBlockedWord(normalized)) return { ok: false, reason: 'profanity', normalized }
  return { ok: true, normalized, displayName }
}

/** First word only. A profane first word is skipped (empty), not shown. */
export function publicDisplayName(displayName: string): string {
  const first = displayName.trim().split(' ')[0] ?? ''
  if (!first || isBlockedWord(first)) return ''
  return first.slice(0, 24)
}
