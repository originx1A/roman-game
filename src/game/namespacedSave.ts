/**
 * Sibling saves on one device.
 * Old keys such as roman.wallet.v1 were shared by every profile.
 * After migration they live at roman.<player id>.<profile id>.<rest>.
 * The profile list itself stays on the device so the account picker still works.
 * Cooper wires this in when a profile becomes active. The server copy is /api/save-progress.
 */

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Progress that must not leak from one account to the next person on the device. */
export const LEGACY_SAVE_KEYS = [
  'roman.profile.v1',
  'roman.guest.v1',
  'roman.settings.v1',
  'roman.challenges.v1',
  'roman.draft.v1',
  'roman.wallet.v1',
  'roman.generated.v1',
  'roman.remix.v1',
  'roman.endless.v1',
  'roman.sharedboards.v1',
  'roman.buddymeter.v1',
  'roman.records.v1',
  'roman.tips.v1',
  'roman.pets.v1',
  'roman.lb.seen.v1',
  'roman.reminders.v1',
  'roman.stripe.sessions.v1',
  'roman.shop.starter',
  'roman.bundle.premium',
  'roman.voiceturns.v1',
  'roman.critterclock.v1',
  'roman.econ.v1',
  'roman.heard.v1',
  'roman.iap.applied.v1',
  'roman.voicebags.v1',
  'roman.parade.v1',
  'roman.badbests.v1',
  'roman.anon.v1',
  'roman.buddyday.v1',
  'rg.social.cache.v1',
  'rg.cloud.queue.v1',
  'rg.cloud.consent.v1',
  'rg.cloud.profile.v1',
  'rg.auth.last',
  'rg.quiet.muted',
  'rg.nudge.dismissed',
  'rg.unseen.v1',
] as const

/** The account picker. Moving these would hide the other people on the device. */
export const DEVICE_WIDE_KEYS = ['rg.profiles.v1', 'rg.profiles.active'] as const

export function namespacedStorageKey(playerId: string, profileId: string, legacyKey: string): string {
  const tail = legacyKey.replace(/^(roman\.|rg\.)/, '')
  return `roman.${playerId}.${profileId}.${tail}`
}

/**
 * Copies each legacy key into this profile's namespace when that slot is empty,
 * then deletes the legacy key so the next person on the device does not inherit it.
 * Returns the legacy keys that were removed.
 */
export function migrateLegacySaveKeys(
  store: KeyValueStore,
  playerId: string,
  profileId: string,
  keys: readonly string[] = LEGACY_SAVE_KEYS,
): string[] {
  if (!playerId || !profileId) return []
  const moved: string[] = []
  for (const key of keys) {
    if ((DEVICE_WIDE_KEYS as readonly string[]).includes(key)) continue
    const value = store.getItem(key)
    if (value == null) continue
    const next = namespacedStorageKey(playerId, profileId, key)
    if (next !== key && store.getItem(next) == null) store.setItem(next, value)
    if (next !== key) store.removeItem(key)
    moved.push(key)
  }
  return moved
}
