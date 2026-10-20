/**
 * Atomic coin spend. One record deducts coins and grants the item, or does neither.
 * The device may show the item at once. It is permanent only after the server confirms.
 * The server balance is the one that counts.
 */

export const MAX_SPEND = 50_000
export const MAX_EARN = 5_000

export interface SpendOp {
  id: string
  cost: number
  itemType: string
  itemId: string
}

export interface EarnOp {
  id: string
  amount: number
  reason: string
}

export interface CoinResult {
  ok: boolean
  balance: number
  error?: 'insufficient' | 'bad_cost' | 'bad_item' | 'bad_amount' | 'duplicate'
  item?: string
  duplicate?: boolean
}

export interface CoinAccount {
  balance: number
  ops: Record<string, CoinResult>
  items: string[]
}

export interface DeviceItem {
  opId: string
  confirmed: boolean
}

export interface Device {
  balance: number
  pending: SpendOp[]
  items: Record<string, DeviceItem>
}

export function itemKey(op: Pick<SpendOp, 'itemType' | 'itemId'>): string {
  return `${op.itemType}:${op.itemId}`
}

export function freshAccount(balance = 0): CoinAccount {
  return { balance, ops: {}, items: [] }
}

export function freshDevice(balance: number): Device {
  return { balance, pending: [], items: {} }
}

function cloneAccount(account: CoinAccount): CoinAccount {
  return { balance: account.balance, ops: { ...account.ops }, items: [...account.items] }
}

/** Server transaction: lock the balance, then deduct and grant, or reject both. */
export function applySpend(account: CoinAccount, op: SpendOp): { account: CoinAccount; result: CoinResult } {
  const prior = account.ops[op.id]
  if (prior) {
    return { account, result: { ...prior, duplicate: true } }
  }
  if (!op.id || !op.itemType || !op.itemId || op.itemType.length > 24 || op.itemId.length > 80) {
    const result: CoinResult = { ok: false, balance: account.balance, error: 'bad_item' }
    return { account, result }
  }
  if (!Number.isInteger(op.cost) || op.cost < 1 || op.cost > MAX_SPEND) {
    const result: CoinResult = { ok: false, balance: account.balance, error: 'bad_cost' }
    return { account, result }
  }
  const key = itemKey(op)
  if (account.items.includes(key)) {
    const result: CoinResult = { ok: false, balance: account.balance, error: 'bad_item' }
    return { account, result }
  }
  if (account.balance < op.cost) {
    const result: CoinResult = { ok: false, balance: account.balance, error: 'insufficient' }
    return { account, result }
  }
  const next = cloneAccount(account)
  next.balance -= op.cost
  next.items.push(key)
  const result: CoinResult = { ok: true, balance: next.balance, item: key }
  next.ops[op.id] = result
  return { account: next, result }
}

/** Server earn. Play rewards and Stripe credits use this. A replay does not add twice. */
export function applyEarn(account: CoinAccount, op: EarnOp): { account: CoinAccount; result: CoinResult } {
  const prior = account.ops[op.id]
  if (prior) return { account, result: { ...prior, duplicate: true } }
  if (!op.id || !op.reason || op.reason.length > 40) {
    return { account, result: { ok: false, balance: account.balance, error: 'bad_item' } }
  }
  if (!Number.isInteger(op.amount) || op.amount < 1 || op.amount > MAX_EARN) {
    return { account, result: { ok: false, balance: account.balance, error: 'bad_amount' } }
  }
  const next = cloneAccount(account)
  next.balance += op.amount
  const result: CoinResult = { ok: true, balance: next.balance }
  next.ops[op.id] = result
  return { account: next, result }
}

/**
 * Deduct on this device immediately. The same op id cannot deduct twice.
 * Refuses a spend that would drop this device below zero.
 */
export function spendOffline(device: Device, op: SpendOp): { device: Device; ok: boolean; reason?: string } {
  if (device.pending.some((row) => row.id === op.id)) return { device, ok: true }
  if (!op.itemType || !op.itemId || !Number.isInteger(op.cost) || op.cost < 1) {
    return { device, ok: false, reason: 'bad' }
  }
  if (device.balance < op.cost) return { device, ok: false, reason: 'insufficient' }
  const key = itemKey(op)
  return {
    ok: true,
    device: {
      balance: device.balance - op.cost,
      pending: [...device.pending, op],
      items: { ...device.items, [key]: { opId: op.id, confirmed: false } },
    },
  }
}

export interface SyncOutcome {
  device: Device
  account: CoinAccount
  note?: string
}

/**
 * Send this device's pending spends, in order, through the server transaction.
 * Confirmed items stay. A rejected spend loses the item and the balance returns
 * to whatever the server still has.
 */
export function syncDevice(device: Device, account: CoinAccount): SyncOutcome {
  let ledger = account
  let note: string | undefined
  const items: Record<string, DeviceItem> = { ...device.items }
  for (const op of device.pending) {
    const out = applySpend(ledger, op)
    ledger = out.account
    const key = itemKey(op)
    if (out.result.ok) {
      items[key] = { opId: op.id, confirmed: true }
    } else {
      delete items[key]
      note =
        out.result.error === 'insufficient'
          ? 'Not enough coins on the account. We put the coins back and locked that item.'
          : 'That purchase did not sync. We put the coins back and locked that item.'
    }
  }
  return {
    account: ledger,
    note,
    device: { balance: ledger.balance, pending: [], items },
  }
}

/** Coins the player sees: server balance plus spends and earns still waiting. Never below zero. */
export function visibleBalance(serverBalance: number, pendingDelta: number): number {
  return Math.max(0, serverBalance + pendingDelta)
}
