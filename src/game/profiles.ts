/** Up to six players on one device. Each one is its own server account. Tokens stay on the device. */

export const PROFILE_CAP = 6

export interface LocalProfile {
  userId: string
  name: string
  accessToken: string
  refreshToken: string
  hasPin: boolean
  hasPicture: boolean
  /** This device registered a passkey for this player. Face ID is not a sibling picker. */
  passkey: boolean
}

export interface ProfileStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'rg.profiles.v1'
const ACTIVE = 'rg.profiles.active'

function memoryStore(): ProfileStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  }
}

function browserStore(): ProfileStore {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* private mode */
  }
  return memoryStore()
}

export function loadProfiles(store: ProfileStore = browserStore()): LocalProfile[] {
  try {
    const raw = JSON.parse(store.getItem(KEY) || '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter(isProfile).slice(0, PROFILE_CAP)
  } catch {
    return []
  }
}

function isProfile(row: unknown): row is LocalProfile {
  if (!row || typeof row !== 'object') return false
  const p = row as Partial<LocalProfile>
  return typeof p.userId === 'string' && typeof p.accessToken === 'string' && typeof p.refreshToken === 'string'
}

export function saveProfiles(list: LocalProfile[], store: ProfileStore = browserStore()): LocalProfile[] {
  const next = list.filter(isProfile).slice(0, PROFILE_CAP)
  store.setItem(KEY, JSON.stringify(next))
  return next
}

export function upsertProfile(profile: LocalProfile, store: ProfileStore = browserStore()): { list: LocalProfile[]; added: boolean } {
  const list = loadProfiles(store)
  const idx = list.findIndex((row) => row.userId === profile.userId)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...profile }
    return { list: saveProfiles(list, store), added: false }
  }
  if (list.length >= PROFILE_CAP) return { list, added: false }
  return { list: saveProfiles([...list, profile], store), added: true }
}

export function removeProfile(userId: string, store: ProfileStore = browserStore()): LocalProfile[] {
  const list = loadProfiles(store).filter((row) => row.userId !== userId)
  if (store.getItem(ACTIVE) === userId) store.removeItem(ACTIVE)
  return saveProfiles(list, store)
}

export function activeProfileId(store: ProfileStore = browserStore()): string {
  return store.getItem(ACTIVE) || ''
}

export function setActiveProfileId(userId: string, store: ProfileStore = browserStore()): void {
  store.setItem(ACTIVE, userId)
}
