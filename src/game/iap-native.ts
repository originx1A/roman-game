/**
 * Native StoreKit (iOS) and Google Play Billing (Android) bridge.
 *
 * Loaded only inside the Capacitor app. The web build never imports this module.
 * Coins are written to the on-device wallet only after the store transaction
 * has finished (consumed / acknowledged). Cancelled, pending, and failed
 * purchases do not add coins.
 *
 * Coin packs are consumables. A finished purchase is consumed and will not
 * come back through Restore. Restore replays a payment that was charged but
 * not yet finished, and that path adds coins once.
 *
 * No remote receipt validator is configured, so receipts are not sent to a
 * developer server or to a third-party validator.
 */

import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import {
  ErrorCode,
  LogLevel,
  Platform,
  ProductType,
  store,
  type IError,
  type Transaction,
} from 'capacitor-plugin-cdv-purchase'
import { COIN_PACKS, type CoinPack, type PurchaseResult, type StoreNotice } from './iap'
import { loadWallet, saveWallet } from './storage'

const APPLIED_KEY = 'roman.iap.applied.v1'
const DEBUG_KEY = 'roman.iap.debug'

type Waiter = {
  settled: boolean
  resolve: (result: PurchaseResult) => void
}

const waiters = new Map<string, Waiter>()
const listeners = new Set<(notice: StoreNotice) => void>()
const grantsInFlight = new Set<string>()
const prices: Record<string, string> = {}

let starting: Promise<void> | null = null
let ready = false
let initProblem: string | null = null

function billingPlatform(): typeof Platform.APPLE_APPSTORE | typeof Platform.GOOGLE_PLAY {
  return Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY
}

function readApplied(): string[] {
  try {
    const raw = localStorage.getItem(APPLIED_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeApplied(ids: string[]) {
  localStorage.setItem(APPLIED_KEY, JSON.stringify(ids.slice(-300)))
}

function txKey(tx: Transaction): string {
  const id = tx.transactionId || tx.purchaseId || ''
  return id ? `${tx.platform}:${id}` : ''
}

function packFor(productId: string | undefined): CoinPack | undefined {
  if (!productId) return undefined
  return COIN_PACKS.find((pack) => pack.productId === productId)
}

function emit(notice: StoreNotice) {
  for (const listener of listeners) listener(notice)
}

/** Add coins once for a finished transaction. Returns true when the balance changes. */
function grantFinished(pack: CoinPack, quantity: number, key: string): boolean {
  const applied = readApplied()
  if (key && applied.includes(key)) return false
  const wallet = loadWallet()
  const coins = pack.coins * quantity
  saveWallet({ ...wallet, coins: wallet.coins + coins })
  if (key) writeApplied([...applied, key])
  return true
}

function settle(productId: string, result: PurchaseResult): boolean {
  const waiter = waiters.get(productId)
  if (!waiter || waiter.settled) return false
  waiter.settled = true
  waiters.delete(productId)
  waiter.resolve(result)
  return true
}

function failureMessage(error: IError): string {
  if (error.code === ErrorCode.PAYMENT_CANCELLED) return 'Purchase cancelled'
  if (error.code === ErrorCode.PAYMENT_NOT_ALLOWED) {
    return 'Purchases are not allowed on this device. No coins were added.'
  }
  if (
    error.code === ErrorCode.PRODUCT_NOT_AVAILABLE ||
    error.code === ErrorCode.INVALID_PRODUCT_ID ||
    error.code === ErrorCode.LOAD
  ) {
    return "This pack isn't in the store yet. No coins were added."
  }
  return "Purchase didn't go through. No coins were added."
}

async function onApproved(tx: Transaction) {
  const productId = tx.products[0]?.id
  const key = txKey(tx)
  if (key && grantsInFlight.has(key)) return
  if (key) grantsInFlight.add(key)

  if (tx.isPending || tx.state === 'pending') {
    if (key) grantsInFlight.delete(key)
    if (productId) {
      settle(productId, {
        ok: false,
        reason: 'Payment is pending. Coins will be added when the store finishes it.',
      })
    }
    return
  }

  const pack = packFor(productId)
  if (!pack || !productId) {
    if (key) grantsInFlight.delete(key)
    try {
      await tx.finish()
    } catch {
      /* unrelated transaction */
    }
    return
  }

  try {
    await tx.finish()
  } catch {
    if (key) grantsInFlight.delete(key)
    settle(productId, {
      ok: false,
      reason:
        "The store couldn't finish this purchase. No coins were added. Open the app again after the payment clears.",
    })
    return
  }

  const quantity = Math.max(1, Math.floor(tx.quantity ?? 1))
  const added = grantFinished(pack, quantity, txKey(tx))
  const result: PurchaseResult = {
    ok: true,
    pack,
    coins: pack.coins * quantity,
    credited: true,
  }
  const hadWaiter = settle(productId, result)
  if (added && !hadWaiter) {
    emit({ type: 'granted', coins: result.coins, label: pack.label })
  }
}

async function configureChrome() {
  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#07122a' })
  } catch {
    /* status bar plugin is unavailable outside a native shell */
  }
}

export function subscribeIap(listener: (notice: StoreNotice) => void): () => void {
  listeners.add(listener)
  if (Object.keys(prices).length > 0) {
    listener({ type: 'prices', prices: { ...prices } })
  }
  return () => listeners.delete(listener)
}

export function ensureStore(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (starting) return starting

  starting = (async () => {
    const platform = billingPlatform()
    store.verbosity = localStorage.getItem(DEBUG_KEY) === '1' ? LogLevel.DEBUG : LogLevel.WARNING

    store.register(
      COIN_PACKS.map((pack) => ({
        id: pack.productId,
        type: ProductType.CONSUMABLE,
        platform,
      })),
    )

    store.when().productUpdated((product) => {
      const label = product.pricing?.price
      if (!label) return
      prices[product.id] = label
      emit({ type: 'prices', prices: { ...prices } })
    })

    store.when().approved((tx) => {
      void onApproved(tx)
    })

    store.when().pending((tx) => {
      const productId = tx.products[0]?.id
      if (!productId) return
      settle(productId, {
        ok: false,
        reason: 'Payment is pending. Coins will be added when the store finishes it.',
      })
    })

    store.error((error) => {
      if (!error.productId) return
      if (error.code === ErrorCode.PAYMENT_CANCELLED) {
        settle(error.productId, { ok: false, reason: 'Purchase cancelled' })
        return
      }
      if (waiters.has(error.productId)) {
        settle(error.productId, { ok: false, reason: failureMessage(error) })
      }
    })

    const bridge = {
      purchase: (productId: string) => purchaseNative(productId),
      restore: () => restoreNative(),
    }
    ;(window as unknown as { RomanIAP?: typeof bridge }).RomanIAP = bridge

    const errors = await store.initialize([platform])
    const fatal = errors.filter((error) => error.code !== ErrorCode.LOAD)
    initProblem = fatal[0]?.message ?? null
    ready = true
    await configureChrome()
  })().catch((error: unknown) => {
    starting = null
    initProblem = error instanceof Error ? error.message : 'Store billing failed to start.'
    throw error
  })

  return starting
}

function waitFor(productId: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      const waiter = waiters.get(productId)
      if (!waiter || waiter.settled || Date.now() - started >= ms) {
        window.clearInterval(timer)
        resolve()
      }
    }, 50)
  })
}

export async function purchaseNative(productId: string): Promise<PurchaseResult> {
  const pack = packFor(productId)
  if (!pack) return { ok: false, reason: 'Unknown pack' }

  try {
    await ensureStore()
  } catch {
    return { ok: false, reason: 'Store billing not connected yet. Finish App Store / Play Console IAP setup.' }
  }

  if (initProblem && !ready) {
    return { ok: false, reason: 'Store billing not connected yet. Finish App Store / Play Console IAP setup.' }
  }

  if ([...waiters.values()].some((waiter) => !waiter.settled)) {
    return { ok: false, reason: 'A purchase is already open.' }
  }

  const platform = billingPlatform()
  const product = store.get(pack.productId, platform)
  const offer = product?.getOffer()
  if (!offer) {
    return { ok: false, reason: "This pack isn't in the store yet. No coins were added." }
  }

  let settledResult: PurchaseResult | null = null
  const waiter: Waiter = {
    settled: false,
    resolve: (result) => {
      settledResult = result
    },
  }
  waiters.set(pack.productId, waiter)

  let orderError: IError | undefined
  try {
    orderError = await offer.order()
  } catch {
    if (!waiter.settled) {
      waiters.delete(pack.productId)
      return { ok: false, reason: "Purchase didn't go through. No coins were added." }
    }
  }

  if (!waiter.settled && orderError) {
    waiters.delete(pack.productId)
    waiter.settled = true
    return { ok: false, reason: failureMessage(orderError) }
  }

  if (!waiter.settled) await waitFor(pack.productId, 20000)

  if (settledResult) return settledResult
  waiters.delete(pack.productId)
  return {
    ok: false,
    reason: 'The store has not finished this payment. No coins were added. If you were charged, they will appear when the store finishes it.',
  }
}

export async function restoreNative(): Promise<{ ok: boolean; message: string }> {
  try {
    await ensureStore()
  } catch {
    return { ok: false, message: 'Store billing not connected yet.' }
  }
  const error = await store.restorePurchases()
  if (error && error.code !== ErrorCode.PAYMENT_CANCELLED) {
    return { ok: false, message: "Couldn't reach the store. Nothing was changed." }
  }
  return {
    ok: true,
    message:
      'Checked the store. Finished coin packs are consumable and are not returned. A payment that was still unfinished will be added now.',
  }
}
