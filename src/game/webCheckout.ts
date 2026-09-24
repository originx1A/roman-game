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

/** Send the player to hosted Checkout. Never call this from the native app. */
export async function startWebCheckout(packId: CoinPackId): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isStoreBuild()) return { ok: false, reason: 'Purchases are unavailable right now.' }
  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ packId }),
    })
    const data = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null
    if (!res.ok) {
      const reason = res.status === 400 && typeof data?.error === 'string' ? data.error : 'Purchases are unavailable right now.'
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
export async function confirmWebCheckout(sessionId: string): Promise<WebCheckoutResult> {
  if (isStoreBuild()) return { ok: false, reason: 'Purchases are unavailable right now.' }
  try {
    const res = await fetch('/api/confirm-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
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
