import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, loadConsent, saveConsent, onCloud, savePlayerName, sendMagicLink, signOut, verifyEmailCode, type CloudState } from './cloud'
import { useTurnstile } from './useTurnstile'

/**
 * "Save my scores" button + sheets.
 * Phone opens a short card first (no age question). Email is the existing magic-link sheet, with the 13+ and Terms boxes.
 * Saving with no email, and linking a parent, are not on this preview: those sheets say so instead of inventing an account.
 * The whole chosen name is shown publicly (the server adds 02, 03... if it's taken); bad words are rejected on the spot.
 */

/** Phone asks with the save card. Desktop still opens the email sheet. */
function phoneSaveCard(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.device === 'phone'
}
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'offer' | 'email' | 'sent' | 'name' | 'account' | 'parent' | 'noemail' | 'parentlink'

export function CloudScoresButton({ suggestedName, compact, short, onInfo, cta, forceOffer, hidden, onClose }: { suggestedName?: string; compact?: boolean; short?: boolean; onInfo?: () => void; cta?: string; forceOffer?: boolean; hidden?: boolean; onClose?: () => void }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(forceOffer ? 'offer' : null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [terms, setTerms] = useState(false)
  const captchaOn = sheet === 'email' || sheet === 'sent'
  const captcha = useTurnstile(captchaOn)
  const consentChecks = (
    <div className="cloud-checks">
      <label className="cloud-check">
        <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
        <span>I'm 13 or older</span>
      </label>
      <label className="cloud-check">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          I agree to the{' '}
          <a href="https://romansgame.com/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            Terms
          </a>{' '}
          and{' '}
          <a href="./privacy.html" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            Privacy
          </a>
        </span>
      </label>
      <label className="cloud-check">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        <span>Get Roman's World News: the story behind this game. Unsubscribe anytime.</span>
      </label>
      {/* Kit newsletter only: unsubscribing there never touches the game account */}
    </div>
  )

  // Signed in from the link or the code. No name yet: ask once. Code sign-in of a named player: show the account.
  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    if (cloud.name === null) setSheet((s) => (s === 'account' || s === 'parent' || s === 'noemail' || s === 'parentlink' || s === 'offer' ? s : 'name'))
    else setSheet((s) => (s === 'sent' ? 'account' : s))
  }, [cloud.status, cloud.name])

  function closeSheet() {
    setSheet(null)
    onClose?.()
  }

  const label = short
    ? cloud.status === 'signed-in' && cloud.name
      ? 'Scores'
      : 'Sign in'
    : cloud.status === 'signed-in' && cloud.name
      ? `☁ Scores saving as ${cloud.publicName ?? cloud.name}${cloud.pending ? ` (${cloud.pending} waiting)` : ''}`
      : cloud.pending
        ? `☁ Save my scores (${cloud.pending} waiting)`
        : '☁ Save my scores'

  /** Families sharing a phone: sign this player out (their unsent scores stay theirs) and sign in someone else */
  async function switchPlayer() {
    await signOut()
    setEmail('')
    setCode('')
    setName('')
    setAge13(false)
    setOptIn(false)
    setTerms(false)
    saveConsent({ age13: false, optIn: false })
    setErr('')
    setSheet(phoneSaveCard() ? 'offer' : 'email')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''

  return (
    <>
      {!hidden && (
      <button
        type="button"
        data-testid={cta ? 'board-signin' : 'save-scores'}
        className={cta ? 'btn primary board-cta' : `btn ghost cloud-btn${compact ? ' is-compact' : ''}${short ? ' is-short' : ''}`}
        onClick={() => {
          setErr('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : phoneSaveCard() ? 'offer' : 'email')
        }}
      >
        {cta ?? label}
      </button>
      )}
      {!hidden && !short && cloud.status === 'signed-in' && cloud.name && (
        <button type="button" className={`btn ghost cloud-switch${compact ? ' is-compact' : ''}`} onClick={() => void switchPlayer()}>
          Switch player
        </button>
      )}
      {sheet &&
        createPortal(
          <div className="start-sheet cloud-sheet" data-testid="save-sheet" role="dialog" aria-modal="true" aria-label={sheet === 'offer' ? 'Save your scores?' : 'Save my scores'}>
            <div className="start-sheet-scrim" onClick={closeSheet} />
            {onInfo ? (
              <button type="button" className="sheet-info" onClick={onInfo}>
                Info
              </button>
            ) : null}
            {captchaOn && (
              <div className="start-sheet-card">
                <div className="cloud-turnstile" ref={captcha.box} />
                {sheet === 'email' && (
              <form
                className="cloud-auth-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!age13) return setSheet('parent')
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  saveConsent({ age13, optIn })
                  setBusy(true)
                  setErr('')
                  const token = await captcha.takeToken()
                  if (!token) {
                    setErr(captcha.reason() || "This page couldn't complete the check. Try again.")
                    captcha.reset()
                    setBusy(false)
                    return
                  }
                  const r = await sendMagicLink(email, token)
                  captcha.reset()
                  setBusy(false)
                  if (r.ok) {
                    setErr('')
                    setSheet('sent')
                  } else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Save your scores</h3>
                <p className="start-sheet-tip">
                  Get on the leaderboard and keep your scores on any device. We'll email you a sign-in link and the code from your email. No password.
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                {consentChecks}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </form>
                )}
                {sheet === 'sent' && (
              <form
                className="cloud-auth-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!/^\d{6,8}$/.test(code)) return setErr('Enter the code from your email.')
                  setBusy(true)
                  setErr('')
                  const token = await captcha.takeToken()
                  if (!token) {
                    setErr(captcha.reason() || "This page couldn't complete the check. Try again.")
                    captcha.reset()
                    setBusy(false)
                    return
                  }
                  const r = await verifyEmailCode(email, code, token)
                  captcha.reset()
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Check your email</h3>
                <p className="start-sheet-tip">
                  We sent it to <b>{email.trim()}</b>. Tap the link in your email, or enter the code from your email.
                </p>
                <input
                  className="name-input cloud-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="the code from your email"
                  aria-label="the code from your email"
                  value={code}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text').replace(/\s/g, '').replace(/\D/g, '').slice(0, 8)
                    if (!text) return
                    e.preventDefault()
                    setCode(text)
                    setErr('')
                  }}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 8))
                    setErr('')
                  }}
                />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || code.length < 6}>
                  {busy ? 'Checking…' : 'Sign in with code'}
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </form>
                )}
                {captcha.note && !err && <p className="cloud-err" role="alert">{captcha.note}</p>}
              </div>
            )}
            {sheet === 'name' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!name.trim() || nameProblem) return
                  if (!age13) return setSheet('parent')
                  if (!loadConsent()?.age13 && !terms) return setErr('Please agree to the Terms and Privacy.')
                  setBusy(true)
                  const r = await savePlayerName(name, { age13, optIn })
                  setBusy(false)
                  if (r.ok) {
                    if (r.publicName && r.publicName !== name.trim()) setSheet('account')
                    else closeSheet()
                  } else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Pick your leaderboard name</h3>
                <p className="start-sheet-tip">
                  This name will be shown publicly on the leaderboard, so don't use your full real name. If someone already has it, we'll add a number (like {name.trim() && !nameProblem ? `${name.trim()}02` : 'Mike02'}). You only do this once.
                </p>
                <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                {!loadConsent()?.age13 && consentChecks}
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
                  {busy ? 'Saving…' : 'Save name'}
                </button>
              </form>
            )}
            {sheet === 'offer' && (
              <div className="start-sheet-card cloud-offer" data-testid="save-offer">
                <h3>Save your scores?</h3>
                <button type="button" className="btn primary" onClick={() => { setErr(''); setSheet('email') }}>
                  Save with email (13+)
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('noemail') }}>
                  Save without email
                </button>
                <button type="button" className="cloud-quiet" onClick={() => { setErr(''); setSheet('parentlink') }}>
                  Link to a parent's account
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </div>
            )}
            {sheet === 'noemail' && (
              <div className="start-sheet-card" data-testid="save-no-email">
                <h3>Save without email</h3>
                <p className="start-sheet-tip">Not on this preview yet. Scores stay on this device.</p>
                <button type="button" className="btn ghost" onClick={() => setSheet('offer')}>
                  Back
                </button>
              </div>
            )}
            {sheet === 'parentlink' && (
              <div className="start-sheet-card" data-testid="save-parent-link">
                <h3>Link to a parent's account</h3>
                <p className="start-sheet-tip">Not on this preview yet.</p>
                <button type="button" className="btn ghost" onClick={() => setSheet('offer')}>
                  Back
                </button>
              </div>
            )}
            {sheet === 'parent' && (
              <div className="start-sheet-card" data-testid="save-age-gate">
                <h3>Email is for ages 13+</h3>
                <p className="start-sheet-tip">You can save without an email instead.</p>
                <button type="button" className="btn primary" onClick={() => setSheet('noemail')}>
                  Save without email
                </button>
                <button type="button" className="cloud-quiet" onClick={() => setSheet('parentlink')}>
                  Link to a parent's account
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
                {cloud.status === 'signed-in' && (
                  <button type="button" className="btn ghost" onClick={() => { void signOut(); closeSheet() }}>
                    Sign out
                  </button>
                )}
              </div>
            )}
            {sheet === 'account' && (
              <div className="start-sheet-card">
                <h3>Scores are saving</h3>
                <p className="start-sheet-tip">
                  Signed in as {cloud.email}. Leaderboard name: <b>{cloud.publicName ?? cloud.name}</b>.
                  {cloud.pending ? ` ${cloud.pending} score${cloud.pending === 1 ? '' : 's'} will send when you're back online.` : ' Every game you finish is saved.'}
                </p>
                <button type="button" className="btn primary" onClick={closeSheet}>
                  Done
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void switchPlayer()}
                >
                  Switch player
                </button>
                <button type="button" className="btn ghost" onClick={() => { void signOut(); closeSheet() }}>
                  Sign out
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
