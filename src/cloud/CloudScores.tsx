import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { KeyboardNameSheet, useKeyboardNameEntry } from '../components/KeyboardNameSheet'
import { isProfane } from './profanity'
import { NAME_MAX, cloudState, loadConsent, saveConsent, onCloud, renamePlayer, savePlayerName, scoreSaveLabel, sendMagicLink, signInCode, signInEmail, signOut, verifyEmailCode, type CloudState } from './cloud'

/**
 * "Save my scores" button + sheets: email magic link or the code from that email, then a one-time name prompt.
 * The whole chosen name is shown publicly (the server adds 02, 03... if it's taken); bad words are rejected on the spot.
 * Switching player is a separate choice. Opening that sheet, or tapping Not now, never signs the current player out.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>(() => cloudState())
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'email' | 'sent' | 'name' | 'account' | 'parent'

/** What the compact victory sheet needs: status, not a second big save button. */
export type CloudScoreActions = {
  saving: boolean
  needsName: boolean
  pending: number
  publicName?: string
  openSignIn: () => void
  switchPlayer: () => void
}

export function CloudScoresButton({
  suggestedName,
  compact,
  children,
}: {
  suggestedName?: string
  compact?: boolean
  /** When set, the big Save button is not rendered. The sheet still is. */
  children?: (actions: CloudScoreActions) => ReactNode
}) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [email, setEmail] = useState('')
  const [sentEmail, setSentEmail] = useState('')
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [frame, setFrame] = useState<{ top: number; height: number } | null>(null)
  const sendingRef = useRef(false)
  const verifyingRef = useRef(false)
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [switchedAway, setSwitchedAway] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [nameDismissed, setNameDismissed] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [terms, setTerms] = useState(false)
  const touchName = useKeyboardNameEntry()
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

  // Signed in from the link or the code. No name yet: ask once. A named player: close the code sheet.
  // Never steal the sheet during an explicit switch.
  useEffect(() => {
    if (switching || nameDismissed) return
    if (cloud.status !== 'signed-in') return
    if (cloud.name === null) setSheet((s) => (s === 'account' ? s : 'name'))
    else setSheet((s) => (s === 'sent' ? null : s))
  }, [cloud.status, cloud.name, switching, nameDismissed])

  // Keep the open sheet inside the visible viewport. A phone keyboard shrinks visualViewport
  // and leaves position:fixed covering the full layout, so the code box would sit underneath it.
  useEffect(() => {
    if (!sheet) return
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      const covered = window.innerHeight - vv.offsetTop - vv.height
      setFrame(covered > 40 ? { top: vv.offsetTop, height: vv.height } : null)
      const el = document.activeElement
      if (el instanceof HTMLElement && el.dataset.testid === 'signin-code') el.scrollIntoView({ block: 'center' })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      setFrame(null)
    }
  }, [sheet])

  const signedIn = cloud.status === 'signed-in'
  const label = scoreSaveLabel(cloud)

  /** Close whatever sheet is open. Never signs out and never changes the player. */
  function closeSheet() {
    if (sheet === 'name') setNameDismissed(true)
    setSwitching(false)
    setSwitchedAway(false)
    setEditing(false)
    setErr('')
    setSheet(null)
  }

  /**
   * One send at a time. Re-renders never call this. A second send would invalidate the code
   * already in the email, so only the email button and "Send a new code" may call it.
   */
  async function deliverLink(address: string): Promise<boolean> {
    if (sendingRef.current) return false
    sendingRef.current = true
    setBusy(true)
    setErr('')
    try {
      const r = await sendMagicLink(address)
      if (!r.ok || !r.email) {
        setErr(r.error ?? 'Something went wrong.')
        return false
      }
      setSentEmail(r.email)
      setEmail(r.email)
      setSentAt(r.sentAt ?? Date.now())
      setCode('')
      return true
    } finally {
      sendingRef.current = false
      setBusy(false)
    }
  }

  /** Explicit switch only. The current player stays signed in until a new link is actually sent. */
  function beginSwitch() {
    setSwitching(true)
    setEditing(false)
    setErr('')
    setEmail('')
    setCode('')
    if (cloud.status === 'signed-in') setAge13(true)
    setSheet('email')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''
  const editProblem = !nameEdit.trim() ? '' : isProfane(nameEdit) ? "Let's pick a different name. Keep it friendly!" : ''
  function openSignIn() {
    setErr('')
    setSwitching(false)
    setEditing(false)
    setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'email')
  }
  const actions: CloudScoreActions = {
    saving: signedIn,
    needsName: cloud.status === 'signed-in' && !cloud.name,
    pending: cloud.pending,
    publicName: cloud.publicName ?? (cloud.name || undefined),
    openSignIn,
    switchPlayer: beginSwitch,
  }
  const nameInKeyboard = touchName && sheet === 'name'
  const nameForm = (
    <form
      className="start-sheet-card"
      onSubmit={async (e) => {
        e.preventDefault()
        const active = document.activeElement
        if (active instanceof HTMLElement) active.blur()
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
      <div className="kb-name-copy">
        <h3>Pick your leaderboard name</h3>
        <p className="start-sheet-tip">
          This name will be shown publicly on the leaderboard, so don't use your full real name. If someone already has it, we'll add a number (like {name.trim() && !nameProblem ? `${name.trim()}02` : 'Mike02'}). You only do this once.
        </p>
      </div>
      <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" enterKeyHint="done" placeholder="Your name" aria-label="Your name" data-testid="leaderboard-name" value={name} onChange={(e) => setName(e.target.value)} />
      {!loadConsent()?.age13 && consentChecks}
      {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
      <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
      <button type="button" className="btn ghost" data-testid="cloud-not-now" onClick={closeSheet}>
        Not now
      </button>
    </form>
  )

  return (
    <>
      {children ? (
        children(actions)
      ) : (
        <button
          type="button"
          className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
          data-testid="save-scores"
          onClick={openSignIn}
        >
          {label}
        </button>
      )}
      {nameInKeyboard && (
        <KeyboardNameSheet label="Pick your leaderboard name" onDismiss={closeSheet}>
          {nameForm}
        </KeyboardNameSheet>
      )}
      {sheet && !nameInKeyboard &&
        createPortal(
          <div
            className="start-sheet cloud-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={switching ? 'Switch player' : signedIn ? 'Your scores' : 'Save my scores'}
            style={frame ? { top: frame.top, height: frame.height, bottom: 'auto' } : undefined}
          >
            <div className="start-sheet-scrim" onClick={closeSheet} />
            {sheet === 'email' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!age13) return setSheet('parent')
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  const address = signInEmail(email)
                  if (!/^\S+@\S+\.\S+$/.test(address)) return setErr('Type a full email address.')
                  saveConsent({ age13, optIn })
                  const ok = await deliverLink(address)
                  if (!ok) return
                  // Only a sent link switches players. A failed send leaves the current player signed in.
                  if (switching) {
                    await signOut()
                    setSwitchedAway(true)
                  }
                  setSwitching(false)
                  setNotice('')
                  setSheet('sent')
                }}
              >
                <h3>{switching ? 'Switch player' : 'Save your scores'}</h3>
                <p className="start-sheet-tip">
                  {switching
                    ? `You're signed in as ${cloud.publicName ?? cloud.name ?? cloud.email}. Not now keeps this player. We'll only switch after the new sign-in link is sent.`
                    : "Get on the leaderboard and keep your scores on any device. We'll email you a sign-in link and the code from your email. No password."}
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                {consentChecks}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
                <button type="button" className="btn ghost" data-testid="cloud-not-now" onClick={closeSheet}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'sent' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const digits = signInCode(code)
                  // 6 to 10 digits. A shorter prefix must not call verifyOtp.
                  // A second submit (double click, or Enter plus the button) must not start another check.
                  if (digits.length < 6 || digits.length > 10 || verifyingRef.current) return
                  verifyingRef.current = true
                  setBusy(true)
                  try {
                    const r = await verifyEmailCode(sentEmail || signInEmail(email), digits)
                    if (!r.ok) setErr(r.error ?? 'Code expired or already used, send a new one.')
                    // A good code signs them in. The listener closes this sheet, or asks for a name once.
                  } finally {
                    verifyingRef.current = false
                    setBusy(false)
                  }
                }}
              >
                <h3>Check your email</h3>
                <p className="start-sheet-tip">
                  {switchedAway
                    ? <>We sent it to <b>{sentEmail || signInEmail(email)}</b>. Tap the link, or enter the code from your email, to finish switching. This device stays signed out until then.</>
                    : <>We sent it to <b>{sentEmail || signInEmail(email)}</b>. Tap the link in your email, or enter the code from your email.</>}
                </p>
                {sentAt && sentEmail && (
                  <p className="start-sheet-tip" data-testid="signin-sent-at">
                    Code sent at {new Date(sentAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} to {sentEmail}. Use the newest email.
                  </p>
                )}
                {notice && <p className="start-sheet-tip" data-testid="signin-notice">{notice}</p>}
                <input
                  className="name-input cloud-code"
                  data-testid="signin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  maxLength={10}
                  placeholder="Code from your email"
                  aria-label="the code from your email"
                  value={code}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center' })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && signInCode(code).length < 6) e.preventDefault()
                  }}
                  onPaste={(e) => {
                    const text = signInCode(e.clipboardData.getData('text'))
                    if (!text) return
                    e.preventDefault()
                    setCode(text)
                    setErr('')
                  }}
                  onChange={(e) => {
                    // Typing a digit must not submit. Only the button or Enter does, and only once.
                    setCode(signInCode(e.target.value))
                    setErr('')
                  }}
                />
                {err && <p className="cloud-err" role="alert" data-testid="signin-code-error">{err}</p>}
                <button type="submit" className="btn primary" data-testid="signin-code-submit" disabled={busy || signInCode(code).length < 6}>
                  {busy ? 'Checking…' : 'Sign in with code'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  data-testid="signin-resend"
                  disabled={busy}
                  onClick={() => {
                    void deliverLink(sentEmail || email).then((ok) => {
                      if (ok) setNotice('New code sent. The previous one will not work.')
                    })
                  }}
                >
                  Send a new code
                </button>
                <button type="button" className="btn ghost" data-testid="cloud-not-now" onClick={closeSheet}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'name' && nameForm}
            {sheet === 'parent' && (
              <div className="start-sheet-card">
                <h3>Ask a parent to sign up for you</h3>
                <p className="start-sheet-tip">
                  You need to be 13 or older to make an account. You can keep playing everything without one. Your scores just stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={closeSheet}>
                  Keep playing
                </button>
              </div>
            )}
            {sheet === 'account' && (
              <div className="start-sheet-card">
                <h3>Saved to your account ✓</h3>
                {editing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!nameEdit.trim() || editProblem) return
                      setBusy(true)
                      const r = await renamePlayer(nameEdit)
                      setBusy(false)
                      if (!r.ok) setErr(r.error ?? "Couldn't save your name.")
                      else {
                        setEditing(false)
                        setErr('')
                      }
                    }}
                  >
                    <p className="start-sheet-tip">This updates your name on shared scores and on the leaderboard.</p>
                    <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" aria-label="Your name" value={nameEdit} onChange={(e) => setNameEdit(e.target.value)} />
                    {(editProblem || err) && <p className="cloud-err" role="alert">{editProblem || err}</p>}
                    <button type="submit" className="btn primary" disabled={busy || !nameEdit.trim() || !!editProblem}>
                      {busy ? 'Saving…' : 'Save name'}
                    </button>
                    <button type="button" className="btn ghost" data-testid="cloud-not-now" onClick={() => { setEditing(false); setErr('') }}>
                      Not now
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="start-sheet-tip">
                      Signed in as {cloud.email}. Leaderboard name: <b className="player-name-mark">{cloud.publicName ?? cloud.name}</b>.
                      {cloud.pending ? ` ${cloud.pending} score${cloud.pending === 1 ? '' : 's'} will send when you're back online.` : ' Every game you finish is saved.'}
                    </p>
                    <button type="button" className="btn primary" onClick={closeSheet}>
                      Done
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setNameEdit(cloud.name ?? '')
                        setErr('')
                        setEditing(true)
                      }}
                    >
                      Change name
                    </button>
                    <button type="button" className="btn ghost" data-testid="switch-player" onClick={beginSwitch}>
                      Switch player
                    </button>
                    <button type="button" className="btn ghost" onClick={() => { void signOut(); closeSheet() }}>
                      Sign out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
