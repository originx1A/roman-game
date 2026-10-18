/**
 * Object keys the store may presign with no purchase token.
 * Paid masters are never on this list. They go through /api/store-download.
 */
export const PUBLIC_FREE_MASTER = 'masters/tales-of-the-empty-throne.mp3'

/** Short enough that a cached redirect expires before the 15-minute R2 signature. */
export const PUBLIC_MEDIA_CACHE = 'private, max-age=120'

const SAMPLE_KEY = /^samples\/[a-z0-9]+(?:-[a-z0-9]+)*-sample\.mp3$/
const COVER_KEY = /^covers\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/

export function isPublicAudioKey(key: string | null | undefined): key is string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 180) return false
  if (key.includes('..') || key.includes('\\') || key.includes('//') || key.startsWith('/') || key.endsWith('/')) return false
  if (key === PUBLIC_FREE_MASTER) return true
  return SAMPLE_KEY.test(key) || COVER_KEY.test(key)
}
