import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, loadConsent, saveConsent, onCloud, savePlayerName, sendMagicLink, signOut, verifyEmailCode, type CloudState } from './cloud'

/**
 * "Save my scores" button + sheets, chooser-first (Tony 2026-11-07): the box opens on two
 * options only — Sign in or Create account. Picking one swaps in that job's own screen:
 * sign-in is email + the code from that email (no password, no checkboxes); creating adds the
 * 13-or-older / Terms / newsletter questions, which live on the create screen only, then the
 * same code step and a one-time name prompt. The whole chosen name is shown publicly (the
 * server adds 02, 03... if it's taken); bad words are rejected on the spot.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'start' | 'signin' | 'create' | 'sent' | 'name' | 'account' | 'parent'

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  /** Which door the code screen was reached from — its heading and switch link follow it. */
  const [flow, setFlow] = useState<'signin' | 'create'>('signin')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [terms, setTerms] = useState(false)
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
    if (cloud.name === null) setSheet((s) => (s === 'account' ? s : 'name'))
    else setSheet((s) => (s === 'sent' ? 'account' : s))
  }, [cloud.status, cloud.name])

  // One shared email field for both doors — switching screens never wipes what was typed.
  const emailField = (
    <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
  )

  /** Email step shared by both doors: validate, then send the same sign-in email as always. */
  async function sendCode(from: 'signin' | 'create') {
    if (from === 'create') {
      if (!age13) return setSheet('parent')
      if (!terms) return setErr('Please agree to the Terms and Privacy.')
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
    if (from === 'create') saveConsent({ age13, optIn })
    setFlow(from)
    setBusy(true)
    const r = await sendMagicLink(email)
    setBusy(false)
    if (r.ok) setSheet('sent')
    else setErr(r.error ?? 'Something went wrong.')
  }

  const label =
    cloud.status === 'signed-in' && cloud.name
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
    setSheet('start')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''

  return (
    <>
      <button
        type="button"
        className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
        onClick={() => {
          setErr('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'start')
        }}
      >
        {label}
      </button>
      {cloud.status === 'signed-in' && cloud.name && (
        <button type="button" className={`btn ghost cloud-switch${compact ? ' is-compact' : ''}`} onClick={() => void switchPlayer()}>
          Switch player
        </button>
      )}
      {sheet &&
        createPortal(
          <div className="start-sheet cloud-sheet" role="dialog" aria-modal="true" aria-label="Save my scores">
            <div className="start-sheet-scrim" onClick={() => setSheet(null)} />
            {sheet === 'start' && (
              <div className="start-sheet-card">
                <h3>Save your scores</h3>
                <p className="start-sheet-tip">
                  Get on the leaderboard and keep your scores on any device. No password — we email you a sign-in link and a code.
                </p>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setErr('')
                    setSheet('signin')
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setErr('')
                    setSheet('create')
                  }}
                >
                  Create account
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </div>
            )}
            {sheet === 'signin' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await sendCode('signin')
                }}
              >
                <h3>Sign in</h3>
                <p className="start-sheet-tip">We'll email you a sign-in link and a code. Enter the code here and you're in.</p>
                {emailField}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me my sign-in code'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setErr('')
                    setSheet('create')
                  }}
                >
                  New here? Create account instead
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'create' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await sendCode('create')
                }}
              >
                <h3>Create your account</h3>
                <p className="start-sheet-tip">
                  We'll email you a sign-in link and a code. Enter the code, pick your leaderboard name, and your account is ready.
                </p>
                {emailField}
                {consentChecks}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me my sign-in code'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setErr('')
                    setSheet('signin')
                  }}
                >
                  Already have an account? Sign in instead
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'sent' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!/^\d{6,8}$/.test(code)) return setErr('Enter the code from your email.')
                  setBusy(true)
                  const r = await verifyEmailCode(email, code)
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>{flow === 'create' ? 'Enter your code to finish' : 'Check your email'}</h3>
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
                  {busy ? 'Checking…' : flow === 'create' ? 'Create my account' : 'Sign in with code'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </form>
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
                  if (r.ok) setSheet(r.publicName && r.publicName !== name.trim() ? 'account' : null)
                  else setErr(r.error ?? 'Something went wrong.')
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
            {sheet === 'parent' && (
              <div className="start-sheet-card">
                <h3>Ask a parent to sign up for you</h3>
                <p className="start-sheet-tip">
                  You need to be 13 or older to make an account. You can keep playing everything without one. Your scores just stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Keep playing
                </button>
                {cloud.status === 'signed-in' && (
                  <button type="button" className="btn ghost" onClick={() => { void signOut(); setSheet(null) }}>
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
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Close
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Done
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void switchPlayer()}
                >
                  Switch player
                </button>
                <button type="button" className="btn ghost" onClick={() => { void signOut(); setSheet(null) }}>
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
