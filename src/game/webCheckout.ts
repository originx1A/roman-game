import { isStoreBuild, type CoinPackId } from './iap'

const REDEEMED_KEY = 'roman.stripe.sessions.v1'
const CHECKOUT_HOST = 'https://checkout.stripe.com/'

export interface WebCheckoutCredit {
  ok: true
  coins: number
  label: string
  alreadyRedeemed: boolean
}

export type WebCheckoutResult = WebCheckoutCredit | { ok: false; reason: string }

function readRedeemed(): string[] {
  try {
    const raw = localStorage.getItem(REDEEMED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

export function wasCheckoutRedeemed(sessionId: string): boolean {
  return readRedeemed().includes(sessionId)
}

export function rememberCheckoutRedeemed(sessionId: string): void {
  const ids = readRedeemed().filter((id) => id !== sessionId)
  ids.push(sessionId)
  localStorage.setItem(REDEEMED_KEY, JSON.stringify(ids.slice(-200)))
}

/** Send the player to hosted Checkout. Never call this from the native app. Requires a signed-in token and a one-time PIN grant. */
export async function startWebCheckout(
  packId: CoinPackId,
  auth?: { token: string; pinGrant: string },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isStoreBuild()) return { ok: false, reason: 'Purchases are unavailable right now.' }
  if (!auth?.token) return { ok: false, reason: 'Sign in to buy' }
  if (!auth.pinGrant) return { ok: false, reason: 'Enter the purchase PIN.' }
  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ packId, pinGrant: auth.pinGrant }),
    })
    const data = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null
    if (!res.ok) {
      const reason =
        (res.status === 400 || res.status === 401 || res.status === 403) && typeof data?.error === 'string'
          ? data.error
          : 'Purchases are unavailable right now.'
      return { ok: false, reason }
    }
    if (typeof data?.url !== 'string' || !data.url.startsWith(CHECKOUT_HOST)) {
      return { ok: false, reason: 'Purchases are unavailable right now.' }
    }
    window.location.assign(data.url)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'Purchases are unavailable right now.' }
  }
}

/** Ask the server how many coins this paid session is worth. The server decides the amount. */
export async function confirmWebCheckout(sessionId: string, token?: string | null): Promise<WebCheckoutResult> {
  if (isStoreBuild()) return { ok: false, reason: 'Purchases are unavailable right now.' }
  try {
    const res = await fetch('/api/confirm-checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId }),
    })
    const data = (await res.json().catch(() => null)) as {
      ok?: unknown
      coins?: unknown
      label?: unknown
      alreadyRedeemed?: unknown
      reason?: unknown
      error?: unknown
    } | null
    if (!res.ok) {
      if (res.status === 401) return { ok: false, reason: 'Sign in to finish adding these coins.' }
      return { ok: false, reason: 'Purchases are unavailable right now. If you paid, open the return link again.' }
    }
    if (!data || data.ok !== true) {
      return {
        ok: false,
        reason: typeof data?.reason === 'string' ? data.reason : 'Payment is not complete. No coins were added.',
      }
    }
    const coins = data.coins
    if (typeof coins !== 'number' || !Number.isInteger(coins) || coins < 0 || coins > 100000) {
      return { ok: false, reason: 'Purchases are unavailable right now.' }
    }
    return {
      ok: true,
      coins,
      label: typeof data.label === 'string' ? data.label : 'Coin pack',
      alreadyRedeemed: data.alreadyRedeemed === true || coins === 0,
    }
  } catch {
    return { ok: false, reason: 'Purchases are unavailable right now. If you paid, open the return link again.' }
  }
}

export interface AccountCoinSync {
  coins: number
  spentCadCents: number
}

/**
 * Add purchase credits this device has not applied yet.
 * Clearing local storage can grant the full purchase sum again until spends
 * are tracked in the SQL balance (migration not applied).
 */
export async function syncAccountCoins(token: string): Promise<AccountCoinSync> {
  if (!token || isStoreBuild()) return { coins: 0, spentCadCents: 0 }
  try {
    const res = await fetch('/api/coin-ledger', {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { coins: 0, spentCadCents: 0 }
    const data = (await res.json()) as { credits?: unknown; spentCadCents?: unknown }
    const credits = Array.isArray(data.credits) ? data.credits : []
    let coins = 0
    for (const row of credits) {
      if (!row || typeof row !== 'object') continue
      const sessionId = (row as { sessionId?: unknown }).sessionId
      const amount = (row as { coins?: unknown }).coins
      if (typeof sessionId !== 'string' || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > 100000) continue
      if (wasCheckoutRedeemed(sessionId)) continue
      rememberCheckoutRedeemed(sessionId)
      coins += amount
    }
    const spentCadCents = typeof data.spentCadCents === 'number' && data.spentCadCents >= 0 ? Math.floor(data.spentCadCents) : 0
    return { coins, spentCadCents }
  } catch {
    return { coins: 0, spentCadCents: 0 }
  }
}
