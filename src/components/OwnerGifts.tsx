import { useEffect, useState } from 'react'
import { PETS, type Gift } from '../game/pets'
import { PetArt } from './PetArt'

/*
 * 9.30-a: Tony's private gift page (web only, hidden route /roman-owner, not linked anywhere).
 * The passphrase is the Netlify env var ROMAN_OWNER_KEY; it is typed here, checked by a Netlify
 * function, kept only in this tab's memory, and never stored or shown.
 */
type Kind = Gift['kind']

export function OwnerGifts() {
  const [status, setStatus] = useState<'loading' | 'missing' | 'ready' | 'offline'>('loading')
  const [envName, setEnvName] = useState('ROMAN_OWNER_KEY')
  const [key, setKey] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [err, setErr] = useState('')
  const [kind, setKind] = useState<Kind>('pet')
  const [pet, setPet] = useState<string>('lupa')
  const [amount, setAmount] = useState(500)
  const [pct, setPct] = useState(30)
  const [days, setDays] = useState(7)
  const [couponPet, setCouponPet] = useState('')
  const [note, setNote] = useState('')
  const [made, setMade] = useState<{ code: string; link: string; what: string }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Roman · owner gifts'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    fetch('/api/gift-status', { headers: { accept: 'application/json' } })
      .then(async (r) => {
        const j = (await r.json()) as { configured?: boolean; env?: string }
        if (j.env) setEnvName(j.env)
        setStatus(j.configured ? 'ready' : 'missing')
      })
      .catch(() => setStatus('offline'))
    return () => meta.remove()
  }, [])

  const unlock = async () => {
    setErr('')
    setBusy(true)
    try {
      const r = await fetch('/api/gift-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) })
      const j = (await r.json()) as { ok?: boolean; configured?: boolean }
      if (j.configured === false) setStatus('missing')
      else if (j.ok) setUnlocked(true)
      else setErr('That passphrase is not right.')
    } catch {
      setErr('Could not reach the gift service.')
    } finally {
      setBusy(false)
    }
  }

  const gift = (): Gift =>
    kind === 'pet'
      ? { kind: 'pet', pet: pet as never }
      : kind === 'coins'
        ? { kind: 'coins', amount }
        : { kind: 'coupon', pct, pet: (couponPet || null) as never, days }

  const describe = (g: Gift) =>
    g.kind === 'pet'
      ? `${PETS.find((p) => p.id === g.pet)?.name} (buddy)`
      : g.kind === 'coins'
        ? `${g.amount} coins`
        : `${g.pct}% off ${g.pet ? PETS.find((p) => p.id === g.pet)?.name : 'any buddy'} for ${g.days} days`

  const create = async () => {
    setErr('')
    setBusy(true)
    try {
      const g = gift()
      const r = await fetch('/api/gift-create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, gift: g, note }) })
      const j = (await r.json()) as { ok?: boolean; code?: string; link?: string; error?: string }
      if (!j.ok || !j.code) {
        setErr(j.error ?? 'Could not make a code.')
        if (r.status === 401) setUnlocked(false)
        return
      }
      setMade((m) => [{ code: j.code!, link: j.link ?? `${location.origin}/?gift=${j.code}`, what: describe(g) }, ...m])
      setNote('')
    } catch {
      setErr('Could not reach the gift service.')
    } finally {
      setBusy(false)
    }
  }

  const copy = (t: string) => void navigator.clipboard?.writeText(t).catch(() => {})

  return (
    <main className="owner-page" data-owner={status}>
      <h1>Roman's Game · owner gifts</h1>
      {status === 'loading' ? <p>Checking…</p> : null}
      {status === 'offline' ? <p className="owner-warn">The gift service isn't reachable here. Use the live website (romans-game.netlify.app/roman-owner).</p> : null}
      {status === 'missing' ? (
        <div className="owner-warn" data-owner-missing="1">
          <p>
            <strong>Gifting isn't set up yet.</strong> The owner passphrase <code>{envName}</code> is not set in Netlify.
          </p>
          <p>
            In Netlify: Site configuration → Environment variables → Add a variable → Key <code>{envName}</code>, value = your secret passphrase (mark it secret, scope
            Functions). Then redeploy the site and reload this page.
          </p>
        </div>
      ) : null}
      {status === 'ready' && !unlocked ? (
        <form
          className="owner-card"
          onSubmit={(e) => {
            e.preventDefault()
            void unlock()
          }}
        >
          <label>
            Owner passphrase
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
          </label>
          <button type="submit" className="btn primary" disabled={busy || !key}>
            Unlock
          </button>
        </form>
      ) : null}
      {status === 'ready' && unlocked ? (
        <div className="owner-card">
          <div className="owner-kinds" role="radiogroup" aria-label="Gift type">
            {(['pet', 'coins', 'coupon'] as Kind[]).map((k) => (
              <button key={k} type="button" className={`btn tool ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
                {k === 'pet' ? 'Buddy' : k === 'coins' ? 'Coins' : 'Coupon'}
              </button>
            ))}
          </div>
          {kind === 'pet' ? (
            <div className="owner-pets">
              {PETS.map((p) => (
                <button key={p.id} type="button" className={`owner-pet ${pet === p.id ? 'on' : ''}`} onClick={() => setPet(p.id)}>
                  <PetArt id={p.id} size={56} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          ) : kind === 'coins' ? (
            <label>
              Coins (10–5000)
              <input type="number" min={10} max={5000} step={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </label>
          ) : (
            <div className="owner-row">
              <label>
                % off (5–50)
                <input type="number" min={5} max={50} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
              </label>
              <label>
                Days (1–30)
                <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </label>
              <label>
                Buddy
                <select value={couponPet} onChange={(e) => setCouponPet(e.target.value)}>
                  <option value="">Any buddy</option>
                  {PETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label>
            Note (just for you)
            <input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="For Roman's birthday" />
          </label>
          <button type="button" className="btn primary" onClick={() => void create()} disabled={busy}>
            Make a one-time code
          </button>
          {made.length ? (
            <ul className="owner-made">
              {made.map((m) => (
                <li key={m.code}>
                  <strong className="owner-code">{m.code}</strong> · {m.what}
                  <br />
                  <a href={m.link}>{m.link}</a>{' '}
                  <button type="button" className="btn tool" onClick={() => copy(m.link)}>
                    Copy link
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {err ? <p className="owner-warn">{err}</p> : null}
      <p className="owner-foot">Each code works once. Players redeem in The Stable (or open the link).</p>
    </main>
  )
}
