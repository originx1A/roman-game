import { useState, type FormEvent } from 'react'
import { getSupabase, noteAutoNamed } from './cloud'
import { useTurnstile } from './useTurnstile'

/** Shown while the server still owns the public name. The email is not on this form. */
export function PickPlayerName({ onDismiss }: { onDismiss?: () => void }) {
  const captcha = useTurnstile(true, 'pick-name')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setErr('')
    const captchaToken = await captcha.takeToken()
    captcha.reset()
    if (!captchaToken) {
      setErr(captcha.reason() || "This page couldn't complete the check. Try again.")
      return
    }
    const sb = await getSupabase()
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined
    if (!token) {
      setErr('Sign in again, then pick a name.')
      return
    }
    setBusy(true)
    const res = await fetch('/api/auth/name', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ name, captchaToken }),
    }).catch(() => null)
    const data = (await res?.json().catch(() => null)) as { error?: string; player_name?: string; display_name?: string } | null
    setBusy(false)
    if (!res?.ok) {
      if (data?.error === 'name_taken') setErr('That name is taken. Try another.')
      else if (data?.error === 'name_rejected') setErr('Use 3–20 letters. An email address cannot be the player name.')
      else if (data?.error === 'rate_limited') setErr('Too many tries. Wait and try again.')
      else setErr("Couldn't save that name. Try again.")
      return
    }
    noteAutoNamed(false, data?.player_name, data?.display_name)
  }

  return (
    <form className="start-sheet-card pick-player-name" data-testid="pick-player-name" onSubmit={(event) => void submit(event)}>
      <div className="cloud-turnstile" ref={captcha.box} />
      <h3>Pick your player name</h3>
      <p className="start-sheet-tip">This is the name other players see. Your email stays private.</p>
      <input
        className="name-input"
        type="text"
        maxLength={24}
        autoComplete="nickname"
        aria-label="Player name"
        placeholder="Player name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {err ? <p className="cloud-err" role="alert">{err}</p> : null}
      {captcha.note && !err ? <p className="cloud-err" role="alert">{captcha.note}</p> : null}
      <button type="submit" className="btn primary" disabled={busy || name.trim().length < 3}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
      {onDismiss ? (
        <button type="button" className="btn ghost" data-testid="pick-name-later" onClick={onDismiss}>
          Not now
        </button>
      ) : null}
    </form>
  )
}
