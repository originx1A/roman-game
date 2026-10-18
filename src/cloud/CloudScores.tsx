import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, loadConsent, saveConsent, onCloud, savePlayerName, sendMagicLink, signOut, type CloudState } from './cloud'
import { policyConsentRecord, POLICY_VERSION, SHARED_PRIVACY_URL, SHARED_TERMS_URL, signupAgreeLabel, type PolicyConsentRecord } from '../game/legalCopy'

/**
 * "Save my scores" button + sheets: email magic-link sign-in, then a one-time name prompt.
 * The whole chosen name is shown publicly (the server adds 02, 03... if it's taken); bad words are rejected on the spot.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'email' | 'sent' | 'name' | 'account' | 'parent'

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const [policyOn, setPolicyOn] = useState(() => !!loadConsent()?.policy)
  function openLegal(section: 'use' | 'privacy') {
    window.dispatchEvent(new CustomEvent('roman:open-legal', { detail: section }))
  }
  function agreedPolicy(): PolicyConsentRecord | null {
    if (!policyOn) return null
    const existing = loadConsent()?.policy
    if (existing && existing.guardian === !age13 && existing.policyVersion === POLICY_VERSION) return existing
    return policyConsentRecord(Date.now(), !age13)
  }
  const consentChecks = (
    <div className="cloud-checks">
      <label className="cloud-check">
        <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
        <span>I'm 13 or older</span>
      </label>
      <label className="cloud-check">
        <input type="checkbox" checked={policyOn} onChange={(e) => setPolicyOn(e.target.checked)} />
        <span aria-label={signupAgreeLabel(!age13)}>
          {age13 ? 'I agree to the ' : 'I am the parent or guardian and I agree to the '}
          <button type="button" className="legal-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegal('use') }}>Terms</button>
          {' and '}
          <button type="button" className="legal-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLegal('privacy') }}>Privacy Policy</button>
        </span>
      </label>
      <p className="start-sheet-tip">
        <a className="legal-link" href={SHARED_TERMS_URL} target="_blank" rel="noopener noreferrer">romansgame.com/terms</a>
        {' · '}
        <a className="legal-link" href={SHARED_PRIVACY_URL} target="_blank" rel="noopener noreferrer">romansgame.com/privacy</a>
      </p>
      <label className="cloud-check">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        <span>Get Roman's World News: the story behind this game. Unsubscribe anytime.</span>
      </label>
      {/* Kit newsletter only: unsubscribing there never touches the game account */}
    </div>
  )

  useEffect(() => {
    const open = () => {
      setErr('')
      setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'email')
    }
    window.addEventListener('roman:open-sign-in', open)
    return () => window.removeEventListener('roman:open-sign-in', open)
  }, [cloud.status, cloud.name])

  // Signed in from the magic link but no name yet: ask once
  useEffect(() => {
    if (cloud.status === 'signed-in' && cloud.name === null) setSheet((s) => (s === 'account' ? s : 'name'))
  }, [cloud.status, cloud.name])

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
    setName('')
    setAge13(false)
    setOptIn(false)
    setPolicyOn(false)
    saveConsent({ age13: false, optIn: false })
    setErr('')
    setSheet('email')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''

  return (
    <>
      <button
        type="button"
        className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
        onClick={() => {
          setErr('')
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'email')
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
            {sheet === 'email' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const policy = agreedPolicy()
                  if (!policy) {
                    if (!age13) return setSheet('parent')
                    return setErr('Agree to the Terms and Privacy Policy to make an account.')
                  }
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  saveConsent({ age13, optIn, policy })
                  setBusy(true)
                  const r = await sendMagicLink(email)
                  setBusy(false)
                  if (r.ok) setSheet('sent')
                  else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Save your scores</h3>
                <p className="start-sheet-tip">
                  Get on the leaderboard and keep your scores on any device. One account covers romansgame.com and this game. We'll email you a sign-in link. No password.
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                {consentChecks}
                {err && <p className="cloud-err" role="alert">{err}</p>}
                <button type="submit" className="btn primary" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
                  Not now
                </button>
              </form>
            )}
            {sheet === 'sent' && (
              <div className="start-sheet-card">
                <h3>Check your email</h3>
                <p className="start-sheet-tip">
                  We sent a link to <b>{email.trim()}</b>. Open it on this device and you're in. Your scores keep saving here until then.
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet(null)}>
                  OK
                </button>
              </div>
            )}
            {sheet === 'name' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!name.trim() || nameProblem) return
                  const policy = agreedPolicy()
                  if (!policy) {
                    if (!age13) return setSheet('parent')
                    return setErr('Agree to the Terms and Privacy Policy to make an account.')
                  }
                  setBusy(true)
                  const r = await savePlayerName(name, { age13, optIn, policy })
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
                {(!loadConsent()?.policy || !loadConsent()?.age13) && consentChecks}
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
                  {busy ? 'Saving…' : 'Save name'}
                </button>
              </form>
            )}
            {sheet === 'parent' && (
              <div className="start-sheet-card">
                <h3>Ask a parent or guardian</h3>
                <p className="start-sheet-tip">
                  A player under 13 needs a parent or guardian to agree to the Terms and Privacy Policy. The parent uses their email for the shared account and checks “I am the parent or guardian and I agree to the Terms and Privacy Policy.” You can keep playing without an account. Scores stay on this device.
                </p>
                <button type="button" className="btn primary" onClick={() => setSheet('email')}>
                  A parent is here
                </button>
                <button type="button" className="btn ghost" onClick={() => setSheet(null)}>
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
