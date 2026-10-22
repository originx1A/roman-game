import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, lookupAccount, onCloud, savePlayerName, sendRecoveryCode, signInWithName, signOut, signUpWithName, verifyEmailCode, type CloudState } from './cloud'
import { useTurnstile } from './useTurnstile'

/**
 * "Save my scores" button + sheets.
 * The first sign-in screen is one box: player name or email. One question per screen.
 * An existing name goes to the password. A new name answers 13+, Terms, and news, then a password.
 * Email is recovery only, behind "Can't get in?". The same sentence is used either way.
 * Saving with no email, and linking a parent, stay as they are. These sheets do not ask for money.
 */

/** Phone asks with the save card. Desktop opens the name-or-email box. */
function phoneSaveCard(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.device === 'phone'
}

const PICTURES = [
  { id: 'lion', label: 'Lion', glyph: '🦁' },
  { id: 'owl', label: 'Owl', glyph: '🦉' },
  { id: 'star', label: 'Star', glyph: '⭐' },
  { id: 'fox', label: 'Fox', glyph: '🦊' },
  { id: 'boat', label: 'Boat', glyph: '⛵' },
  { id: 'crown', label: 'Crown', glyph: '👑' },
]

export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'offer' | 'who' | 'recover' | 'sent' | 'password' | 'picture' | 'age' | 'terms' | 'news' | 'secret' | 'name' | 'account' | 'parent' | 'noemail' | 'parentlink'

export function CloudScoresButton({ suggestedName, compact, short, onInfo, cta, forceOffer, forceSignIn, note, hidden, onClose }: { suggestedName?: string; compact?: boolean; short?: boolean; onInfo?: () => void; cta?: string; forceOffer?: boolean; forceSignIn?: boolean; note?: string; hidden?: boolean; onClose?: () => void }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(forceOffer ? 'offer' : forceSignIn ? (phoneSaveCard() ? 'offer' : 'who') : null)
  const [who, setWho] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [passwordName, setPasswordName] = useState('')
  const [password, setPassword] = useState('')
  const [picks, setPicks] = useState<string[]>([])
  const [purpose, setPurpose] = useState<'in' | 'up'>('in')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(false)
  const [optIn, setOptIn] = useState(false)
  const [terms, setTerms] = useState(false)
  const captchaOn = sheet === 'recover' || sheet === 'sent' || sheet === 'password' || sheet === 'picture' || sheet === 'secret'
  const captcha = useTurnstile(captchaOn)

  // A code, password, or new account just signed in. Ask for a leaderboard name only when this account has none.
  // A reload starts with no sheet, so a saved session does not open one.
  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    setSheet((s) => {
      if (s !== 'sent' && s !== 'password' && s !== 'picture' && s !== 'secret' && s !== 'name') return s
      if (cloud.name == null) return 'name'
      return 'account'
    })
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
    setWho('')
    setEmail('')
    setCode('')
    setPassword('')
    setPicks([])
    setName('')
    setAge13(false)
    setOptIn(false)
    setTerms(false)
    setErr('')
    setSheet(phoneSaveCard() ? 'offer' : 'who')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''

  async function takeCaptcha(): Promise<string | null> {
    const token = await captcha.takeToken()
    if (token) return token
    setErr(captcha.reason() || "This page couldn't complete the check. Try again.")
    captcha.reset()
    setBusy(false)
    return null
  }

  return (
    <>
      {!hidden && (
      <button
        type="button"
        data-testid={cta ? 'board-signin' : 'save-scores'}
        className={cta ? 'btn primary board-cta' : `btn ghost cloud-btn${compact ? ' is-compact' : ''}${short ? ' is-short' : ''}`}
        onClick={() => {
          setErr('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : phoneSaveCard() ? 'offer' : 'who')
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
                {note ? <p className="start-sheet-tip" data-testid="signin-note">{note}</p> : null}
                <div className="cloud-turnstile" ref={captcha.box} />
                {sheet === 'recover' && (
              <form
                className="cloud-auth-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  setBusy(true)
                  setErr('')
                  const token = await takeCaptcha()
                  if (!token) return
                  const r = await sendRecoveryCode(email, token)
                  captcha.reset()
                  setBusy(false)
                  if (r.ok) setSheet('sent')
                  else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Can't get in?</h3>
                <p className="start-sheet-tip">Enter your email. We'll send a 6-digit code.</p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a code'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('who') }}>
                  Back
                </button>
              </form>
                )}
                {sheet === 'sent' && (
              <form
                className="cloud-auth-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!/^\d{6,8}$/.test(code)) return setErr('Enter the 6-digit code from your email.')
                  setBusy(true)
                  setErr('')
                  const token = await takeCaptcha()
                  if (!token) return
                  const r = await verifyEmailCode(email, code, token)
                  captcha.reset()
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Enter your code</h3>
                <p className="start-sheet-tip">
                  If we can use that email, we sent a 6-digit code. Enter it here. You can also tap the link in that email.
                </p>
                <input
                  className="name-input cloud-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="6-digit code"
                  aria-label="6-digit code"
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
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </form>
                )}
                {sheet === 'password' && (
              <form
                className="cloud-auth-form"
                data-testid="signin-password"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setErr('')
                  const token = await takeCaptcha()
                  if (!token) return
                  const r = await signInWithName(passwordName, password, token)
                  captcha.reset()
                  setPassword('')
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Sign in</h3>
                <p className="start-sheet-tip">Enter the password for <b>{passwordName}</b>.</p>
                <input className="name-input" type="password" autoComplete="current-password" aria-label="Password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !password}>
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setPicks([]); setSheet('picture') }}>
                  Use a picture password
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('recover') }}>
                  Can't get in?
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </form>
                )}
                {sheet === 'picture' && (
              <form
                className="cloud-auth-form"
                data-testid="signin-picture"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (picks.length < 3) return setErr('Pick 3 pictures.')
                  const secret = picks.join('+')
                  setBusy(true)
                  setErr('')
                  const token = await takeCaptcha()
                  if (!token) return
                  const r = purpose === 'up'
                    ? await signUpWithName(passwordName, secret, token, optIn)
                    : await signInWithName(passwordName, secret, token)
                  captcha.reset()
                  setPicks([])
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Picture password</h3>
                <p className="start-sheet-tip">Pick 3 pictures.</p>
                <div className="picture-password">
                  {PICTURES.map((pic) => (
                    <button key={pic.id} type="button" aria-label={pic.label} className={picks.includes(pic.id) ? 'is-picked' : undefined} onClick={() => { setPicks((prev) => (prev.length >= 3 ? prev : [...prev, pic.id])); setErr('') }}>
                      {pic.glyph}
                    </button>
                  ))}
                </div>
                <p className="start-sheet-tip">Picked {picks.length} of 3.</p>
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || picks.length < 3}>
                  {busy ? 'Checking…' : purpose === 'up' ? 'Create account' : 'Sign in'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setPicks([]); setSheet(purpose === 'up' ? 'secret' : 'password') }}>
                  Use a typed password
                </button>
              </form>
                )}
                {sheet === 'secret' && (
              <form
                className="cloud-auth-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!age13) return setSheet('parent')
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  setBusy(true)
                  setErr('')
                  const token = await takeCaptcha()
                  if (!token) return
                  const r = await signUpWithName(passwordName, password, token, optIn)
                  captcha.reset()
                  setPassword('')
                  setBusy(false)
                  if (!r.ok) setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Choose a password</h3>
                <p className="start-sheet-tip">This password is for {passwordName}.</p>
                <input className="name-input" type="password" autoComplete="new-password" aria-label="New password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !password}>
                  {busy ? 'Saving…' : 'Create account'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setPicks([]); setSheet('picture') }}>
                  Use a picture password
                </button>
              </form>
                )}
                {captcha.note && !err && <p className="cloud-err" role="alert">{captcha.note}</p>}
              </div>
            )}
            {sheet === 'who' && (
              <form
                className="start-sheet-card cloud-auth-form"
                data-testid="signin-who"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const typed = who.trim().replace(/\s+/g, ' ')
                  setErr('')
                  if (typed.includes('@')) {
                    if (!/^\S+@\S+\.\S+$/.test(typed)) return setErr('Type a full email address.')
                    setEmail(typed)
                    setSheet('recover')
                    return
                  }
                  if (typed.length < 3) return setErr('Type your player name.')
                  if (isProfane(typed)) return setErr("Let's pick a different name. Keep it friendly!")
                  setBusy(true)
                  const found = await lookupAccount(typed)
                  setBusy(false)
                  if (found === 'wait') return setErr('Try again in a little while.')
                  if (found === 'no') return setErr("Let's pick a different name. Keep it friendly!")
                  setPasswordName(typed)
                  setPassword('')
                  setPicks([])
                  if (found === 'existing') {
                    setPurpose('in')
                    setSheet('password')
                    return
                  }
                  if (found === 'new') {
                    setPurpose('up')
                    setAge13(false)
                    setTerms(false)
                    setOptIn(false)
                    setSheet('age')
                  }
                }}
              >
                <h3>Sign in</h3>
                <p className="start-sheet-tip">Type your player name.</p>
                <input className="name-input" type="text" autoComplete="username" placeholder="Player name or email" aria-label="Player name or email" value={who} onChange={(e) => setWho(e.target.value)} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !who.trim()}>
                  {busy ? 'Checking…' : 'Continue'}
                </button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('recover') }}>
                  Can't get in?
                </button>
                <button type="button" className="btn ghost" onClick={closeSheet}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'age' && (
              <div className="start-sheet-card" data-testid="signup-age">
                <h3>I'm 13 or older</h3>
                <p className="start-sheet-tip">This is asked once, when the account is created.</p>
                <button type="button" className="btn primary" data-testid="age-13" onClick={() => { setAge13(true); setErr(''); setSheet('terms') }}>
                  Yes
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setAge13(false)
                    setSheet('parent')
                  }}
                >
                  No
                </button>
              </div>
            )}
            {sheet === 'terms' && (
              <form
                className="start-sheet-card"
                data-testid="signup-terms"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  setErr('')
                  setSheet('news')
                }}
              >
                <h3>Terms and Privacy</h3>
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
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary">
                  Continue
                </button>
              </form>
            )}
            {sheet === 'news' && (
              <form
                className="start-sheet-card"
                data-testid="signup-news"
                onSubmit={(e) => {
                  e.preventDefault()
                  setErr('')
                  setPassword('')
                  setPicks([])
                  setSheet('secret')
                }}
              >
                <h3>Roman's World News</h3>
                <label className="cloud-check">
                  <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
                  <span>Get Roman's World News: the story behind this game. Unsubscribe anytime.</span>
                </label>
                <button type="submit" className="btn primary">
                  Continue
                </button>
              </form>
            )}
            {sheet === 'name' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!name.trim() || nameProblem) return
                  setBusy(true)
                  const r = await savePlayerName(name, { age13: true, optIn: false })
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
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
                  {busy ? 'Saving…' : 'Save name'}
                </button>
              </form>
            )}
            {sheet === 'offer' && (
              <div className="start-sheet-card cloud-offer" data-testid="save-offer">
                {note ? <p className="start-sheet-tip" data-testid="signin-note">{note}</p> : null}
                <h3>Save your scores?</h3>
                <button type="button" className="btn primary" onClick={() => { setErr(''); setSheet('who') }}>
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
                    Log out
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
                <button type="button" className="btn ghost log-out" onClick={() => { void signOut(); closeSheet() }}>
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

/** Cloud session logout. Hidden until this device is signed in. */
export function LogOutButton({ onDone }: { onDone?: () => void }) {
  const cloud = useCloud()
  if (cloud.status !== 'signed-in') return null
  return (
    <button
      type="button"
      className="btn ghost log-out"
      data-testid="log-out"
      onClick={() => {
        void signOut()
        onDone?.()
      }}
    >
      Log out
    </button>
  )
}
