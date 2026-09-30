import { useEffect, useState } from 'react'
import { allBuddiesPack, cleanGiftNote, GIFT_NOTE_MAX, GIFT_TAG, giftLabel, giftShareMessage, PETS, type Gift, type GiftItem, type PetId } from '../game/pets'
import { PetArt } from './PetArt'

/*
 * 9.30-a: Tony's private gift page (web only, hidden route /roman-owner). 9.30-c: no visible link;
 * 7 quick taps on the home-screen title (within 3 s) open it.
 * The passphrase is the Netlify env var ROMAN_OWNER_KEY; it is typed here, checked by a Netlify
 * function, kept only in this tab's memory, and never stored or shown.
 */
type Kind = Gift['kind']

type OwnerStats = {
  days: number; opens: number; uniquePlayers: number; returningPlayers: number; levelsCleared: number
  playsByDay: { day: string; plays: number }[]; playsByHour: number[]; topRegions: { place: string; players: number }[]
  thumbsUp: number; thumbsDown: number; notes: { t: string; vote: 'up' | 'down'; note: string; place: string }[]
}
type OwnerPurchases = {
  days: number
  live: { orders: number; cents: number }; test: { orders: number; cents: number }; unknown: { orders: number; cents: number }
  rows: { at: string; item: string; coins: number; amountCents: number; currency: string; status: string; live: boolean | null; ref: string }[]
}
const money = (cents: number, cur = 'usd') => `${cur.toUpperCase() === 'USD' ? 'US$' : cur.toUpperCase() + ' '}${(cents / 100).toFixed(2)}`
const toToronto = (iso: string) => new Date(iso).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' }) + ' ET'

export function OwnerGifts() {
  const [stats, setStats] = useState<{ s: OwnerStats; at: string } | null>(null)
  const [statsErr, setStatsErr] = useState('')
  const [buys, setBuys] = useState<{ p: OwnerPurchases; at: string } | null>(null)
  const [buysErr, setBuysErr] = useState('')
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
  // 9.30-b packs: the All buddies pack, or a custom bundle of buddies + coins + coupon
  const [packMode, setPackMode] = useState<'all' | 'custom'>('all')
  const [withHoliday, setWithHoliday] = useState(false)
  const [packPets, setPackPets] = useState<PetId[]>(['lupa', 'aquila'])
  const [packCoins, setPackCoins] = useState(0)
  const [packCoupon, setPackCoupon] = useState(false)
  const [made, setMade] = useState<{ code: string; link: string; what: string; message: string }[]>([])
  const [copied, setCopied] = useState('')
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

  const coupon = (): GiftItem => ({ kind: 'coupon', pct, pet: (couponPet || null) as PetId | null, days })
  const customItems = (): GiftItem[] => [
    ...PETS.filter((p) => packPets.includes(p.id)).map((p) => ({ kind: 'pet' as const, pet: p.id })),
    ...(packCoins > 0 ? [{ kind: 'coins' as const, amount: packCoins }] : []),
    ...(packCoupon ? [coupon()] : []),
  ]
  const gift = (): Gift =>
    kind === 'pet'
      ? { kind: 'pet', pet: pet as never }
      : kind === 'coins'
        ? { kind: 'coins', amount }
        : kind === 'coupon'
          ? coupon()
          : packMode === 'all'
            ? allBuddiesPack(withHoliday)
            : { kind: 'pack', pack: 'custom', items: customItems() }
  const packEmpty = kind === 'pack' && packMode === 'custom' && customItems().length === 0
  const togglePackPet = (id: PetId) => setPackPets((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const describe = (g: Gift) => giftLabel(g)

  const create = async () => {
    setErr('')
    setBusy(true)
    try {
      const g = gift()
      const r = await fetch('/api/gift-create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, gift: g, note }) })
      const j = (await r.json()) as { ok?: boolean; code?: string; link?: string; message?: string; error?: string }
      if (!j.ok || !j.code) {
        setErr(j.error ?? 'Could not make a code.')
        if (r.status === 401) setUnlocked(false)
        return
      }
      const link = j.link ?? `${location.origin}/?gift=${j.code}`
      setMade((m) => [{ code: j.code!, link, what: describe(g), message: j.message ?? giftShareMessage({ gift: g, code: j.code!, link, note }) }, ...m])
      setNote('')
    } catch {
      setErr('Could not reach the gift service.')
    } finally {
      setBusy(false)
    }
  }

  const loadStats = async () => {
    setStatsErr('')
    setBusy(true)
    try {
      const r = await fetch('/api/analytics-stats', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, days: 30 }) })
      const j = (await r.json()) as { ok?: boolean; stats?: OwnerStats; generatedAt?: string; error?: string }
      if (!j.ok || !j.stats) setStatsErr(j.error ?? 'Could not load the stats.')
      else setStats({ s: j.stats, at: j.generatedAt ?? new Date().toISOString() })
    } catch {
      setStatsErr('Could not reach the stats service.')
    } finally {
      setBusy(false)
    }
  }

  const loadBuys = async () => {
    setBuysErr('')
    try {
      const r = await fetch('/api/owner-purchases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, days: 30 }) })
      const j = (await r.json()) as { ok?: boolean; purchases?: OwnerPurchases; generatedAt?: string; error?: string }
      if (!j.ok || !j.purchases) setBuysErr(j.error ?? 'Could not load the purchases.')
      else setBuys({ p: j.purchases, at: j.generatedAt ?? new Date().toISOString() })
    } catch {
      setBuysErr('Could not reach the purchases service.')
    }
  }
  // the purchases list opens by itself once the owner page is unlocked
  useEffect(() => {
    if (status === 'ready' && unlocked) void loadBuys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, unlocked])

  const copy = (t: string, what: string) => {
    void navigator.clipboard?.writeText(t).then(() => setCopied(what)).catch(() => {})
  }
  const share = (m: { message: string; code: string }) => {
    if (navigator.share) void navigator.share({ title: `${GIFT_TAG} · Roman's Game`, text: m.message }).catch(() => {})
    else copy(m.message, `msg-${m.code}`)
  }

  const couponFields = (
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
  )

  return (
    <main className="owner-page" data-owner={status}>
      <a className="owner-back" href="/">
        ← Back to game
      </a>
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
            {(['pet', 'coins', 'coupon', 'pack'] as Kind[]).map((k) => (
              <button key={k} type="button" className={`btn tool ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
                {k === 'pet' ? 'Buddy' : k === 'coins' ? 'Coins' : k === 'coupon' ? 'Coupon' : 'Pack'}
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
          ) : kind === 'coupon' ? (
            couponFields
          ) : (
            <div className="owner-pack" data-owner-pack={packMode}>
              <div className="owner-kinds" role="radiogroup" aria-label="Pack type">
                <button type="button" className={`btn tool ${packMode === 'all' ? 'on' : ''}`} onClick={() => setPackMode('all')} aria-pressed={packMode === 'all'}>
                  All buddies
                </button>
                <button type="button" className={`btn tool ${packMode === 'custom' ? 'on' : ''}`} onClick={() => setPackMode('custom')} aria-pressed={packMode === 'custom'}>
                  Custom
                </button>
              </div>
              {packMode === 'all' ? (
                <label className="owner-check">
                  <input type="checkbox" checked={withHoliday} onChange={(e) => setWithHoliday(e.target.checked)} /> Include holiday buddies ({PETS.filter((p) => p.limited).map((p) => p.name).join(', ')})
                </label>
              ) : (
                <>
                  <div className="owner-pets">
                    {PETS.map((p) => (
                      <button key={p.id} type="button" className={`owner-pet ${packPets.includes(p.id) ? 'on' : ''}`} onClick={() => togglePackPet(p.id)} aria-pressed={packPets.includes(p.id)}>
                        <PetArt id={p.id} size={48} />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Plus coins (0 = none, up to 5000)
                    <input type="number" min={0} max={5000} step={10} value={packCoins} onChange={(e) => setPackCoins(Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                  <label className="owner-check">
                    <input type="checkbox" checked={packCoupon} onChange={(e) => setPackCoupon(e.target.checked)} /> Plus a coupon
                  </label>
                  {packCoupon ? couponFields : null}
                </>
              )}
            </div>
          )}
          <label>
            Reason (optional, the player sees it) · {cleanGiftNote(note).length}/{GIFT_NOTE_MAX}
            <input value={note} maxLength={GIFT_NOTE_MAX} onChange={(e) => setNote(e.target.value.slice(0, GIFT_NOTE_MAX))} placeholder="Happy birthday!" />
          </label>
          <p className="owner-preview">
            They'll see: <strong>{GIFT_TAG}: {describe(gift())}</strong>
            {cleanGiftNote(note) ? <> · “{cleanGiftNote(note)}”</> : null}
          </p>
          <button type="button" className="btn primary" onClick={() => void create()} disabled={busy || packEmpty}>
            {kind === 'pack' ? 'Make one code for the whole pack' : 'Make a one-time code'}
          </button>
          {made.length ? (
            <ul className="owner-made">
              {made.map((m) => (
                <li key={m.code} data-owner-code={m.code}>
                  <strong className="owner-code">{m.code}</strong> · {m.what}
                  <p className="owner-message" data-owner-message>
                    {m.message}
                  </p>
                  <div className="owner-row">
                    <button type="button" className="btn primary" onClick={() => copy(m.message, `msg-${m.code}`)}>
                      {copied === `msg-${m.code}` ? 'Copied ✓' : 'Copy message'}
                    </button>
                    <button type="button" className="btn tool" onClick={() => share(m)}>
                      Share…
                    </button>
                    <button type="button" className="btn tool" onClick={() => copy(m.link, `link-${m.code}`)}>
                      {copied === `link-${m.code}` ? 'Link copied ✓' : 'Copy link'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {status === 'ready' && unlocked ? (
        <div className="owner-card owner-purchases" data-testid="owner-purchases">
          <h2>Purchases (last 30 days)</h2>
          {buysErr ? <p className="owner-warn">{buysErr}</p> : null}
          {!buys && !buysErr ? <p>Loading…</p> : null}
          {buys && buys.p.rows.length === 0 ? <p data-testid="no-purchases"><strong>No purchases yet.</strong> When someone buys coins, the order shows up here.</p> : null}
          {buys && buys.p.rows.length > 0 ? (
            <>
              <div className="stat-grid">
                <div><strong>{buys.p.live.orders}</strong>paid orders</div>
                <div><strong>{money(buys.p.live.cents)}</strong>paid total</div>
                {buys.p.test.orders ? <div><strong>{buys.p.test.orders}</strong>test orders ({money(buys.p.test.cents)}, not real money)</div> : null}
                {buys.p.unknown.orders ? <div><strong>{buys.p.unknown.orders}</strong>older orders ({money(buys.p.unknown.cents)})</div> : null}
              </div>
              <ul data-testid="purchase-list">
                {buys.p.rows.map((r) => (
                  <li key={r.ref + r.at}>
                    {toToronto(r.at)} · {r.item} · <b>{money(r.amountCents, r.currency)}</b> · {r.status}{r.live === false ? ' · TEST' : ''} · ref …{r.ref}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" className="btn ghost" data-testid="purchases-refresh" onClick={() => void loadBuys()}>Refresh purchases</button>
          <small>
            Orders are written when a buyer's coins are handed out (no card details, names or emails are kept), shown in Toronto time.
            If a buyer pays and never returns to the game, that order only appears in your Stripe dashboard (dashboard.stripe.com → Payments), which is always the full record.
            {buys ? ` Updated ${toToronto(buys.at)}.` : ''}
          </small>
        </div>
      ) : null}
      {status === 'ready' && unlocked ? (
        <div className="owner-card owner-stats" data-testid="owner-stats">
          <h2>Anonymous stats (last 30 days)</h2>
          <button type="button" className="btn primary" data-testid="stats-load" disabled={busy} onClick={() => void loadStats()}>
            {stats ? 'Refresh' : 'Show stats'}
          </button>
          {statsErr ? <p className="owner-warn">{statsErr}</p> : null}
          {stats ? (
            <>
              <div className="stat-grid">
                <div><strong>{stats.s.opens}</strong>opens</div>
                <div><strong>{stats.s.uniquePlayers}</strong>unique players</div>
                <div><strong>{stats.s.returningPlayers}</strong>returning players</div>
                <div><strong>{stats.s.levelsCleared}</strong>levels cleared</div>
                <div><strong>{stats.s.thumbsUp}</strong>👍</div>
                <div><strong>{stats.s.thumbsDown}</strong>👎</div>
              </div>
              <h3>Plays by day (Toronto)</h3>
              <ul>{stats.s.playsByDay.length ? stats.s.playsByDay.map((d) => <li key={d.day}>{d.day}: {d.plays}</li>) : <li>No plays yet</li>}</ul>
              <h3>Plays by hour (Toronto, 0–23)</h3>
              <div className="hours" aria-hidden>{stats.s.playsByHour.map((n, h) => <i key={h} title={`${h}:00 · ${n}`} style={{ height: `${Math.max(3, (n / Math.max(1, ...stats.s.playsByHour)) * 100)}%` }} />)}</div>
              <p>{stats.s.playsByHour.map((n, h) => (n ? `${h}h:${n}` : '')).filter(Boolean).join('  ') || 'No plays yet'}</p>
              <h3>Top regions</h3>
              <ul>{stats.s.topRegions.length ? stats.s.topRegions.map((r) => <li key={r.place}>{r.place}: {r.players} player{r.players === 1 ? '' : 's'}</li>) : <li>None yet</li>}</ul>
              <h3>Recent notes</h3>
              <ul>{stats.s.notes.length ? stats.s.notes.map((n, i) => <li key={i}>{n.vote === 'up' ? '👍' : '👎'} “{n.note}” · {toToronto(n.t)} · {n.place}</li>) : <li>No notes yet</li>}</ul>
              <small>Updated {toToronto(stats.at)}. Stored in UTC, shown in Toronto time. No IP addresses or names are kept.</small>
            </>
          ) : null}
        </div>
      ) : null}
      {err ? <p className="owner-warn">{err}</p> : null}
      <p className="owner-foot">Each code works once. Players redeem in The Stable (or open the link), and see it as “{GIFT_TAG}”.</p>
    </main>
  )
}
