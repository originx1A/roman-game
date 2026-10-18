/**
 * What Account → Delete account removes, and what the privacy policy says we keep.
 * Purchase and tax rows stay for 6 years. Consent proof stays 3 years, with no name or email.
 */

/** Device keys removed when the signed-in player deletes the account. */
export const DEVICE_PROGRESS_KEYS = [
  'roman.profile.v1',
  'roman.guest.v1',
  'roman.wallet.v1',
  'roman.challenges.v1',
  'roman.draft.v1',
  'roman.generated.v1',
  'roman.remix.v1',
  'roman.endless.v1',
  'roman.sharedboards.v1',
  'roman.buddymeter.v1',
  'roman.records.v1',
  'roman.tips.v1',
  'roman.pets.v1',
  'roman.fountain.v1',
  'roman.giftcal.v1',
  'roman.treatday.v1',
  'roman.pointers.v1',
  'roman.perks.v1',
  'roman.econ.v1',
  'roman.buddyday.v1',
  'roman.critterclock.v1',
  'roman.heard.v1',
  'roman.iap.applied.v1',
  'roman.voicebags.v1',
  'roman.parade.v1',
  'roman.badbests.v1',
  'rg.unseen.v1',
  'rg.cloud.consent.v1',
  'roman.purchaseConsent.v1',
  'rg.cloud.queue.v1',
] as const

/** Left on the device. Settings stay, except the player name is cleared. Purchase session ids stay so a receipt is not applied twice. */
export const DEVICE_KEYS_KEPT = ['roman.settings.v1', 'roman.stripe.sessions.v1', 'roman.anon.v1'] as const

export const SERVER_REMOVED = ['players', 'scores', 'player_saves', 'purchase_pins', 'purchase PIN blob', 'parent notice email'] as const

/** coin_ledger has a user id and no name or email. It is not deleted. */
export const SERVER_KEPT = ['coin_ledger', 'account_deletions'] as const

export function accountDeleteSqlEnabled(flag: string | undefined, hasKey: boolean): boolean {
  return flag === '1' && hasKey
}

/** Consent proof is kept for 3 years after deletion. No name and no email are stored with it. */
export function consentRetainUntil(deletedAtMs: number): string {
  const d = new Date(deletedAtMs)
  d.setUTCFullYear(d.getUTCFullYear() + 3)
  return d.toISOString()
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUserId(value: string): boolean {
  return USER_ID.test(value)
}
