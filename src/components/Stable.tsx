import { useEffect, useRef, useState } from 'react'
import {
  BUNDLES,
  bundleQuote,
  type BundleId,
  couponFor,
  GIFT_TAG,
  giftLabel,
  type Gift,
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
  gift: GIFT_TAG,
}

export type StableProps = {
  pets: PetState
  coins: number
  now: number
  onBuy: (id: PetId) => void
  /** 9.30-b coin bundles */
  onBuyBundle: (id: BundleId) => void
  onEquip: (id: PetId | null) => void
  /** Look up a gift code without using it (the preview card) */
  onPeek: (code: string) => Promise<{ ok: boolean; message: string; gift?: Gift; note?: string; code?: string }>
  /** Claim it (uses the code) */
  onRedeem: (code: string) => Promise<{ ok: boolean; message: string }>
  onShop: () => void
  onBack: () => void
  /** Redeem link (?gift=CODE) prefill */
  giftCode?: string
  /** Owner gift codes need the website's functions */
  giftsOnline: boolean
}

export function Stable({ pets, coins, now, onBuy, onBuyBundle, onEquip, onPeek, onRedeem, onShop, onBack, giftCode, giftsOnline }: StableProps) {
  const [code, setCode] = useState(giftCode ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const active = pets.active && hasPet(pets, pets.active, now) ? pets.active : null

  const [preview, setPreview] = useState<{ code: string; gift: Gift; note: string } | null>(null)
  const autoPeeked = useRef(false)

  /** Step 1: show what the gift is (doesn't use the code) */
  const check = async (raw = code) => {
    if (!raw.trim() || busy) return
    setBusy(true)
    setMsg(null)
    setPreview(null)
    try {
      const r = await onPeek(raw)
      if (r.ok && r.gift) setPreview({ code: r.code ?? raw, gift: r.gift, note: r.note ?? '' })
      else setMsg({ ok: false, text: r.message })
    } finally {
      setBusy(false)
    }
  }

  /** Step 2: claim it */
  const claim = async () => {
    if (!preview || busy) return
    setBusy(true)
    try {
      const r = await onRedeem(preview.code)
      setMsg({ ok: r.ok, text: r.message })
      if (r.ok) setCode('')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  // A redeem link (?gift=CODE) shows its preview right away
  useEffect(() => {
    if (giftCode && giftsOnline && !autoPeeked.current) {
      autoPeeked.current = true
      void check(giftCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [giftCode, giftsOnline])

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
                {owned?.gift ? <span className="stable-gift">🎁 {GIFT_TAG}</span> : null}
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

      {BUNDLES.map((b) => bundleQuote(pets, b.id, now)).some((q) => q.available) ? (
        <section className="stable-bundles" aria-label="Bundles">
          <h3>Bundles</h3>
          {BUNDLES.map((b) => {
            const q = bundleQuote(pets, b.id, now)
            if (!q.available) return null
            const partial = q.missing.length < b.pets.length
            return (
              <article key={b.id} className="stable-bundle" data-bundle={b.id} data-price={q.price}>
                <span className="stable-bundle-art" aria-hidden="true">
                  {q.missing.map((id) => (
                    <PetArt key={id} id={id} size={44} locked />
                  ))}
                </span>
                <div className="stable-bundle-text">
                  <strong>
                    {b.name} <span className="stable-bundle-off">{b.pct}% off</span>
                  </strong>
                  <small>
                    {q.missing.map((id) => PETS.find((p) => p.id === id)!.name).join(' + ')}
                    {partial ? ' (the ones you still need)' : ''}
                  </small>
                  <span className="stable-price">
                    <s>{q.full}</s> <strong>{q.price}</strong> 🪙 · save {q.save}
                  </span>
                </div>
                <button type="button" className="btn primary stable-btn" onClick={() => onBuyBundle(b.id)} disabled={coins < q.price}>
                  {coins >= q.price ? 'Adopt all' : `Need ${q.price - coins} more`}
                </button>
              </article>
            )
          })}
          <p className="stable-note">Bundle prices don't stack with coupons.</p>
        </section>
      ) : null}

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
            <button type="button" className="btn primary" onClick={() => void check()} disabled={busy || !code.trim()}>
              {busy && !preview ? '…' : 'Redeem'}
            </button>
          </div>
        ) : (
          <p className="stable-note">Gift codes work on the website version.</p>
        )}
        {preview ? (
          <div className="gift-preview" data-gift-preview={preview.gift.kind} role="dialog" aria-label={`${GIFT_TAG}: ${giftLabel(preview.gift)}`}>
            <span className={`gift-preview-art ${preview.gift.kind === 'pack' ? 'is-pack' : ''}`} aria-hidden="true">
              {(preview.gift.kind === 'pack' ? preview.gift.items : [preview.gift]).slice(0, 6).map((it, i) =>
                it.kind === 'pet' ? (
                  <PetArt key={i} id={it.pet} size={preview.gift.kind === 'pack' ? 40 : 72} />
                ) : (
                  <span key={i} className="gift-preview-icon">
                    {it.kind === 'coins' ? '🪙' : '🏷️'}
                  </span>
                ),
              )}
            </span>
            <div className="gift-preview-text">
              <small>🎁 {GIFT_TAG}</small>
              {preview.gift.kind === 'pack' ? (
                <>
                  <strong>{preview.gift.pack === 'all' ? 'All buddies pack' : 'Gift pack'}</strong>
                  <ul className="gift-preview-items">
                    {preview.gift.items.map((it, i) => (
                      <li key={i}>{giftLabel(it)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <strong>{giftLabel(preview.gift)}</strong>
              )}
              {preview.note ? <em>“{preview.note}”</em> : null}
              <span className="gift-preview-code">Code {preview.code} · works once</span>
            </div>
            <div className="gift-preview-actions">
              <button type="button" className="btn primary" onClick={() => void claim()} disabled={busy}>
                {busy ? '…' : 'Claim'}
              </button>
              <button type="button" className="btn tool" onClick={() => setPreview(null)} disabled={busy}>
                Not now
              </button>
            </div>
          </div>
        ) : null}
        {msg ? <p className={`stable-msg ${msg.ok ? 'is-ok' : 'is-bad'}`}>{msg.text}</p> : null}
      </section>

      <p className="stable-note">
        Coins only, no random boxes. Win boards to earn coins, or grab more in the <button type="button" className="linkish" onClick={onShop}>Shop</button>. Coupons:
        20% off for a 7-day daily streak, 30% off for a Roman's Trial clear (one per adoption).
      </p>
    </main>
  )
}
