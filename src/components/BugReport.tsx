import { useState } from 'react'

interface Props {
  currentScreen: string
  onBack: () => void
}

/** Player-facing bug report form. No login needed — just describe the issue and submit. */
export function BugReport({ currentScreen, onBack }: Props) {
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const text = description.trim()
    if (!text) {
      setError('Please describe what happened.')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/bug-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: text,
          screen: currentScreen,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.')
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the report. Try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <main className="page bug-report">
        <h1>🐛 Report a Bug</h1>
        <div className="card">
          <p>Thanks! Your report's been sent. We'll look into it.</p>
          <button type="button" className="btn" onClick={onBack}>
            ← Back to game
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="page bug-report">
      <h1>🐛 Report a Bug</h1>
      <div className="card">
        <p>Found something broken? Tell us what happened and we'll fix it.</p>
        <label htmlFor="bug-desc">What went wrong?</label>
        <textarea
          id="bug-desc"
          rows={5}
          placeholder="e.g. The board froze after I placed a buddy on level 12..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onBack}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={submit} disabled={sending}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </div>
    </main>
  )
}
