import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { setCursorFxPaused } from '../game/cursorFx'
import { isProfane } from './profanity'
import {
  NAME_MAX,
  adoptSiteSession,
  loadConsent,
  onCloud,
  saveConsent,
  savePlayerName,
  sendMagicLink,
  signOut,
  subscribeNews,
  verifyEmailCode,
  type CloudState,
} from './cloud'
import {
  PASSWORD_HINT,
  authUrl,
  guestSaveLabel,
  leaderboardName,
  loadTurnstile,
  signupGuide,
  signInBody,
  signUpBody,
  turnstileSiteKey,
  validEmail,
  visibleEmail,
  postAuth,
  type SignupPath,
} from './siteAuth'

/**
 * Save / sign-in sheet. Same account as romansgame.com: player name and password,
 * with the email-link sheet kept for accounts that already use it.
 * Signed-in scores upload on their own. The victory button is only for guests.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'signin' | 'signup' | 'code' | 'sent' | 'name' | 'account' | 'parent'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
}

function turnstile(): TurnstileApi | null {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile ?? null
}

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [path, setPath] = useState<SignupPath>('me')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [recovery, setRecovery] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stay, setStay] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [terms, setTerms] = useState(false)
  const [needCaptcha, setNeedCaptcha] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)
  const suCaptcha = useRef<HTMLDivElement>(null)
  const siCaptcha = useRef<HTMLDivElement>(null)
  const suWidget = useRef<string | null>(null)
  const siWidget = useRef<string | null>(null)
  const open = sheet !== null
  const shownName = leaderboardName(cloud.name || '', cloud.publicName)
  const recoveryEmail = visibleEmail(cloud.email)

  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    if (!cloud.name) setSheet((s) => (s === 'account' ? s : 'name'))
    else setSheet((s) => (s === 'sent' || s === 'code' ? 'account' : s))
  }, [cloud.status, cloud.name])

  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.classList.add('rg-auth-open')
    setCursorFxPaused(true)
    const y = window.scrollY
    const body = document.body
    const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow }
    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    const vv = window.visualViewport
    const apply = () => {
      const el = sheetRef.current
      if (!el || !vv) return
      el.style.height = `${vv.height}px`
      el.style.top = `${vv.offsetTop}px`
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    const onFocus = (e: FocusEvent) => {
      const t = e.target
      if (!(t instanceof HTMLElement) || !t.closest('.cloud-sheet')) return
      window.setTimeout(() => t.scrollIntoView({ block: 'center', inline: 'nearest' }), 60)
    }
    document.addEventListener('focusin', onFocus)
    return () => {
      root.classList.remove('rg-auth-open')
      setCursorFxPaused(false)
      body.style.position = prev.position
      body.style.top = prev.top
      body.style.width = prev.width
      body.style.overflow = prev.overflow
      window.scrollTo(0, y)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', onFocus)
      const el = sheetRef.current
      if (el) {
        el.style.height = ''
        el.style.top = ''
      }
    }
  }, [open])

  useEffect(() => {
    if (sheet !== 'signup' && sheet !== 'signin') return
    let cancel = false
    void loadTurnstile().then((ok) => {
      if (cancel || !ok) return
      const api = turnstile()
      const mount = (which: 'su' | 'si') => {
        const el = which === 'su' ? suCaptcha.current : siCaptcha.current
        const held = which === 'su' ? suWidget : siWidget
        if (!el || !api || held.current) return
        if (which === 'si' && !needCaptcha) return
        try {
          held.current = api.render(el, {
            sitekey: turnstileSiteKey(),
            callback: (token: string) => setCaptchaToken(token || ''),
            'expired-callback': () => setCaptchaToken(''),
            'error-callback': () => setCaptchaToken(''),
          })
        } catch {
          /* host not allowed yet: the form says so when the token is missing */
        }
      }
      if (sheet === 'signup') mount('su')
      if (sheet === 'signin' && needCaptcha) mount('si')
    })
    return () => {
      cancel = true
    }
  }, [sheet, needCaptcha])

  function resetCaptcha(which: 'su' | 'si') {
    setCaptchaToken('')
    const id = which === 'su' ? suWidget.current : siWidget.current
    if (id) turnstile()?.reset(id)
  }

  const label =
    cloud.status === 'signed-in' && shownName
      ? `Scores saving as ${shownName}`
      : guestSaveLabel(cloud.pending)
  const hideButton = compact && cloud.status === 'signed-in'

  async function switchPlayer() {
    await signOut()
    setIdentifier('')
    setEmail('')
    setPassword('')
    setPassword2('')
    setCode('')
    setName('')
    setAge13(false)
    setOptIn(false)
    setTerms(false)
    saveConsent({ age13: false, optIn: false })
    setErr('')
    setSheet('signin')
  }

  async function finishPassword(playerName: string, access: string, refresh: string) {
    const kept = await adoptSiteSession({ access_token: access, refresh_token: refresh }, playerName)
    if (!kept.ok) {
      setErr(kept.error ?? "The sign-in worked on the server, but this browser couldn't keep it. Try the sign-in code option.")
      return false
    }
    setSheet(null)
    return true
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''
  const newsBox = (
    <label className="cloud-check">
      <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
      <span>Roman's World News. A story every morning. Unsubscribe anytime.</span>
    </label>
  )

  return (
    <>
      {!hideButton && (
      <button
        type="button"
        className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
        data-testid={compact ? 'cloud-save-victory' : 'cloud-save'}
        onClick={() => {
          setErr('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'signin')
        }}
      >
        {label}
      </button>
      )}
      {cloud.status === 'signed-in' && cloud.name && !compact && (
        <button type="button" className="btn ghost cloud-switch" onClick={() => void switchPlayer()}>
          Switch player
        </button>
      )}
      {sheet &&
        createPortal(
          <div
            className="start-sheet cloud-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
            data-testid="auth-sheet"
            ref={sheetRef}
          >
            <div className="start-sheet-scrim" onClick={() => setSheet(null)} />
            {sheet === 'signin' && (
              <form
                className="start-sheet-card"
                data-testid="auth-signin"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const who = identifier.trim()
                  if (!who) return setErr('Type your player name.')
                  if (!password) return setErr('Type your password.')
                  setBusy(true)
                  setErr('')
                  const res = await postAuth('/api/auth/signin', signInBody(who, password, stay, captchaToken))
                  if (captchaToken) resetCaptcha('si')
                  setBusy(false)
                  if (!res.ok) {
                    if (res.status === 403 && res.data?.error === 'turnstile_required') {
                      setNeedCaptcha(true)
                      setErr('One quick check that you are a person: tick the box that appears, then Sign in again.')
                      return
                    }
                    setErr(res.error ?? "Couldn't sign you in just now. Try again in a moment.")
                    return
                  }
                  if (!res.accessToken || !res.refreshToken) {
                    setErr("The sign-in worked on the server, but this browser couldn't keep it. Try the sign-in code option.")
                    return
                  }
                  await finishPassword(res.playerName || who, res.accessToken, res.refreshToken)
                }}
              >
                <h3>Sign in</h3>
                <p className="start-sheet-tip">Play first. Sign in when you want your scores kept. One account works on the site and in the game.</p>
                <label className="cloud-label" htmlFor="rg-si-name">Player name or email</label>
                <input id="rg-si-name" className="name-input" type="text" maxLength={80} autoComplete="username" placeholder="Player name or email" aria-label="Player name or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                <label className="cloud-label" htmlFor="rg-si-pass">Password</label>
                <input id="rg-si-pass" className="name-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <label className="cloud-check">
                  <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                  <span>Show password</span>
                </label>
                <label className="cloud-check">
                  <input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} />
                  <span>Stay signed in on this device</span>
                </label>
                <p className="cloud-fine">On a shared computer, untick it: you are signed out when the browser closes.</p>
                <div ref={siCaptcha} className="cloud-captcha" hidden={!needCaptcha} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Signing you in…' : 'Sign in'}</button>
                <button type="button" className="btn ghost" onClick={() => { setErr(''); setSheet('signup') }}>New here? Create an account</button>
                <button type="button" className="cloud-text-btn" onClick={() => { setErr(''); setSheet('code') }}>Sign in with email link instead</button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>Not now</button>
              </form>
            )}
            {sheet === 'signup' && (
              <form
                className="start-sheet-card"
                data-testid="auth-signup"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const who = name.trim()
                  if (!who) return setErr('Pick a short player name.')
                  if (isProfane(who)) return setErr("Let's pick a different name. Keep it friendly!")
                  if (!password) return setErr('Pick a password.')
                  if (password.length < 10) return setErr(PASSWORD_HINT)
                  if (password !== password2) return setErr('Those passwords do not match — type the same password twice.')
                  if (recovery.trim() && !validEmail(recovery)) return setErr('Check the recovery email, or leave it empty.')
                  if (path === 'me' && !age13) return setErr('Please confirm you are 13 or older.')
                  if (!terms) return setErr('Please accept the Terms and Privacy Policy.')
                  if (!captchaToken) {
                    setErr('One quick check that you are a person: tick the box above, then tap Create my account again.')
                    return
                  }
                  saveConsent({ age13: path === 'me' ? age13 : true, optIn })
                  setBusy(true)
                  setErr('')
                  const res = await postAuth('/api/auth/signup', signUpBody({
                    name: who,
                    password,
                    path,
                    email: recovery,
                    news: optIn,
                    stay,
                    captchaToken,
                  }))
                  resetCaptcha('su')
                  setBusy(false)
                  if (!res.ok) {
                    setErr(res.error ?? "Couldn't make the account just now. Try again in a moment.")
                    return
                  }
                  if (optIn && validEmail(recovery)) void subscribeNews(recovery.trim())
                  if (!res.accessToken || !res.refreshToken) {
                    setIdentifier(who)
                    setSheet('signin')
                    setErr('Account made. Now sign in with your name and password.')
                    return
                  }
                  const kept = await finishPassword(res.playerName || who, res.accessToken, res.refreshToken)
                  if (kept && res.parentEmailPending) setErr('')
                }}
              >
                <h3>Create an account</h3>
                <p className="start-sheet-tip">Made for families to share — stories, adventure and play that bring children and parents together.</p>
                <p className="cloud-label">Who is this account for?</p>
                <div className="cloud-paths" role="radiogroup" aria-label="Who is this account for?">
                  {([
                    ['me', 'For me'],
                    ['child', 'For my child'],
                    ['kid', "I'm a kid — for me"],
                  ] as const).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={`cloud-path${path === id ? ' is-on' : ''}`}
                      role="radio"
                      aria-checked={path === id}
                      onClick={() => setPath(id)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <p className="start-sheet-tip">{signupGuide(path)}</p>
                <label className="cloud-label" htmlFor="rg-su-name">Player name</label>
                <input id="rg-su-name" className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
                <label className="cloud-label" htmlFor="rg-su-pass">Password</label>
                <input id="rg-su-pass" className="name-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <label className="cloud-label" htmlFor="rg-su-pass2">Type your password again</label>
                <input id="rg-su-pass2" className="name-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-label="Type your password again" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                <label className="cloud-check">
                  <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
                  <span>Show password</span>
                </label>
                <label className="cloud-label" htmlFor="rg-su-email">Recovery email (optional)</label>
                <input id="rg-su-email" className="name-input" type="email" inputMode="email" autoComplete="email" aria-label="Recovery email" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
                <p className="cloud-fine">Only used to get this account back if the password is forgotten. You do not need one to play.</p>
                {path === 'me' && (
                  <label className="cloud-check">
                    <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
                    <span>I'm 13 or older.</span>
                  </label>
                )}
                <label className="cloud-check">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    I agree to the{' '}
                    <a href="https://romansgame.com/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Terms</a>
                    {' '}and{' '}
                    <a href="https://romansgame.com/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Privacy</a>.
                  </span>
                </label>
                {newsBox}
                <div ref={suCaptcha} className="cloud-captcha" />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Making your account…' : 'Create my account'}</button>
                <p className="cloud-fine">One account works on the site and in the game.</p>
                <button type="button" className="cloud-text-btn" onClick={() => { setErr(''); setSheet('signin') }}>Already have an account? Sign in</button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>Not now</button>
              </form>
            )}
            {sheet === 'code' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!age13) return setSheet('parent')
                  if (!terms) return setErr('Please agree to the Terms and Privacy.')
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  saveConsent({ age13, optIn })
                  setBusy(true)
                  const r = await sendMagicLink(email)
                  setBusy(false)
                  if (r.ok) setSheet('sent')
                  else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Sign in with email link</h3>
                <p className="start-sheet-tip">For an account that already uses an email link. We'll email a link and a code to that address.</p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                <label className="cloud-check">
                  <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
                  <span>I'm 13 or older</span>
                </label>
                <label className="cloud-check">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>
                    I agree to the{' '}
                    <a href="https://romansgame.com/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Terms</a>
                    {' '}and{' '}
                    <a href="https://romansgame.com/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Privacy</a>
                  </span>
                </label>
                {newsBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
                <button type="button" className="cloud-text-btn" onClick={() => { setErr(''); setSheet('signin') }}>Back to player name and password</button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>Not now</button>
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
                <button type="submit" className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in with code'}</button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>Not now</button>
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
                  if (r.ok) setSheet(null)
                  else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Your player name</h3>
                <p className="start-sheet-tip">
                  This is the name on your account and on the leaderboard. You only do this once.
                </p>
                <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" placeholder="Player name" aria-label="Player name" value={name} onChange={(e) => setName(e.target.value)} />
                {!loadConsent()?.age13 && (
                  <>
                    <label className="cloud-check">
                      <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
                      <span>I'm 13 or older</span>
                    </label>
                    <label className="cloud-check">
                      <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                      <span>
                        I agree to the{' '}
                        <a href="https://romansgame.com/terms" target="_blank" rel="noopener noreferrer">Terms</a>
                        {' '}and{' '}
                        <a href="https://romansgame.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
                      </span>
                    </label>
                    {newsBox}
                  </>
                )}
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>{busy ? 'Saving…' : 'Save name'}</button>
              </form>
            )}
            {sheet === 'parent' && (
              <div className="start-sheet-card">
                <h3>Ask a parent to sign up for you</h3>
                <p className="start-sheet-tip">
                  A "For me" account is for someone 13 or older. A parent can choose "For my child", or you can choose "I'm a kid — for me". You can keep playing without an account. Scores then stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={() => { setErr(''); setSheet('signup'); setPath('kid') }}>I'm a kid — for me</button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>Keep playing</button>
              </div>
            )}
            {sheet === 'account' && (
              <div className="start-sheet-card">
                <h3>Scores are saving</h3>
                <p className="start-sheet-tip">
                  Player name: <b>{shownName || 'your account'}</b>.
                  {recoveryEmail ? ` Recovery email: ${recoveryEmail}.` : ''}
                  {cloud.pending ? ` ${cloud.pending} score${cloud.pending === 1 ? '' : 's'} will send when you're back online.` : ' Every game you finish is saved on this account.'}
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>Done</button>
                <button type="button" className="btn ghost" onClick={() => void switchPlayer()}>Switch player</button>
                <button type="button" className="btn ghost" onClick={() => { void signOut(); setSheet(null) }}>Sign out</button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

/** Used by tests to confirm the popup talks to the website, not a copied game backend. */
export const AUTH_SIGNIN_URL = authUrl('/api/auth/signin')
