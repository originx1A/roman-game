import { useState } from 'react'
import {
  couponFor,
  hasPet,
  levelInfo,
  onSale,
  perkFor,
  petXp,
  PETS,
  priceWith,
  TIER_LABEL,
  type Coupon,
  type PetId,
  type PetState,
} from '../game/pets'
import { PetArt } from './PetArt'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const md = (s: string) => `${MONTHS[Number(s.slice(0, 2)) - 1]} ${Number(s.slice(3))}`

function leftLabel(ms: number): string {
  const h = Math.max(0, ms) / 3_600_000
  if (h >= 48) return `${Math.floor(h / 24)}d left`
  if (h >= 1) return `${Math.floor(h)}h left`
  return `${Math.max(1, Math.round(h * 60))}m left`
}

const COUPON_FROM: Record<Coupon['source'], string> = {
  streak: '7-day streak',
  'trial-clear': 'Trial clear',
  'trial-end': 'Trial ended',
  gift: 'Gift from Tony',
}

export type StableProps = {
  pets: PetState
  coins: number
  now: number
  onBuy: (id: PetId) => void
  onEquip: (id: PetId | null) => void
  onRedeem: (code: string) => Promise<{ ok: boolean; message: string }>
  onShop: () => void
  onBack: () => void
  /** Redeem link (?gift=CODE) prefill */
  giftCode?: string
  /** Owner gift codes need the website's functions */
  giftsOnline: boolean
}

export function Stable({ pets, coins, now, onBuy, onEquip, onRedeem, onShop, onBack, giftCode, giftsOnline }: StableProps) {
  const [code, setCode] = useState(giftCode ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const active = pets.active && hasPet(pets, pets.active, now) ? pets.active : null

  const redeem = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await onRedeem(code)
      setMsg({ ok: r.ok, text: r.message })
      if (r.ok) setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="panel scroll-pane stable" data-screen="stable">
      <div className="stable-head">
        <button type="button" className="hud-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div>
          <h2>The Stable</h2>
          <p className="stable-sub">Roman's buddies. Keep them forever, ride with one.</p>
        </div>
        <span className="stable-coins" aria-label={`${coins} coins`}>
          🪙 {coins}
        </span>
      </div>

      <div className="stable-now">
        <span>
          {active ? (
            <>
              Riding with <strong>{PETS.find((p) => p.id === active)?.name}</strong>
            </>
          ) : (
            <>
              <strong>Solo</strong>: no buddy on your runs
            </>
          )}
        </span>
        <button type="button" className={`btn tool stable-solo ${active ? '' : 'on'}`} onClick={() => onEquip(null)} disabled={!active}>
          {active ? 'Go Solo' : 'Solo ✓'}
        </button>
        <button type="button" className="btn tool" onClick={onShop}>
          Shop
        </button>
      </div>

      {pets.trial && pets.trial.until > now ? (
        <p className="stable-trial">
          🎁 Free trial: <strong>{PETS.find((p) => p.id === pets.trial!.id)?.name}</strong> · {leftLabel(pets.trial.until - now)}. When it ends you get a coupon for it.
        </p>
      ) : null}

      <div className="stable-grid">
        {PETS.map((p) => {
          const owned = pets.owned[p.id]
          const trial = !owned && pets.trial?.id === p.id && pets.trial.until > now
          const have = !!owned || trial
          const lv = levelInfo(petXp(pets, p.id))
          const perk = perkFor(p.id, have ? lv.level : 1)
          const sale = onSale(p, now)
          const coupon = !owned && sale ? couponFor(pets, p.id, now) : null
          const cost = priceWith(p.price, coupon)
          const isActive = active === p.id
          return (
            <article
              key={p.id}
              className={`stable-card tier-${p.tier} ${have ? 'is-owned' : 'is-locked'} ${isActive ? 'is-active' : ''}`}
              data-pet={p.id}
              data-owned={owned ? 'yes' : trial ? 'trial' : 'no'}
            >
              <div className="stable-card-top">
                <span className={`stable-tier tier-${p.tier}`}>{p.limited ? `Limited · ${p.limited.label}` : TIER_LABEL[p.tier]}</span>
                {owned?.gift ? <span className="stable-gift">🎁 Gift from Tony</span> : null}
                {trial ? <span className="stable-gift is-trial">Trial · {leftLabel(pets.trial!.until - now)}</span> : null}
              </div>
              <div className="stable-art">
                <PetArt id={p.id} size={92} locked={!have} title={have ? p.name : `${p.name} (locked)`} />
                {coupon ? (
                  <span className="stable-coupon" data-coupon={coupon.pct} title={`${COUPON_FROM[coupon.source]} coupon`}>
                    {coupon.pct}% off
                    <small>{leftLabel(coupon.expires - now)}</small>
                  </span>
                ) : null}
              </div>
              <h3>
                {p.name} <small>the {p.species}</small>
              </h3>
              <p className="stable-perk">{perk.label}</p>
              {have ? (
                <>
                  <div className="stable-level" aria-label={`Level ${lv.level}`}>
                    <span>Lv {lv.level}</span>
                    <span className="stable-bar">
                      <i style={{ width: lv.max ? '100%' : `${Math.round((lv.into / lv.need) * 100)}%` }} />
                    </span>
                    <small>{lv.max ? 'Max' : `${lv.into}/${lv.need}`}</small>
                  </div>
                  {perk.next ? <p className="stable-next">{perk.next}</p> : <p className="stable-next">{p.blurb}</p>}
                  <button type="button" className={`btn ${isActive ? 'ghost' : 'primary'} stable-btn`} onClick={() => onEquip(p.id)} disabled={isActive}>
                    {isActive ? 'Riding ✓' : 'Ride with'}
                  </button>
                  {trial ? (
                    <button type="button" className="btn tool stable-keep" onClick={() => onBuy(p.id)} disabled={coins < cost}>
                      Keep for {cost} 🪙
                    </button>
                  ) : null}
                </>
              ) : sale ? (
                <>
                  <p className="stable-next">{p.blurb}</p>
                  <p className="stable-price">
                    {coupon ? <s>{p.price}</s> : null} <strong>{cost}</strong> 🪙
                  </p>
                  <button type="button" className="btn primary stable-btn" onClick={() => onBuy(p.id)} disabled={coins < cost}>
                    {coins >= cost ? 'Adopt' : `Need ${cost - coins} more`}
                  </button>
                </>
              ) : (
                <>
                  <p className="stable-next">{p.blurb}</p>
                  <p className="stable-price is-off">
                    {p.limited ? `Only ${md(p.limited.from)} – ${md(p.limited.to)}` : 'Not for sale'}
                  </p>
                </>
              )}
            </article>
          )
        })}
      </div>

      <section className="stable-redeem" aria-label="Gift code">
        <h3>Got a gift code?</h3>
        {giftsOnline ? (
          <div className="stable-redeem-row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROMA-7K2P"
              maxLength={12}
              aria-label="Gift code"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button type="button" className="btn primary" onClick={redeem} disabled={busy || !code.trim()}>
              {busy ? '…' : 'Redeem'}
            </button>
          </div>
        ) : (
          <p className="stable-note">Gift codes work on the website version.</p>
        )}
        {msg ? <p className={`stable-msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
      </section>

      <p className="stable-note">
        Coins only, no random boxes. Win boards to earn coins, or grab more in the <button type="button" className="linkish" onClick={onShop}>Shop</button>. Coupons:
        20% off for a 7-day daily streak, 30% off for a Roman's Trial clear (one per adoption).
      </p>
    </main>
  )
}
