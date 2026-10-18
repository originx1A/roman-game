/**
 * Who may open checkout.
 * Guests can play everything. Buying is faded until they sign in.
 * Signed-in buyers answer a grown-up question before checkout opens.
 * The weekly cap is enforced again on the server.
 */
import { canSpend, ECONOMY } from './economy'

export type PurchaseMode = 'sign-in' | 'grown-up' | 'ready' | 'capped'

export interface PurchaseGate {
  mode: PurchaseMode
  /** Button label. Guests always see this exact phrase. */
  label: string
  faded: boolean
  /** Checkout may open only after sign-in and the grown-up check. */
  canCheckout: boolean
}

export function purchaseGate(o: {
  signedIn: boolean
  grownUpOk: boolean
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
  if (!o.grownUpOk) {
    return { mode: 'grown-up', label: 'Ask a grown-up', faded: false, canCheckout: false }
  }
  return { mode: 'ready', label: 'Buy', faded: false, canCheckout: true }
}

export interface GrownUpQuestion {
  a: number
  b: number
  prompt: string
  answer: number
}

/** A short multiplication, not an "I'm 13" checkbox. Seeded so tests can pin it. */
export function grownUpQuestion(seed: number): GrownUpQuestion {
  const n = Math.abs(Math.floor(seed)) || 1
  const a = 3 + (n % 7)
  const b = 3 + (Math.floor(n / 7) % 7)
  return { a, b, prompt: `Ask a grown-up: what is ${a} × ${b}?`, answer: a * b }
}

export function checkGrownUp(q: GrownUpQuestion, rawAnswer: string, cardHolder: boolean): boolean {
  if (!cardHolder) return false
  const answer = Number(String(rawAnswer).trim())
  return Number.isInteger(answer) && answer === q.answer
}

/** How long a passed check lasts in this tab. A new visit asks again. */
export const GROWN_UP_MS = 30 * 60 * 1000

export function grownUpStillOk(passedAt: number | null, now: number): boolean {
  return passedAt != null && now >= passedAt && now - passedAt < GROWN_UP_MS
}
