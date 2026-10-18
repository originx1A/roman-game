import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { accessToken } from '../cloud/cloud'
import {
  createPurchasePin,
  fetchPinStatus,
  forgotPurchasePin,
  resetPurchasePin,
  verifyPurchasePin,
  type PinStatus,
} from '../game/purchasePinApi'
import { isFourDigitPin, lockMessage } from '../game/purchasePin'
import { PurchaseAgreeLine, LegalBuyLink } from './LegalPurchases'
import type { LegalSection } from '../game/legalCopy'

/**
 * Parent-set 4-digit PIN. Shown before every coin purchase.
 * The digits go to the server once and are not kept on the device.
 */
export function PurchasePinSheet({
  open,
  intent,
  signedIn,
  onClose,
  onGranted,
  onSaved,
  onOpenLegal,
}: {
  open: boolean
  /** purchase asks for the PIN. reset is the page opened from the email. */
  intent: 'purchase' | 'reset'
  signedIn: boolean
  onClose: () => void
  onGranted: (grant: string) => void
  onSaved?: () => void
  onOpenLegal: (section: LegalSection) => void
}) {
  const [status, setStatus] = useState<PinStatus | null>(null)
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!open) return
    setPin('')
    setAgain('')
    setError('')
    setInfo('')
    setShow(false)
    setStatus(null)
    if (!signedIn) {
      if (intent === 'purchase') setError('Sign in to buy')
      return
    }
    let cancel = false
    void accessToken().then(async (token) => {
      if (!token || cancel) {
        if (!cancel) setError('Sign in to buy')
        return
      }
      const next = await fetchPinStatus(token)
      if (cancel) return
      if (!next) {
        setError('Purchases are unavailable right now.')
        return
      }
      setStatus(next)
    })
    return () => {
      cancel = true
    }
  }, [open, intent, signedIn])

  if (!open || typeof document === 'undefined') return null

  const locked = status?.locked === true
  const unverified = status?.emailVerified === false
  const creating = intent === 'purchase' && status?.hasPin === false && !unverified
  const settingNew = intent === 'reset' && status?.resetReady === true && !unverified
  const entering = intent === 'purchase' && status?.hasPin === true && !locked && !unverified
  const showFields = creating || settingNew || entering

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const token = await accessToken()
    if (!token) {
      setError('Sign in to buy')
      return
    }
    if (locked && intent !== 'reset') return
    setBusy(true)
    try {
      if (creating || settingNew) {
        if (!isFourDigitPin(pin) || pin !== again) {
          setError(pin === again ? 'Choose a 4-digit PIN.' : 'Those PINs did not match. Type the same 4 digits twice.')
          return
        }
        const result = settingNew ? await resetPurchasePin(token, pin, again) : await createPurchasePin(token, pin, again)
        if (!result.ok) {
          setError(result.reason)
          return
        }
        if (settingNew || !result.grant) {
          onSaved?.()
          onClose()
          return
        }
        onGranted(result.grant)
        return
      }
      if (!isFourDigitPin(pin)) {
        setError('Enter the 4-digit purchase PIN.')
        return
      }
      const result = await verifyPurchasePin(token, pin)
      if (!result.ok) {
        setError(result.reason)
        const next = await fetchPinStatus(token)
        if (next) setStatus(next)
        return
      }
      if (!result.grant) {
        setError('Enter the purchase PIN.')
        return
      }
      onGranted(result.grant)
    } finally {
      setBusy(false)
    }
  }

  async function onForgot() {
    setError('')
    setInfo('')
    const token = await accessToken()
    if (!token) {
      setError('Sign in to buy')
      return
    }
    setBusy(true)
    const result = await forgotPurchasePin(token)
    setBusy(false)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setInfo('We sent a link to the sign-in email. Open it to choose a new PIN.')
  }

  const title = creating ? 'Set a purchase PIN' : settingNew ? 'New purchase PIN' : 'Purchase PIN'
  const node = (
    <div className="start-sheet pin-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="start-sheet-scrim" onClick={onClose} />
      <form className="start-sheet-card" onSubmit={(e) => void onSubmit(e)}>
        <h3>{title}</h3>
        {creating ? (
          <p className="start-sheet-tip">
            A grown-up chooses 4 digits. The game asks for them before every coin purchase. Apple Pay and Google Pay can use the phone&apos;s Face ID or fingerprint on the payment page. A typed card is there too. The card is not saved.
          </p>
        ) : settingNew ? (
          <p className="start-sheet-tip">Choose a new 4-digit purchase PIN. The old one stops working.</p>
        ) : intent === 'reset' ? (
          <p className="start-sheet-tip">Open the link in the sign-in email, then choose a new PIN here.</p>
        ) : (
          <p className="start-sheet-tip">Enter the purchase PIN. The payment page opens after it matches.</p>
        )}
        {unverified ? (
          <p className="cloud-err" role="alert">Open the link in the sign-in email. A purchase PIN can be set or reset only after that email is verified.</p>
        ) : null}
        {locked && intent !== 'reset' ? (
          <p className="cloud-err" role="alert">{lockMessage(status?.retryInMs ?? 0)}</p>
        ) : null}
        {!status && !error ? <p className="start-sheet-tip">One moment…</p> : null}
        {showFields ? (
          <>
            <input
              className="name-input"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              aria-label={creating || settingNew ? 'New purchase PIN' : 'Purchase PIN'}
              type={show ? 'text' : 'password'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            {creating || settingNew ? (
              <input
                className="name-input"
                inputMode="numeric"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={4}
                aria-label="Type the purchase PIN again"
                type={show ? 'text' : 'password'}
                value={again}
                onChange={(e) => setAgain(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            ) : null}
            <label className="cloud-check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              <span>Show digits</span>
            </label>
          </>
        ) : null}
        {error ? <p className="cloud-err" role="alert">{error}</p> : null}
        {info ? <p className="start-sheet-tip">{info}</p> : null}
        {intent === 'purchase' && !unverified ? <PurchaseAgreeLine onOpen={onOpenLegal} /> : null}
        {showFields ? (
          <button type="submit" className="btn primary" disabled={busy}>
            {creating || settingNew ? 'Save PIN' : 'Continue'}
          </button>
        ) : null}
        <LegalBuyLink onOpen={onOpenLegal} />
        {status?.hasPin && intent === 'purchase' ? (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void onForgot()}>
            Email a reset link
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={onClose}>Not now</button>
      </form>
    </div>
  )
  return createPortal(node, document.body)
}
