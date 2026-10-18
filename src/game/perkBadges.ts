/**
 * Perk badges are paid only. Earned coins cannot buy them.
 * A run that used one is marked assisted. Leaderboards are stage 2;
 * this flag is stored on the run and kept off the live scores insert
 * until Tony applies the migration.
 */

export type PerkId = 'lucky_laurel' | 'eagle_eye' | 'lion_heart' | 'treat_magnet' | 'happy_hour' | 'golden_pace'

export interface PerkDef {
  id: PerkId
  name: string
  effect: string
  /** Play-minutes, boards, or wall-clock hours. Not lost while a kid is at school when the unit is play time. */
  duration: string
}

export const PERK_BADGES: readonly PerkDef[] = [
  { id: 'lucky_laurel', name: 'Lucky Laurel', effect: '+25% coins', duration: '30 play-minutes' },
  { id: 'eagle_eye', name: 'Eagle Eye', effect: '1 free hint per board', duration: 'next 5 boards' },
  { id: 'lion_heart', name: 'Lion Heart', effect: '+1 heart in Trials', duration: 'next 5 Trials' },
  { id: 'treat_magnet', name: 'Treat Magnet', effect: 'double field treats, still under the daily cap', duration: '60 play-minutes' },
  { id: 'happy_hour', name: 'Happy Hour', effect: 'buddy mood does not decay', duration: '24 hours' },
  { id: 'golden_pace', name: 'Golden Pace', effect: 'gold trail and a share-card frame', duration: '7 days' },
]

export interface PerkGrant {
  id: PerkId
  /** When the purchase credit was recorded. */
  at: number
  source: 'purchase'
}

export interface PerkState {
  v: 1
  grants: PerkGrant[]
}

export function emptyPerks(): PerkState {
  return { v: 1, grants: [] }
}

export function sanitizePerks(raw: unknown): PerkState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const grants: PerkGrant[] = []
  if (Array.isArray(r.grants)) {
    for (const g of r.grants) {
      if (!g || typeof g !== 'object') continue
      const id = (g as { id?: unknown }).id
      const at = (g as { at?: unknown }).at
      const source = (g as { source?: unknown }).source
      if (typeof id !== 'string' || !PERK_BADGES.some((p) => p.id === id)) continue
      if (source !== 'purchase') continue
      if (typeof at !== 'number' || !Number.isFinite(at)) continue
      grants.push({ id: id as PerkId, at, source: 'purchase' })
    }
  }
  return { v: 1, grants: grants.slice(-40) }
}

export type GrantPerkResult =
  | { ok: true; state: PerkState }
  | { ok: false; reason: string }

/** Coins, including coins from a pack, are not a way to mint a perk here. Only a purchase record is. */
export function grantPerk(state: PerkState, id: string, source: 'purchase' | 'coins', now: number): GrantPerkResult {
  if (source !== 'purchase') return { ok: false, reason: 'Perk badges are paid only.' }
  const def = PERK_BADGES.find((p) => p.id === id)
  if (!def) return { ok: false, reason: 'Unknown perk badge.' }
  return { ok: true, state: { v: 1, grants: [...state.grants, { id: def.id, at: now, source: 'purchase' }] } }
}

export function perkActive(state: PerkState): boolean {
  return state.grants.length > 0
}

/**
 * Assisted when the run used a hint, a rescue, an extra heart, or any perk badge.
 * Pure boards are the ones with none of those. Stage 2 will split leaderboards.
 */
export function runIsAssisted(o: { hintsUsed?: number; rescuesUsed?: number; extraHeart?: boolean; perkBadgeActive?: boolean }): boolean {
  return (o.hintsUsed ?? 0) > 0 || (o.rescuesUsed ?? 0) > 0 || o.extraHeart === true || o.perkBadgeActive === true
}
