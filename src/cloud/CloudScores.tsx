import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, loadConsent, saveConsent, onCloud, savePlayerName, sendMagicLink, signOut, verifyEmailCode, type CloudState } from './cloud'

/**
 * The login door (LOGIN-EXPERIENCE-SPEC-v1, Tony 2026-10-22): one field — player name
 * or email — then one question per screen, modelled on the Muse login Tony uses.
 * Returning players are NEVER asked the sign-up questions again: email -> code -> in,
 * name -> password -> in. The 13+/Terms checks live ONLY on the create path and on
 * the one-time name prompt that completes a first sign-in. "Remember this device"
 * is honoured by rg_remember: a device that said "don't remember" signs out on the
 * next fresh visit. Name + password sign-in itself lands with the accounts backend
 * (PR #62) — until then that screen says so honestly instead of faking a sign-in.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'entry' | 'sent' | 'namepw' | 'create' | 'name' | 'account' | 'parent'
const REMEMBER_KEY = 'rg_remember'

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [idv, setIdv] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [terms, setTerms] = useState(false)

  /* Remember-this-device enforcement: a previous sign-in that unchecked the box
     gets signed out when a fresh browser session first renders this button. */
  useEffect(() => {
    try {
      if (localStorage.getItem(REMEMBER_KEY) === '0' && !sessionStorage.getItem('rg_alive')) {
        sessionStorage.setItem('rg_alive', '1')
        void signOut()
      } else {
        sessionStorage.setItem('rg_alive', '1')
      }
    } catch {
      /* storage unavailable: stay signed in */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Signed in from the link or the code. No name yet: ask once (that prompt IS part
  // of creating the account). A named returning player just lands on the account.
  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    if (cloud.name === null) setSheet((s) => (s === 'account' ? s : 'name'))
    else setSheet((s) => (s === 'sent' ? 'account' : s))
  }, [cloud.status, cloud.name])

  const label =
    cloud.status === 'signed-in' && cloud.name
      ? `☁ Scores saving as ${cloud.publicName ?? cloud.name}${cloud.pending ? ` (${cloud.pending} waiting)` : ''}`
      : cloud.pending
        ? `☁ Log in — save my scores (${cloud.pending} waiting)`
        : '☁ Log in — save my scores'

  /** Families sharing a phone: log this player out (their unsent scores stay theirs) and start the door fresh */
  async function switchPlayer() {
    await signOut()
    setIdv('')
    setEmail('')
    setCode('')
    setName('')
    setPw('')
    setAge13(false)
    setOptIn(false)
    setTerms(false)
    saveConsent({ age13: false, optIn: false })
    setErr('')
    setNote('')
    setSheet('entry')
  }

  async function logOut() {
    await signOut()
    setSheet(null)
  }

  async function sendCode(to: string) {
    setBusy(true)
    const r = await sendMagicLink(to)
    setBusy(false)
    if (r.ok) {
      setEmail(to)
      setCode('')
      setErr('')
      setSheet('sent')
    } else setErr(r.error ?? 'Something went wrong.')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''
  const emblem = (
    <>
      <img className="login-emblem" src="/icons/icon-192.png" alt="" aria-hidden="true" />
      <p className="login-brand">ROMAN'S GAME</p>
    </>
  )

  return (
    <>
      <button
        type="button"
        className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
        onClick={() => {
          setErr('')
          setNote('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'entry')
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
          <div className="start-sheet cloud-sheet" role="dialog" aria-modal="true" aria-label="Log in to Roman's Game">
            <div className="start-sheet-scrim" onClick={() => setSheet(null)} />
            {sheet === 'entry' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const v = idv.trim()
                  if (!v) return setErr('Type your player name or your email.')
                  setErr('')
                  if (v.includes('@')) {
                    if (!/^\S+@\S+\.\S+$/.test(v)) return setErr('Type a full email address.')
                    await sendCode(v)
                  } else {
                    setName(v)
                    setSheet('namepw')
                  }
                }}
              >
                {emblem}
                <h3>Log in or create an account</h3>
                <p className="start-sheet-tip">One account for the game and romansgame.com. Kids: your player name. Grown-ups: your email.</p>
                <input
                  className="name-input"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="Player name or email"
                  aria-label="Player name or email"
                  value={idv}
                  onChange={(e) => setIdv(e.target.value)}
                />
                {note && <p className="cloud-note">{note}</p>}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Continue'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('create') }}>
                  New here? Create an account
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'namepw' && (
              <form
                className="start-sheet-card"
                onSubmit={(e) => {
                  e.preventDefault()
                  /* Name + password sign-in runs on the accounts backend (PR #62).
                     Until it lands this screen is honest instead of fake. */
                  setErr('')
                  setNote('Name + password sign-in switches on with the accounts update. If your account has an email, go back and type it — you\'ll get a code and you\'re in.')
                  setSheet('entry')
                }}
              >
                {emblem}
                <h3>Welcome back</h3>
                <p className="start-sheet-tip">
                  Signing in as <b>{name}</b>
                </p>
                <input className="name-input" type="password" autoComplete="current-password" placeholder="Your password" aria-label="Your password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <label className="cloud-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember this device</span>
                </label>
                <button type="submit" className="btn primary">
                  Log in
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet('entry')}>
                  ← Back
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
                  if (r.ok) {
                    try {
                      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
                    } catch {
                      /* private mode: stays signed in */
                    }
                  } else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                {emblem}
                <h3>Enter your code to log in</h3>
                <p className="start-sheet-tip">
                  We sent it to <b>{email.trim()}</b>. Tap the link in your email, or enter the code from your email.
                </p>
                <input
                  className="name-input cloud-code login-code"
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
                <div className="login-altrow">
                  <button type="button" className="login-linklike" onClick={() => void sendCode(email)} disabled={busy}>
                    Resend code
                  </button>
                  <button type="button" className="login-linklike" onClick={() => setSheet('entry')}>
                    Use a different email
                  </button>
                </div>
                <label className="cloud-check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember this device</span>
                </label>
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || code.length < 6}>
                  {busy ? 'Checking…' : 'Next'}
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
                  setErr('')
                  if (!name.trim() || nameProblem) return setErr(nameProblem || 'Pick a player name.')
                  if (!age13) return setSheet('parent')
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  saveConsent({ age13, optIn })
                  if (email.trim()) {
                    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address, or clear it to use just a name.')
                    await sendCode(email.trim())
                  } else {
                    setNote('Name + password accounts switch on with the accounts update. Add an email above to start today — or keep playing: everything in the game works without an account, scores just stay on this device.')
                    setSheet('entry')
                  }
                }}
              >
                {emblem}
                <h3>Create your account</h3>
                <p className="start-sheet-tip">
                  The questions on this screen are asked <b>once</b> — never when you log in.
                </p>
                <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" placeholder="Player name" aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email (optional for kids, needed for grown-up accounts)" aria-label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                {consentChecks}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Create my account'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet('entry')}>
                  ← Back
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
                  You need to be 13 or older to make an account — or a parent can make their own account and link it to yours, so they can get you back in if you ever lose your password, and send you gifts. You can keep playing everything without an account; your scores just stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Keep playing
                </button>
                {cloud.status === 'signed-in' && (
                  <button type="button" className="btn ghost" onClick={() => void logOut()}>
                    Log out
                  </button>
                )}
              </div>
            )}
            {sheet === 'account' && (
              <div className="start-sheet-card">
                <h3>You're logged in</h3>
                <p className="start-sheet-tip">
                  Signed in as {cloud.email}. Leaderboard name: <b>{cloud.publicName ?? cloud.name}</b>.
                  {cloud.pending ? ` ${cloud.pending} score${cloud.pending === 1 ? '' : 's'} will send when you're back online.` : ' Every game you finish is saved.'}
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Done
                </button>
                <button type="button" className="btn ghost" onClick={() => void switchPlayer()}>
                  Switch player
                </button>
                <button type="button" className="btn ghost" onClick={() => void logOut()}>
                  Log out
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
