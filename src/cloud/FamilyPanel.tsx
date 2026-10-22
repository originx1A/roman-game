import { useEffect, useState } from 'react'
import { getSupabase } from './cloud'

type Kid = { user_id: string; display_name: string }

/** Minimal family list. Cooper may restyle it. Hidden unless this login is a parent account. */
export function FamilyPanel() {
  const [kids, setKids] = useState<Kid[] | null>(null)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    let cancel = false
    void (async () => {
      const sb = await getSupabase()
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined
      if (!token) return
      const res = await fetch('/api/auth/family', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      })
      if (cancel) return
      if (!res.ok) {
        setKids([])
        setOpen(false)
        return
      }
      const data = (await res.json()) as { kids?: Kid[] }
      setKids(Array.isArray(data.kids) ? data.kids : [])
    })()
    return () => {
      cancel = true
    }
  }, [open])

  async function remove(userId: string) {
    const sb = await getSupabase()
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined
    if (!token) return
    const res = await fetch('/api/auth/family', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action: 'remove', child_user_id: userId }),
    })
    if (!res.ok) {
      setNote('That account is not on this family list.')
      return
    }
    setKids((current) => (current || []).filter((kid) => kid.user_id !== userId))
  }

  if (!open) {
    return (
      <button type="button" className="btn ghost" data-testid="family-open" onClick={() => setOpen(true)}>
        Family
      </button>
    )
  }
  if (kids === null) return <p className="start-sheet-tip">Loading family…</p>
  return (
    <div data-testid="family-list">
      <p className="start-sheet-tip">Kids linked to this email.</p>
      {kids.length === 0 ? <p className="start-sheet-tip">No kids linked yet.</p> : null}
      {kids.map((kid) => (
        <p key={kid.user_id}>
          {kid.display_name || 'Player'}{' '}
          <button type="button" className="btn ghost btn-sm" onClick={() => void remove(kid.user_id)}>
            Remove
          </button>
        </p>
      ))}
      {note ? <p className="cloud-err">{note}</p> : null}
    </div>
  )
}
