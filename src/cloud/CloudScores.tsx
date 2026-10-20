import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, loadConsent, saveConsent, onCloud, renamePlayer, savePlayerName, sendMagicLink, signOut, type CloudState } from './cloud'

/**
 * "Save my scores" button + sheets: email magic-link sign-in, then a one-time name prompt.
 * The whole chosen name is shown publicly (the server adds 02, 03... if it's taken); bad words are rejected on the spot.
 * Switching player is a separate choice. Opening that sheet, or tapping Not now, never signs the current player out.
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
  const [switching, setSwitching] = useState(false)
  const [switchedAway, setSwitchedAway] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameEdit, setNameEdit] = useState('')
  const [nameDismissed, setNameDismissed] = useState(false)
  const [age13, setAge13] = useState(() => loadConsent()?.age13 ?? false)
  const [optIn, setOptIn] = useState(() => loadConsent()?.optIn ?? false)
  const consentChecks = (
    <div className="cloud-checks">
      <label className="cloud-check">
        <input type="checkbox" checked={age13} onChange={(e) => setAge13(e.target.checked)} />
        <span>I'm 13 or older</span>
      </label>
      <label className="cloud-check">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        <span>Get Roman's World News: the story behind this game. Unsubscribe anytime.</span>
      </label>
      {/* Kit newsletter only: unsubscribing there never touches the game account */}
    </div>
  )

  // Signed in from the magic link but no name yet: ask once. Never steal the sheet during an explicit switch.
  useEffect(() => {
    if (switching || nameDismissed) return
    if (cloud.status === 'signed-in' && cloud.name === null) setSheet((s) => (s === 'account' ? s : 'name'))
  }, [cloud.status, cloud.name, switching, nameDismissed])

  const signedIn = cloud.status === 'signed-in' && !!cloud.name
  const label = signedIn
    ? `☁ Saved to your account ✓${cloud.pending ? ` (${cloud.pending} waiting)` : ''}`
    : cloud.pending
      ? `☁ Save my scores (${cloud.pending} waiting)`
      : '☁ Save my scores'

  /** Close whatever sheet is open. Never signs out and never changes the player. */
  function closeSheet() {
    if (sheet === 'name') setNameDismissed(true)
    setSwitching(false)
    setSwitchedAway(false)
    setEditing(false)
    setErr('')
    setSheet(null)
  }

  /** Explicit switch only. The current player stays signed in until a new link is actually sent. */
  function beginSwitch() {
    setSwitching(true)
    setEditing(false)
    setErr('')
    setEmail('')
    if (cloud.status === 'signed-in') setAge13(true)
    setSheet('email')
  }

  const nameProblem = !name.trim() ? '' : isProfane(name) ? "Let's pick a different name. Keep it friendly!" : ''
  const editProblem = !nameEdit.trim() ? '' : isProfane(nameEdit) ? "Let's pick a different name. Keep it friendly!" : ''

  return (
    <>
      <button
        type="button"
        className={`btn ghost cloud-btn${compact ? ' is-compact' : ''}`}
        data-testid="save-scores"
        onClick={() => {
          setErr('')
          setSwitching(false)
          setEditing(false)
          setSheet(cloud.status === 'signed-in' ? (cloud.name ? 'account' : 'name') : 'email')
        }}
      >
        {label}
      </button>
      {sheet &&
        createPortal(
          <div className="start-sheet cloud-sheet" role="dialog" aria-modal="true" aria-label={switching ? 'Switch player' : 'Save my scores'}>
            <div className="start-sheet-scrim" onClick={closeSheet} />
            {sheet === 'email' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!age13) return setSheet('parent')
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  saveConsent({ age13, optIn })
                  setBusy(true)
                  const r = await sendMagicLink(email)
                  setBusy(false)
                  if (!r.ok) return setErr(r.error ?? 'Something went wrong.')
                  // Only a sent link switches players. A failed send leaves the current player signed in.
                  if (switching) {
                    await signOut()
                    setSwitchedAway(true)
                  }
                  setSwitching(false)
                  setSheet('sent')
                }}
              >
                <h3>{switching ? 'Switch player' : 'Save your scores'}</h3>
                <p className="start-sheet-tip">
                  {switching
                    ? `You're signed in as ${cloud.publicName ?? cloud.name ?? cloud.email}. Not now keeps this player. We'll only switch after the new sign-in link is sent.`
                    : "Get on the leaderboard and keep your scores on any device. We'll email you a sign-in link. No password."}
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
              <div className="start-sheet-card">
                <h3>Check your email</h3>
                <p className="start-sheet-tip">
                  {switchedAway
                    ? <>We sent a link to <b>{email.trim()}</b>. Open it on this device to finish switching. This device stays signed out until then.</>
                    : <>We sent a link to <b>{email.trim()}</b>. Open it on this device and you're in. Your scores keep saving here until then.</>}
                </p>
                <button type="button" className="btn primary" onClick={closeSheet}>
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
                  if (!age13) return setSheet('parent')
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
                <button type="button" className="btn ghost" data-testid="cloud-not-now" onClick={closeSheet}>
                  Not now
                </button>
              </form>
            )}
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
