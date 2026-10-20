import { enqueueOp, newOpId } from '../game/outbox'
import type { Wallet } from '../game/rewards'

export interface CoinMeta {
  /** Stripe checkout already paid. Do not treat the local coins as a second earn. */
  stripeSessionId?: string
  /** What the coins bought. Required for a spend so the grant and the deduction stay one record. */
  itemType?: string
  itemId?: string
  /** Pet snapshot from before the purchase, restored if the server rejects it. */
  undoPets?: unknown
}

/** Queue the coin change. A spend that would go below zero is refused. */
export function noteWalletCoins(prev: Wallet, next: Wallet, meta: CoinMeta = {}): { ok: boolean } {
  const delta = Math.round(next.coins) - Math.round(prev.coins)
  if (delta === 0) return { ok: true }
  if (delta < 0) {
    const cost = -delta
    if (prev.coins < cost) return { ok: false }
    const itemType = meta.itemType || 'spend'
    const itemId = meta.itemId || newOpId()
    void enqueueOp('spend', {
      cost,
      itemType,
      itemId,
      undo: { badgeRanks: prev.badgeRanks, pets: meta.undoPets ?? null },
    })
    return { ok: true }
  }
  if (meta.stripeSessionId) {
    void enqueueOp('stripe', { sessionId: meta.stripeSessionId, amount: delta })
    return { ok: true }
  }
  void enqueueOp('earn', { amount: delta, reason: meta.itemId || 'play' })
  return { ok: true }
}
