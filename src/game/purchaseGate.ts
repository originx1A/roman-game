/**
 * Who may open checkout.
 * Guests can play everything. Buying is faded until they sign in.
 * Signed-in buyers enter the purchase PIN before checkout opens.
 * The weekly cap is enforced again on the server.
 */
import { canSpend, ECONOMY } from './economy'

export type PurchaseMode = 'sign-in' | 'pin' | 'capped'

export interface PurchaseGate {
  mode: PurchaseMode
  /** Button label. Guests always see this exact phrase. */
  label: string
  faded: boolean
  /** Checkout opens only after the server accepts the PIN. */
  canCheckout: boolean
}

export function purchaseGate(o: {
  signedIn: boolean
  spentCadCents?: number
  priceCadCents?: number
}): PurchaseGate {
  if (!o.signedIn) {
    return { mode: 'sign-in', label: 'Sign in to buy', faded: true, canCheckout: false }
  }
  const price = o.priceCadCents ?? 0
  if (price > 0) {
    const cap = canSpend(o.spentCadCents ?? 0, price, ECONOMY.weeklySpendCapCadCents)
    if (!cap.ok) return { mode: 'capped', label: 'Weekly limit reached', faded: true, canCheckout: false }
  }
  return { mode: 'pin', label: 'Buy', faded: false, canCheckout: false }
}
