/**
 * Guest progress moves into the account on sign-up. It is not wiped.
 * Same device: the snapshot is stored under the account id.
 * A different account on this device gets its own snapshot back.
 * Cross-device earned coins wait on the SQL save (migration not applied).
 * Purchased coins can be restored from the server ledger.
 */

export interface ClearLike {
  puzzleId: string
  bestMs: number
  bestScore: number
  clears: number
  hintsOnBest?: number
  clearedAt?: string
  lastClearedAt?: string
}

export interface WalletLike {
  coins?: number
  [key: string]: unknown
}

export interface PetOwnedLike {
  at?: number
  xp?: number
  [key: string]: unknown
}

export interface ProgressBlob {
  wallet: WalletLike | null
  pets: { owned?: Record<string, PetOwnedLike>; [key: string]: unknown } | null
  records: unknown
  clears: ClearLike[]
}

export interface StoredProgress {
  /** Signed in right now. */
  owner: string | null
  /** Signed out, but the save on the device still belongs to this account. */
  parked: string | null
  guest: ProgressBlob
  accounts: Record<string, ProgressBlob>
}

const emptyBlob = (): ProgressBlob => ({ wallet: null, pets: null, records: null, clears: [] })

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Keep the better clear. Nothing already earned is dropped. */
export function mergeClears(a: readonly ClearLike[], b: readonly ClearLike[]): ClearLike[] {
  const map = new Map<string, ClearLike>()
  for (const c of [...a, ...b]) {
    if (!c || typeof c.puzzleId !== 'string') continue
    const prev = map.get(c.puzzleId)
    if (!prev || c.bestScore > prev.bestScore || (c.bestScore === prev.bestScore && c.bestMs < prev.bestMs)) {
      map.set(c.puzzleId, {
        ...c,
        clears: Math.max(prev?.clears ?? 0, c.clears ?? 0),
      })
    } else if (prev) {
      map.set(c.puzzleId, { ...prev, clears: Math.max(prev.clears ?? 0, c.clears ?? 0) })
    }
  }
  return [...map.values()]
}

/** Higher coin total, union of buddies (higher XP wins). Grandfathers both sides. */
export function mergeProgress(account: ProgressBlob | null, guest: ProgressBlob | null): ProgressBlob {
  const a = account ?? emptyBlob()
  const g = guest ?? emptyBlob()
  const aCoins = num(a.wallet?.coins)
  const gCoins = num(g.wallet?.coins)
  const wallet = (aCoins >= gCoins ? a.wallet : g.wallet) ?? a.wallet ?? g.wallet
  const owned: Record<string, PetOwnedLike> = { ...(a.pets?.owned ?? {}) }
  for (const [id, pet] of Object.entries(g.pets?.owned ?? {})) {
    const prev = owned[id]
    if (!prev || num(pet?.xp) > num(prev.xp)) owned[id] = pet
  }
  const petsBase = a.pets ?? g.pets
  const pets = petsBase ? { ...petsBase, owned } : Object.keys(owned).length ? { owned } : null
  return {
    wallet: wallet ? { ...wallet, coins: Math.max(aCoins, gCoins) } : null,
    pets,
    records: a.records ?? g.records,
    clears: mergeClears(a.clears, g.clears),
  }
}

export type AdoptResult = {
  stored: StoredProgress
  /** Progress now on the device for this session. */
  active: ProgressBlob
  /** Guest coins and buddies were copied onto a new account. */
  adoptedGuest: boolean
  /** Came back to an account that already had a snapshot. */
  restored: boolean
}

/**
 * Sign-in. A brand-new account adopts the guest save.
 * The same account keeps the richer of the snapshot and the device.
 * A different account does not receive the previous player's coins.
 */
export function emptyStoredProgress(): StoredProgress {
  return { owner: null, parked: null, guest: emptyBlob(), accounts: {} }
}

/**
 * Sign-in.
 * A device that has never had an account adopts the guest save (nothing is wiped).
 * The same person gets the richer of the device and their snapshot.
 * Someone else does not inherit the previous player's coins.
 */
export function adoptOnSignIn(stored: StoredProgress, userId: string, device: ProgressBlob): AdoptResult {
  const accounts = { ...stored.accounts }
  const holder = stored.owner ?? stored.parked
  const samePerson = holder === userId
  const freshGuest = holder == null

  if (holder && holder !== userId) {
    accounts[holder] = mergeProgress(accounts[holder] ?? null, device)
  }

  const known = accounts[userId] ?? null
  const incoming = freshGuest || samePerson ? device : emptyBlob()
  const active = mergeProgress(known, incoming)
  accounts[userId] = active
  return {
    stored: { owner: userId, parked: null, guest: freshGuest ? emptyBlob() : stored.guest, accounts },
    active,
    adoptedGuest: freshGuest,
    restored: !freshGuest,
  }
}

/** Sign-out keeps the account snapshot. The device save stays so play is not reset. */
export function parkOnSignOut(stored: StoredProgress, device: ProgressBlob): StoredProgress {
  const holder = stored.owner ?? stored.parked
  if (!holder) return { ...stored, guest: mergeProgress(stored.guest, device) }
  return {
    owner: null,
    parked: holder,
    guest: stored.guest,
    accounts: { ...stored.accounts, [holder]: mergeProgress(stored.accounts[holder] ?? null, device) },
  }
}
