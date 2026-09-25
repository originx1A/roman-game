export type PrizeId =
  | 'coins_25'
  | 'coins_50'
  | 'coins_100'
  | 'hint_2'
  | 'heart_refill'
  | 'shield'
  | 'jackpot'

export interface Prize {
  id: PrizeId
  label: string
  weight: number
  color: string
}

/** Unlockable badge that ranks up forever with coin upgrades */
export interface BadgeDef {
  id: string
  title: string
  blurb: string
  icon: string
  /** Extra coin % per rank (e.g. 1.5 = +1.5% coins per rank on wins) */
  bonusPerRank: number
  /** Base cost to go from rank N → N+1 (scales steeply) */
  baseUpgrade: number
}

/** @deprecated alias — badges replaced flat achievements */
export type AchievementDef = BadgeDef

export interface Wallet {
  coins: number
  freeHints: number
  shields: number
  spins: number
  /** Unlocked badge ids (rank >= 1) — kept for compatibility */
  achievements: string[]
  /** Infinite ranks per badge id (0 = locked) */
  badgeRanks: Record<string, number>
  totalWins: number
  perfectWins: number
  totalMistakes: number
  /** Spark critters caught toward stash bonus */
  critterStash: number
  /** Full-hearts prize. Hearts exist only during a run, so this waits for the next one. */
  heartRefillPending?: boolean
}

export const DEFAULT_WALLET: Wallet = {
  coins: 50,
  freeHints: 2,
  shields: 0,
  spins: 0,
  achievements: [],
  badgeRanks: {},
  totalWins: 0,
  perfectWins: 0,
  totalMistakes: 0,
  critterStash: 0,
}

export const PRIZES: Prize[] = [
  { id: 'coins_25', label: '+25 coins', weight: 28, color: '#ffd166' },
  { id: 'coins_50', label: '+50 coins', weight: 18, color: '#ffe08a' },
  { id: 'coins_100', label: '+100 coins', weight: 8, color: '#ff9f1c' },
  { id: 'hint_2', label: '+2 hints', weight: 20, color: '#3dffa8' },
  { id: 'heart_refill', label: 'Full hearts', weight: 12, color: '#ff6b6b' },
  { id: 'shield', label: 'Mistake shield', weight: 10, color: '#1a6dff' },
  { id: 'jackpot', label: 'JACKPOT 200', weight: 4, color: '#c77dff' },
]

export const BADGES: BadgeDef[] = [
  { id: 'first_clear', title: 'First Clear', blurb: 'Settle your first board.', icon: '🏁', bonusPerRank: 1.2, baseUpgrade: 90 },
  { id: 'perfect', title: 'No Hints Hero', blurb: 'Win without using a hint.', icon: '🧠', bonusPerRank: 1.8, baseUpgrade: 120 },
  { id: 'streak3', title: 'On a Roll', blurb: 'Win 3 boards total.', icon: '🔥', bonusPerRank: 1.4, baseUpgrade: 100 },
  { id: 'rich', title: 'Coin Pocket', blurb: 'Hold 200 coins at once.', icon: '💰', bonusPerRank: 2.0, baseUpgrade: 140 },
  { id: 'spinner', title: 'Lucky Spin', blurb: 'Spin the prize wheel.', icon: '🎡', bonusPerRank: 1.3, baseUpgrade: 110 },
  { id: 'expert', title: 'Expert Orbit', blurb: 'Clear an expert board.', icon: '🚀', bonusPerRank: 2.2, baseUpgrade: 160 },
  { id: 'comeback', title: 'Comeback Kid', blurb: 'Win after a lose.', icon: '💪', bonusPerRank: 1.5, baseUpgrade: 115 },
  { id: 'critter', title: 'Spark Catcher', blurb: 'Catch a spark critter.', icon: '✨', bonusPerRank: 1.1, baseUpgrade: 95 },
  { id: 'stash', title: 'Critter Stash', blurb: 'Catch 5 sparks for the big bonus.', icon: '🎁', bonusPerRank: 1.7, baseUpgrade: 130 },
]

/** Back-compat export used by App */
export const ACHIEVEMENTS = BADGES

export function rollPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of PRIZES) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PRIZES[0]
}

export function applyPrize(wallet: Wallet, prize: Prize): Wallet {
  const next = normalizeWallet({ ...wallet })
  switch (prize.id) {
    case 'coins_25':
      next.coins += 25
      break
    case 'coins_50':
      next.coins += 50
      break
    case 'coins_100':
      next.coins += 100
      break
    case 'hint_2':
      next.freeHints += 2
      break
    case 'heart_refill':
      next.heartRefillPending = true
      break
    case 'shield':
      next.shields += 1
      break
    case 'jackpot':
      next.coins += 200
      next.freeHints += 1
      break
  }
  return unlockIf(next, 'spinner')
}

/** Ensure badgeRanks exists and mirrors unlocked achievements at least rank 1 */
export function normalizeWallet(wallet: Wallet): Wallet {
  const ranks: Record<string, number> = { ...(wallet.badgeRanks ?? {}) }
  const unlocked = [...(wallet.achievements ?? [])]
  for (const id of unlocked) {
    if ((ranks[id] ?? 0) < 1) ranks[id] = 1
  }
  for (const [id, r] of Object.entries(ranks)) {
    if (r >= 1 && !unlocked.includes(id)) unlocked.push(id)
  }
  return { ...wallet, badgeRanks: ranks, achievements: unlocked }
}

export function badgeRank(wallet: Wallet, id: string): number {
  return Math.max(0, wallet.badgeRanks?.[id] ?? 0)
}

/** Total coin bonus percent from all badge ranks (unbounded) */
export function totalCoinBonusPercent(wallet: Wallet): number {
  const w = normalizeWallet(wallet)
  let pct = 0
  for (const b of BADGES) {
    const r = badgeRank(w, b.id)
    if (r > 0) pct += r * b.bonusPerRank
  }
  return Math.round(pct * 10) / 10
}

/** Sum of all ranks — “badge power” shown on share / challenges */
export function totalBadgePower(wallet: Wallet): number {
  const w = normalizeWallet(wallet)
  return Object.values(w.badgeRanks).reduce((s, r) => s + Math.max(0, r), 0)
}

export function formatBonusPercent(pct: number): string {
  const n = Math.round(pct * 10) / 10
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`
}

/**
 * Fair infinite upgrade cost:
 * - Grows with THIS badge’s rank (main curve)
 * - Extra tax from total Badge Power so high-rank players pay more overall
 * Early ranks stay reachable; late ranks get expensive fast.
 */
export function upgradeBadgeCost(
  badgeId: string,
  currentRank: number,
  totalPower = 0,
): number {
  const def = BADGES.find((b) => b.id === badgeId)
  const base = def?.baseUpgrade ?? 100
  if (currentRank < 1) return 0
  const rankCurve = Math.pow(1.62, currentRank)
  const powerTax = 1 + Math.max(0, totalPower) * 0.09
  const rankTax = 1 + currentRank * 0.18
  return Math.max(base, Math.floor(base * rankCurve * powerTax * rankTax))
}

export function tryUpgradeBadge(
  wallet: Wallet,
  badgeId: string,
): { wallet: Wallet; ok: boolean; cost: number; reason?: string } {
  const w = normalizeWallet(wallet)
  const rank = badgeRank(w, badgeId)
  if (rank < 1) {
    return { wallet: w, ok: false, cost: 0, reason: 'Unlock this badge by playing first' }
  }
  const power = totalBadgePower(w)
  const cost = upgradeBadgeCost(badgeId, rank, power)
  if (w.coins < cost) {
    return { wallet: w, ok: false, cost, reason: `Need ${cost} coins` }
  }
  const next = normalizeWallet({
    ...w,
    coins: w.coins - cost,
    badgeRanks: { ...w.badgeRanks, [badgeId]: rank + 1 },
  })
  return { wallet: next, ok: true, cost }
}

/** Apply win coin payout with badge bonus % */
export function grantWinCoins(wallet: Wallet, baseCoins: number): { wallet: Wallet; gained: number; bonusPct: number } {
  const w = normalizeWallet(wallet)
  const bonusPct = totalCoinBonusPercent(w)
  const gained = Math.max(1, Math.floor(baseCoins * (1 + bonusPct / 100)))
  return {
    wallet: { ...w, coins: w.coins + gained },
    gained,
    bonusPct,
  }
}

export function unlockIf(wallet: Wallet, id: string): Wallet {
  const w = normalizeWallet(wallet)
  if ((w.badgeRanks[id] ?? 0) >= 1) return w
  return normalizeWallet({
    ...w,
    achievements: w.achievements.includes(id) ? w.achievements : [...w.achievements, id],
    badgeRanks: { ...w.badgeRanks, [id]: 1 },
  })
}

export function evaluateAchievements(
  wallet: Wallet,
  opts: { perfect: boolean; difficulty: string; justWon: boolean; justLost?: boolean },
): { wallet: Wallet; newly: string[] } {
  let w = normalizeWallet(wallet)
  const newly: string[] = []
  const tryUnlock = (id: string) => {
    if ((w.badgeRanks[id] ?? 0) < 1) {
      w = unlockIf(w, id)
      newly.push(id)
    }
  }

  if (opts.justWon) {
    if (w.totalWins >= 1) tryUnlock('first_clear')
    if (w.totalWins >= 3) tryUnlock('streak3')
    if (opts.perfect) tryUnlock('perfect')
    if (opts.difficulty === 'expert') tryUnlock('expert')
  }
  if (w.coins >= 200) tryUnlock('rich')

  return { wallet: w, newly }
}

export function badgeTitleForShare(wallet: Wallet): string {
  const power = totalBadgePower(wallet)
  const bonus = totalCoinBonusPercent(wallet)
  if (power <= 0) return 'Unranked'
  return `Badge Power ${power} · +${formatBonusPercent(bonus)} coins`
}

export const HINT_COST = 15
/** Rare rescue that clears a misplaced buddy */
export const RESCUE_COST = 40
export const REVIVE_COST = 30
export const MAX_LIVES = 3
