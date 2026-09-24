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

export interface AchievementDef {
  id: string
  title: string
  blurb: string
  icon: string
}

export interface Wallet {
  coins: number
  freeHints: number
  shields: number
  spins: number
  achievements: string[]
  totalWins: number
  perfectWins: number
  totalMistakes: number
  /** Spark critters caught toward stash bonus */
  critterStash: number
}

export const DEFAULT_WALLET: Wallet = {
  coins: 50,
  freeHints: 2,
  shields: 0,
  spins: 0,
  achievements: [],
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

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_clear', title: 'First Clear', blurb: 'Settle your first board.', icon: '🏁' },
  { id: 'perfect', title: 'No Hints Hero', blurb: 'Win without using a hint.', icon: '🧠' },
  { id: 'streak3', title: 'On a Roll', blurb: 'Win 3 boards total.', icon: '🔥' },
  { id: 'rich', title: 'Coin Pocket', blurb: 'Hold 200 coins at once.', icon: '💰' },
  { id: 'spinner', title: 'Lucky Spin', blurb: 'Spin the prize wheel.', icon: '🎡' },
  { id: 'expert', title: 'Expert Orbit', blurb: 'Clear an expert board.', icon: '🚀' },
  { id: 'comeback', title: 'Comeback Kid', blurb: 'Win after a lose.', icon: '💪' },
  { id: 'critter', title: 'Spark Catcher', blurb: 'Catch a spark critter.', icon: '✨' },
  { id: 'stash', title: 'Critter Stash', blurb: 'Catch 5 sparks for the big bonus.', icon: '🎁' },
]

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
  const next = { ...wallet, achievements: [...wallet.achievements] }
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
      // handled by caller for lives; grant coins consolation too
      next.coins += 10
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

export function unlockIf(wallet: Wallet, id: string): Wallet {
  if (wallet.achievements.includes(id)) return wallet
  return { ...wallet, achievements: [...wallet.achievements, id] }
}

export function evaluateAchievements(
  wallet: Wallet,
  opts: { perfect: boolean; difficulty: string; justWon: boolean; justLost?: boolean },
): { wallet: Wallet; newly: string[] } {
  let w = { ...wallet, achievements: [...wallet.achievements] }
  const newly: string[] = []
  const tryUnlock = (id: string) => {
    if (!w.achievements.includes(id)) {
      w.achievements.push(id)
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
  if (opts.justLost) {
    /* comeback granted on next win after lose — tracked via flag in storage */
  }

  return { wallet: w, newly }
}

export const HINT_COST = 15
/** Rare rescue that clears a misplaced buddy */
export const RESCUE_COST = 40
export const REVIVE_COST = 30
export const MAX_LIVES = 3
