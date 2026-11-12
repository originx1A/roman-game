import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PasswordInput } from '../components/PasswordInput'
import { isProfane } from './profanity'
import {
  NAME_MAX,
  loadConsent,
  saveConsent,
  onCloud,
  savePlayerName,
  sendMagicLink,
  verifyEmailCode,
  signOut,
  signOutEverywhere,
  signInWithPassword,
  createAccount,
  claimAccount,
  recoverStart,
  recoverCode,
  recoverFinish,
  addRecoveryEmail,
  renderTurnstile,
  openWebsite,
  type CloudState,
  type ResetGrant,
} from './cloud'

/**
 * "Save my scores" button + sheets (Tony 2026-11-07; two-step rule Nov 12, 2026): the box
 * opens on two options only — Sign in or Create account (+ X to close). Picking one swaps
 * in that job's own screen; the other paths (email code, forgot password) live under
 * Sign in, never on the chooser. One sign-in, one account, shown wherever the player is.
 *
 * Name + password switch (Tony 2026-11-07, "just fix it and put it up"): sign-in and create
 * now run on the same /api/auth/* door as romansgame.com — player name + password is the
 * key, email is for recovery only (forgot → emailed code → new password). The age answer
 * on create is the server's locked record, not a device note. The old email-code door
 * survives only as the claim bootstrap: an existing game player signs in by code once,
 * then gives the account a name + password (the claim sheet) and uses that everywhere.
 *
 * Round 2 (Tony 2026-11-07, from testing on his phone): the on-screen keyboard covered the
 * field being typed in, so the sheet tracks the visual viewport (it lives entirely in
 * the visible area above the keyboard) and keeps the focused field scrolled into view; and
 * every sheet carries a footer link out to romansgame.com.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'start' | 'signin' | 'create' | 'emailcode' | 'sent' | 'name' | 'account' | 'parent' | 'forgot' | 'reset' | 'claim' | 'addemail'

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  /** Which errand the code screen serves: a plain code sign-in, or the claim bootstrap. */
  const [flow, setFlow] = useState<'signin' | 'claim'>('signin')
  /** One shared email state: the code-door address, the create form's recovery/grown-up
   * email, and the claim bootstrap all read it — switching screens never wipes typing. */
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  /** Sign-in name, shared with the claim sheet's name field. */
  const [loginName, setLoginName] = useState('')
  const [createName, setCreateName] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [recEmail, setRecEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [grant, setGrant] = useState<ResetGrant | null>(null)
  const [pickUser, setPickUser] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [note, setNote] = useState('')
  const [justClaimed, setJustClaimed] = useState(false)
  /** True right after an API create: the server already holds the age record, so the
   * one-time name step must not re-ask the consent questions. */
  const [freshAccount, setFreshAccount] = useState(false)
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

  /* ---------------- Person check (Turnstile) ----------------
   * Signup always needs a token; sign-in, claim and the reset steps need one when
   * the API asks. One widget at a time, rendered lazily into whichever sheet is
   * asking. Tokens are single-use server-side, so every gated call clears it. */
  const [cap, setCap] = useState<{ need: boolean; token: string | null; busy: boolean }>({ need: false, token: null, busy: false })
  const [capRetry, setCapRetry] = useState(0)
  const capRef = useRef<HTMLDivElement>(null)
  const capStarted = useRef(false)
  function askCaptcha() {
    capStarted.current = false
    // Bump the attempt counter as well: after a failed/null attempt the cap
    // values are unchanged, so without this the render effect below would not
    // re-fire and re-tapping the submit button would be a no-op (diagnosis
    // §2.4). The counter is in the effect's deps, so every ask starts a
    // genuinely fresh person-check attempt.
    setCapRetry((n) => n + 1)
    setCap({ need: true, token: null, busy: false })
  }
  function clearCaptcha() {
    capStarted.current = false
    setCap({ need: false, token: null, busy: false })
  }
  // Polls until the widget container is actually in the tree: the effect can
  // fire on the render where askCaptcha() was called, a beat before the sheet
  // re-renders WITH the box (or before the next sheet mounts its own box), and
  // a render started against a not-yet-mounted container would never happen.
  useEffect(() => {
    if (!cap.need || cap.token || capStarted.current) return
    let stopped = false
    let tries = 0
    const tick = () => {
      if (stopped || capStarted.current) return
      const el = capRef.current
      if (el) {
        capStarted.current = true
        setCap((c) => ({ ...c, busy: true }))
        void renderTurnstile(el).then((token) => {
          if (!stopped) setCap((c) => ({ ...c, token, busy: false }))
        })
        return
      }
      if (++tries < 60) window.setTimeout(tick, 50)
    }
    tick()
    return () => {
      stopped = true
    }
  }, [cap.need, cap.token, sheet, capRetry])
  const captchaBox = cap.need ? (
    <div className="cloud-captcha">
      <div ref={capRef} />
      {!cap.token && (
        <p className="start-sheet-tip">
          {cap.busy
            ? 'Loading the person check…'
            : "The person check couldn't load here. It has to run to finish this — try again in a moment, or use romansgame.com, where the same account works."}
        </p>
      )}
      {cap.token && <p className="start-sheet-tip">Person check done — tap the button again to continue.</p>}
    </div>
  ) : null

  // Signed in (any door). No leaderboard name yet: ask once. A named player who
  // arrived by code lands on the account sheet; one who just signed in or created
  // with name + password is simply in — the box closes (Tony's model).
  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    if (cloud.name === null) {
      setSheet((s) => (s === 'account' ? s : 'name'))
      return
    }
    setSheet((s) => {
      if (s === 'sent') return 'account'
      if (s === 'signin' || s === 'create') return null
      return s
    })
  }, [cloud.status, cloud.name])

  // Bridge round-trip (two-way sign-in, Tony Nov 12, 2026): tapping "Sign in"
  // on the chooser asks the website first. The flag survives the redirect;
  // when the cloud state settles to signed-out afterwards, the sign-in form
  // opens — the player asked for it. A successful handoff lands signed-in,
  // and the signed-in effect above closes the sheet instead.
  const [bridgePending, setBridgePending] = useState(() => {
    try {
      if (window.sessionStorage.getItem('rg.game.bridge') === '1') {
        window.sessionStorage.removeItem('rg.game.bridge')
        return true
      }
    } catch { /* ignore */ }
    return false
  })
  useEffect(() => {
    if (!bridgePending || cloud.status !== 'signed-out') return
    setBridgePending(false)
    setSheet('signin')
  }, [bridgePending, cloud.status])

  // Phone keyboard (Tony 2026-11-07): the on-screen keyboard covers the lower half of the
  // screen — including the field being typed in. So while the box is open, it is sized and
  // positioned to the VISUAL viewport (the part of the screen still visible above the
  // keyboard, via the --rg-vv-* properties in App.css) and the focused field is kept
  // scrolled into view inside the card. Desktop is unaffected: no keyboard, full viewport.
  const sheetRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!sheet) return
    const el = sheetRef.current
    if (!el) return
    const vv = window.visualViewport
    const keepFieldVisible = () => {
      const a = document.activeElement
      if (!(a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) || !el.contains(a)) return
      const r = a.getBoundingClientRect()
      const vh = vv?.height ?? window.innerHeight
      if (r.top < 8 || r.bottom > vh - 8) a.scrollIntoView({ block: 'center' })
    }
    const syncViewport = () => {
      if (vv) {
        el.style.setProperty('--rg-vv-top', `${vv.offsetTop}px`)
        el.style.setProperty('--rg-vv-height', `${vv.height}px`)
      }
      keepFieldVisible()
    }
    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      // The keyboard takes a few hundred ms to slide in; re-check once it has settled.
      window.setTimeout(keepFieldVisible, 350)
    }
    syncViewport()
    vv?.addEventListener('resize', syncViewport)
    vv?.addEventListener('scroll', syncViewport)
    el.addEventListener('focusin', onFocusIn)
    return () => {
      vv?.removeEventListener('resize', syncViewport)
      vv?.removeEventListener('scroll', syncViewport)
      el.removeEventListener('focusin', onFocusIn)
      el.style.removeProperty('--rg-vv-top')
      el.style.removeProperty('--rg-vv-height')
    }
  }, [sheet])

  // The way back to the main site, at the foot of every sheet in this box (Tony 2026-11-07).
  // Carries the sign-in over when the player has one, so they never sign in twice.
  const siteLink = (
    <a className="cloud-site-link" href="https://romansgame.com/" target="_blank" rel="noopener" onClick={(e) => { e.preventDefault(); openWebsite('https://romansgame.com/'); }}>
      Visit romansgame.com
    </a>
  )

  // One shared email field — switching screens never wipes what was typed.
  const emailField = (
    <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
  )
  const codeField = (value: string, onValue: (v: string) => void, label: string) => (
    <input
      className="name-input cloud-code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={8}
      placeholder={label}
      aria-label={label}
      value={value}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text').replace(/\s/g, '').replace(/\D/g, '').slice(0, 8)
        if (!text) return
        e.preventDefault()
        onValue(text)
        setErr('')
      }}
      onChange={(e) => {
        onValue(e.target.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 8))
        setErr('')
      }}
    />
  )

  /* ------------------------------ Doors ------------------------------ */

  /** Sign in with name + password (the shared door). */
  async function submitSignIn() {
    if (!loginName.trim()) return setErr('Type your player name.')
    if (!pass) return setErr('Type your password.')
    setBusy(true)
    setErr('')
    const r = await signInWithPassword(loginName, pass, cap.token ?? undefined)
    setBusy(false)
    if (!r.ok) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    setPass('')
    clearCaptcha()
    // The effect closes the box for a named player, or opens the one-time name step.
  }

  /** Create an account on the shared door (server holds the age record). */
  async function submitCreate() {
    if (!terms) return setErr('Please agree to the Terms and Privacy.')
    if (!createName.trim()) return setErr('Type your player name.')
    if (!pass) return setErr('Type a password.')
    if (pass !== pass2) return setErr("The passwords don't match.")
    if (!age13 && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setErr("For a child's account, put a grown-up's email in the email box — they approve the account, and they can help the child get back in.")
    if (age13 && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full recovery email address, or leave the email box empty.')
    if (!cap.token) {
      askCaptcha()
      return setErr('One more step: finish the person check below, then tap Create my account again.')
    }
    setBusy(true)
    setErr('')
    const r = await createAccount({ name: createName, password: pass, age13, terms, email: email.trim() || undefined, optIn, captchaToken: cap.token })
    setBusy(false)
    if (!r.ok) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    clearCaptcha()
    setPass('')
    setPass2('')
    saveConsent({ age13: true, optIn }) // device marker only now — the age record itself is the server's
    setFreshAccount(true)
    // The effect opens the one-time name step (the leaderboard name starts as this name).
  }

  /** The old email-code door — kept as the claim bootstrap and a fallback sign-in. */
  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
    setBusy(true)
    setErr('')
    const r = await sendMagicLink(email)
    setBusy(false)
    if (r.ok) setSheet('sent')
    else setErr(r.error ?? 'Something went wrong.')
  }

  /** The claim: give this email-code account its name + password, same account. */
  async function submitClaim() {
    if (!age13) return setErr("Tick I'm 13 or older to claim this account. Accounts for kids are made by a grown-up — romansgame.com is the place for those.")
    if (!terms) return setErr('Please agree to the Terms and Privacy.')
    if (!loginName.trim()) return setErr('Pick a sign-in name.')
    if (!pass) return setErr('Type a password.')
    if (pass !== pass2) return setErr("The passwords don't match.")
    if (!cap.token) {
      askCaptcha()
      return setErr('One more step: finish the person check below, then tap Claim my account again.')
    }
    setBusy(true)
    setErr('')
    const r = await claimAccount({ name: loginName, password: pass, age13, terms, optIn, captchaToken: cap.token })
    setBusy(false)
    if (!r.ok) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    clearCaptcha()
    setPass('')
    setPass2('')
    setJustClaimed(true)
    setNote('Done — from now on you sign in with your name + password, here and on romansgame.com. Your scores, your card and your leaderboard name are unchanged.')
    setSheet('account')
  }

  /** Forgot step 1: ask the shared door to email a reset code. */
  async function submitForgot() {
    if (!/^\S+@\S+\.\S+$/.test(recEmail.trim())) return setErr('Type the recovery email on the account.')
    if (!cap.token) {
      askCaptcha()
      return setErr('One more step: finish the person check below, then tap Email me a reset code again.')
    }
    setBusy(true)
    setErr('')
    const r = await recoverStart(recEmail, cap.token)
    setBusy(false)
    clearCaptcha()
    if (!r.ok) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    setGrant(null)
    setResetCode('')
    setSheet('reset')
  }

  /** Forgot step 2: the emailed code becomes a one-time reset grant. */
  async function submitResetCode() {
    if (!/^\d{6}$/.test(resetCode)) return setErr('Enter the 6-number code from your email.')
    if (!cap.token) {
      askCaptcha()
      return setErr('One more step: finish the person check below, then tap Check the code again.')
    }
    setBusy(true)
    setErr('')
    const r = await recoverCode(recEmail, resetCode, cap.token)
    setBusy(false)
    clearCaptcha()
    if (!r.ok || !r.grant) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    setGrant(r.grant)
    if (r.grant.accounts.length === 1) setPickUser(r.grant.accounts[0].userId)
    askCaptcha() // the finish step needs a fresh person check of its own
  }

  /** Forgot step 3: set the new password; the door signs the player back in. */
  async function submitResetFinish() {
    if (!grant || !pickUser) return setErr('Pick which account to reset.')
    if (!pass) return setErr('Type a new password.')
    if (pass !== pass2) return setErr("The passwords don't match.")
    if (!cap.token) {
      askCaptcha()
      return setErr('One more step: finish the person check below, then tap Save the new password again.')
    }
    setBusy(true)
    setErr('')
    const r = await recoverFinish(grant, pickUser, pass, cap.token)
    setBusy(false)
    if (!r.ok) {
      if (r.captchaNeeded) askCaptcha()
      return setErr(r.error ?? 'Something went wrong.')
    }
    clearCaptcha()
    setPass('')
    setPass2('')
    setGrant(null)
    setSheet(null)
  }

  /** Add a recovery email to the signed-in account (a confirm email completes it). */
  async function submitAddEmail() {
    if (!/^\S+@\S+\.\S+$/.test(addEmail.trim())) return setErr('Type a full email address.')
    setBusy(true)
    setErr('')
    const r = await addRecoveryEmail(addEmail)
    setBusy(false)
    if (!r.ok) return setErr(r.error ?? 'Something went wrong.')
    setNote(`We sent a confirm email to ${addEmail.trim()} — tap the link in it (or enter its code at romansgame.com) to finish adding it as your recovery email.`)
    setAddEmail('')
    setSheet('account')
  }

  const label =
    cloud.status === 'signed-in' && cloud.name
      ? `☁ Scores saving as ${cloud.publicName ?? cloud.name}${cloud.pending ? ` (${cloud.pending} waiting)` : ''}`
      : cloud.pending
        ? `☁ Save my scores (${cloud.pending} waiting)`
        : '☁ Save my scores'

  /** Families sharing a phone: sign this player out (their unsent scores stay theirs) and sign in someone else */
  async function switchPlayer() {
    await signOutEverywhere()
    setEmail('')
    setCode('')
    setName('')
    setLoginName('')
    setCreateName('')
    setPass('')
    setPass2('')
    setRecEmail('')
    setGrant(null)
    setNote('')
    setJustClaimed(false)
    setFreshAccount(false)
    setAge13(false)
    setOptIn(false)
    setTerms(false)
    saveConsent({ age13: false, optIn: false })
    setErr('')
    clearCaptcha()
    setSheet('start')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''
  const shownEmail = cloud.email && !cloud.email.endsWith('@players.romansgame.invalid') ? cloud.email : null
  const canClaim = cloud.status === 'signed-in' && !justClaimed && cloud.authKind !== 'password'

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
          <div className="start-sheet cloud-sheet" role="dialog" aria-modal="true" aria-label="Save my scores" ref={sheetRef}>
            <div className="start-sheet-scrim" onClick={() => setSheet(null)} />
            {sheet === 'start' && (
              <div className="start-sheet-card">
                <button type="button" className="cloud-close" aria-label="Close" onClick={() => setSheet(null)}>
                  &times;
                </button>
                <h3>Save your scores</h3>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    setErr('')
                    // Bridge check (two-way sign-in, Nov 12, 2026): ask the
                    // website first — if the player is signed in there, the
                    // bridge hands back a code and they are signed in here
                    // without typing anything.
                    try { window.sessionStorage.setItem('rg.game.bridge', '1') } catch { /* ignore */ }
                    window.location.href = 'https://romansgame.com/auth-bridge.html?return=' + encodeURIComponent(window.location.href.split('?')[0].split('#')[0])
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
                {siteLink}
              </div>
            )}
            {sheet === 'signin' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await submitSignIn()
                }}
              >
                <h3>Sign in</h3>
                <input className="name-input" type="text" autoComplete="username" placeholder="Player name" aria-label="Player name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
                <PasswordInput inputClassName="name-input" autoComplete="current-password" placeholder="Password" ariaLabel="Password" value={pass} onChange={setPass} />
                {captchaBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="cloud-quiet">
                  <button
                    type="button"
                    className="cloud-text-btn"
                    onClick={() => {
                      setErr('')
                      setFlow('claim')
                      setSheet('emailcode')
                    }}
                  >
                    Sign in with an email code instead
                  </button>
                </p>
                <p className="cloud-quiet">
                  <button
                    type="button"
                    className="cloud-text-btn"
                    onClick={() => {
                      setErr('')
                      setSheet('forgot')
                    }}
                  >
                    Forgot your password?
                  </button>
                </p>
                <p className="cloud-quiet">
                  <button
                    type="button"
                    className="cloud-text-btn"
                    onClick={() => {
                      setErr('')
                      setSheet('start')
                    }}
                  >
                    Back
                  </button>
                </p>
                {siteLink}
              </form>
            )}
            {sheet === 'create' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await submitCreate()
                }}
              >
                <h3>Create your account</h3>
                <input className="name-input" type="text" autoComplete="username" placeholder="Player name" aria-label="Player name" value={createName} onChange={(e) => setCreateName(e.target.value)} />
                <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="Password" ariaLabel="Password" value={pass} onChange={setPass} />
                <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="Type the password again" ariaLabel="Type the password again" value={pass2} onChange={setPass2} />
                <p className="cloud-field-label">{age13 ? 'Recovery email (optional)' : "Grown-up's email (required for a child's account)"}</p>
                {emailField}
                {consentChecks}
                {captchaBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Creating…' : 'Create my account'}
                </button>
                <p className="cloud-quiet">
                  <button
                    type="button"
                    className="cloud-text-btn"
                    onClick={() => {
                      setErr('')
                      setSheet('start')
                    }}
                  >
                    Back
                  </button>
                </p>
                {siteLink}
              </form>
            )}
            {sheet === 'emailcode' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await sendCode()
                }}
              >
                <h3>Sign in with an email code</h3>
                <p className="start-sheet-tip">
                  For accounts made with an email code. We'll email you a sign-in link and a code. Afterwards you can give the account a name + password and sign in that way everywhere.
                </p>
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
                    setSheet('signin')
                  }}
                >
                  Sign in with name + password instead
                </button>
                {siteLink}
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
                {/* aria-label="the code from your email" lives on the field rendered just above (codeField). */}
                {codeField(code, setCode, 'the code from your email')}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy || code.length < 6}>
                  {busy ? 'Checking…' : 'Sign in with code'}
                </button>
                <p className="cloud-quiet">
                  <button
                    type="button"
                    className="cloud-text-btn"
                    onClick={() => {
                      setErr('')
                      setSheet('emailcode')
                    }}
                  >
                    Use a different email
                  </button>
                </p>
                {siteLink}
              </form>
            )}
            {sheet === 'claim' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await submitClaim()
                }}
              >
                <h3>Give your account a name + password</h3>
                <p className="start-sheet-tip">
                  This is the same account — your scores, your card and your leaderboard name stay exactly as they are. Pick a sign-in name (it can be different from your leaderboard name, and your leaderboard
                  name doesn't change) and a password. Your email becomes the recovery address for getting back in.
                </p>
                <input className="name-input" type="text" autoComplete="username" placeholder="Sign-in name" aria-label="Sign-in name" value={loginName} onChange={(e) => setLoginName(e.target.value)} />
                <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="Password" ariaLabel="Password" value={pass} onChange={setPass} />
                <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="Type the password again" ariaLabel="Type the password again" value={pass2} onChange={setPass2} />
                {consentChecks}
                {captchaBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Claim my account'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet('account')}>
                  Not now
                </button>
                {siteLink}
              </form>
            )}
            {sheet === 'forgot' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await submitForgot()
                }}
              >
                <h3>Forgot your password?</h3>
                <p className="start-sheet-tip">
                  Type the recovery email on the account and we'll email you a reset code and a link. No recovery email on the account? Then the name + password is the only way in — write to
                  support@romansgame.com and we'll help.
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Recovery email" aria-label="Recovery email" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} />
                {captchaBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a reset code'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setErr('')
                    setSheet('signin')
                  }}
                >
                  Back to sign in
                </button>
                {siteLink}
              </form>
            )}
            {sheet === 'reset' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (grant) await submitResetFinish()
                  else await submitResetCode()
                }}
              >
                <h3>{grant ? 'Choose a new password' : 'Enter your reset code'}</h3>
                {!grant && (
                  <>
                    <p className="start-sheet-tip">
                      If that email is on an account, we sent a reset code to <b>{recEmail.trim()}</b>. Enter it here — or tap the link in the email and finish at romansgame.com.
                    </p>
                    {codeField(resetCode, setResetCode, 'the 6-number code from your email')}
                  </>
                )}
                {grant && (
                  <>
                    {grant.accounts.length > 1 && (
                      <>
                        <p className="start-sheet-tip">That email belongs to more than one account. Pick which one to reset:</p>
                        {grant.accounts.map((a) => (
                          <button key={a.userId} type="button" className={`btn ${pickUser === a.userId ? 'primary' : 'ghost'}`} onClick={() => setPickUser(a.userId)}>
                            {a.playerName || 'Account'} {a.role === 'kid' ? '(kid account)' : ''}
                          </button>
                        ))}
                      </>
                    )}
                    {grant.accounts.length <= 1 && <p className="start-sheet-tip">Code accepted. Choose the new password for {grant.accounts[0]?.playerName || 'your account'}.</p>}
                    <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="New password" ariaLabel="New password" value={pass} onChange={setPass} />
                    <PasswordInput inputClassName="name-input" autoComplete="new-password" placeholder="Type it again" ariaLabel="Type it again" value={pass2} onChange={setPass2} />
                  </>
                )}
                {captchaBox}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Working…' : grant ? 'Save the new password' : 'Check the code'}
                </button>
                {siteLink}
              </form>
            )}
            {sheet === 'addemail' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  await submitAddEmail()
                }}
              >
                <h3>Add a recovery email</h3>
                <p className="start-sheet-tip">
                  Only used to get this account back if the password is forgotten. We'll send a confirm email — the address counts once you tap its link or enter its code at romansgame.com.
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Send the confirm email'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet('account')}>
                  Back
                </button>
                {siteLink}
              </form>
            )}
            {sheet === 'name' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!name.trim() || nameProblem) return
                  if (!freshAccount) {
                    if (!age13) return setSheet('parent')
                    if (!loadConsent()?.age13 && !terms) return setErr('Please agree to the Terms and Privacy.')
                  }
                  setBusy(true)
                  const r = await savePlayerName(name, freshAccount ? { age13: true, optIn } : { age13, optIn })
                  setBusy(false)
                  if (r.ok) {
                    setFreshAccount(false)
                    if (flow === 'claim') setSheet('claim')
                    else setSheet(r.publicName && r.publicName !== name.trim() ? 'account' : null)
                  } else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Pick your leaderboard name</h3>
                <p className="start-sheet-tip">
                  This name will be shown publicly on the leaderboard, so don't use your full real name. If someone already has it, we'll add a number (like {name.trim() && !nameProblem ? `${name.trim()}02` : 'Mike02'}). You only do this once.
                </p>
                <input className="name-input" type="text" maxLength={NAME_MAX} autoComplete="nickname" placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                {!freshAccount && !loadConsent()?.age13 && consentChecks}
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
                  {busy ? 'Saving…' : 'Save name'}
                </button>
                {siteLink}
              </form>
            )}
            {sheet === 'parent' && (
              <div className="start-sheet-card">
                <h3>Ask a parent to sign up for you</h3>
                <p className="start-sheet-tip">
                  You need to be 13 or older to make your own account here — or a grown-up can make a child's account, on romansgame.com or with the Create account screen (leave the 13-or-older box unticked and use the
                  grown-up's email). You can keep playing everything without one. Your scores just stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Keep playing
                </button>
                {cloud.status === 'signed-in' && (
                  <button type="button" className="btn ghost" onClick={() => { void signOut(); setSheet(null) }}>
                    Sign out
                  </button>
                )}
                {siteLink}
              </div>
            )}
            {sheet === 'account' && (
              <div className="start-sheet-card">
                <h3>Scores are saving</h3>
                <p className="start-sheet-tip">
                  Signed in{shownEmail ? <> as {shownEmail}</> : ''}. Leaderboard name: <b>{cloud.publicName ?? cloud.name}</b>.
                  {cloud.pending ? ` ${cloud.pending} score${cloud.pending === 1 ? '' : 's'} will send when you're back online.` : ' Every game you finish is saved.'}
                </p>
                {cloud.authKind === 'code' && !justClaimed && (
                  <p className="start-sheet-tip">You sign in with an email code. Give your account a name + password and you'll sign in the same way everywhere.</p>
                )}
                {note && <p className="cloud-note" role="status">{note}</p>}
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  Close
                </button>
                {canClaim && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setErr('')
                      setSheet('claim')
                    }}
                  >
                    Give your account a name + password
                  </button>
                )}
                {cloud.authKind === 'password' && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setErr('')
                      setSheet('addemail')
                    }}
                  >
                    Add a recovery email
                  </button>
                )}
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
                <button type="button" className="btn ghost" onClick={() => { void signOutEverywhere(); setSheet(null) }}>
                  Sign out
                </button>
                {siteLink}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
