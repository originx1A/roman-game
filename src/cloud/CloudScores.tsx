import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isProfane } from './profanity'
import { NAME_MAX, onCloud, savePlayerName, sendMagicLink, signOut, type CloudState } from './cloud'

/**
 * "Save my scores" button + sheets: email magic-link sign-in, then a one-time name prompt.
 * The whole chosen name is shown publicly (the server adds 02, 03... if it's taken); bad words are rejected on the spot.
 */
export function useCloud(): CloudState {
  const [s, setS] = useState<CloudState>({ status: 'off', pending: 0 })
  useEffect(() => onCloud(setS), [])
  return s
}

type Sheet = null | 'email' | 'sent' | 'name' | 'account'

export function CloudScoresButton({ suggestedName, compact }: { suggestedName?: string; compact?: boolean }) {
  const cloud = useCloud()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState(suggestedName ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

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
      {sheet &&
        createPortal(
          <div className="start-sheet cloud-sheet" role="dialog" aria-modal="true" aria-label="Save my scores">
            <div className="start-sheet-scrim" onClick={() => setSheet(null)} />
            {sheet === 'email' && (
              <form
                className="start-sheet-card"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Type a full email address.')
                  setBusy(true)
                  const r = await sendMagicLink(email)
                  setBusy(false)
                  if (r.ok) setSheet('sent')
                  else setErr(r.error ?? 'Something went wrong.')
                }}
              >
                <h3>Save your scores</h3>
                <p className="start-sheet-tip">
                  Get on the leaderboard and keep your scores on any device. We'll email you a sign-in link. No password. Kids: ask a grown-up first.
                </p>
                <input className="name-input" type="email" inputMode="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
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
                  setBusy(true)
                  const r = await savePlayerName(name)
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
                {(nameProblem || err) && <p className="cloud-err" role="alert">{nameProblem || err}</p>}
                <button type="submit" className="btn primary" disabled={busy || !name.trim() || !!nameProblem}>
                  {busy ? 'Saving…' : 'Save name'}
                </button>
              </form>
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
