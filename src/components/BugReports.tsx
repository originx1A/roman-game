import { useState } from 'react'

interface BugReport {
  id: string
  createdAt: number
  description: string
  screen: string
  userAgent: string
  resolved: boolean
}

interface Props {
  ownerKey: string
}

/** Owner-only bug report inbox. Lives behind the passphrase on /roman-owner. */
export function BugReports({ ownerKey }: Props) {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/bug-list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: ownerKey }),
      })
      const data = (await res.json()) as { ok?: boolean; reports?: BugReport[]; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load reports.')
      setReports(data.reports ?? [])
      setLoaded(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  async function act(id: string, action: 'resolve' | 'reopen' | 'delete') {
    try {
      const res = await fetch('/api/bug-resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: ownerKey, id, action }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed.')
      if (action === 'delete') {
        setReports((r) => r.filter((x) => x.id !== id))
      } else {
        setReports((r) => r.map((x) => (x.id === id ? { ...x, resolved: action === 'resolve' } : x)))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed.')
    }
  }

  const unread = reports.filter((r) => !r.resolved).length

  if (!loaded) {
    return (
      <section className="card">
        <h2>🐛 Bug Reports {unread > 0 ? `(${unread} new)` : ''}</h2>
        {err ? <p className="error">{err}</p> : null}
        <button type="button" className="btn" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Load reports'}
        </button>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>🐛 Bug Reports {unread > 0 ? `(${unread} new)` : ''}</h2>
      <button type="button" className="btn ghost" onClick={load} disabled={loading}>
        ↻ Refresh
      </button>
      {err ? <p className="error">{err}</p> : null}
      {reports.length === 0 ? (
        <p>No bug reports yet. Nice.</p>
      ) : (
        <div className="bug-list">
          {reports.map((r) => (
            <article key={r.id} className={`bug-item${r.resolved ? ' is-resolved' : ''}`}>
              <header>
                <time>{new Date(r.createdAt).toLocaleString()}</time>
                <span className="bug-screen">{r.screen}</span>
                {r.resolved ? <span className="bug-badge">✓ resolved</span> : <span className="bug-badge new">new</span>}
              </header>
              <p>{r.description}</p>
              {r.userAgent ? <small className="bug-ua">{r.userAgent}</small> : null}
              <div className="row">
                {r.resolved ? (
                  <button type="button" className="btn ghost" onClick={() => act(r.id, 'reopen')}>
                    Reopen
                  </button>
                ) : (
                  <button type="button" className="btn ghost" onClick={() => act(r.id, 'resolve')}>
                    Mark resolved
                  </button>
                )}
                <button type="button" className="btn ghost danger" onClick={() => act(r.id, 'delete')}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
