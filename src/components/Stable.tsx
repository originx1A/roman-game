import { useEffect, useRef, useState } from 'react'
import {
  BUNDLES,
  bundleQuote,
  type BundleId,
  couponFor,
  GIFT_TAG,
  giftLabel,
  type Gift,
  careInfo,
  hasPet,
  levelInfo,
  MOOD_DECAY_PER_HOUR,
  MOOD_FLOOR,
  moodKind,
  type MoodKind,
  moodNow,
  onSale,
  perkFor,
  petXp,
  PETS,
  type PetDef,
  priceWith,
  SNACK_COIN_RATE,
  TREATS,
  type TreatId,
  type Coupon,
  type PetId,
  type PetState,
} from '../game/pets'
import { PetArt } from './PetArt'
import './Stable.css'

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

// ---------- meters (PR #53 batch 2, Tony 2026-10-19) ----------
// pets.ts tracks one underlying value (mood, 0-100, decays 2/hr, floor 20) plus a daily
// feeding budget. The detail page shows two bars, both derived from that same state:
//  - Happy = mood directly.
//  - Fed = time until the pet goes hungry, drawn as a bar (a full bar = 12+ hours of food).
// Feeding (Snack +20 mood, Feast +45 mood) pushes both bars back up, so the visuals stay
// honest with the real game logic — no invented state.
/** Mirrors the threshold inside moodKind() in pets.ts: mood < 35 reads as 'hungry'. */
const HUNGRY_LINE = 35
/** A full Fed bar = this many hours before the pet goes hungry. */
const FED_BAR_HOURS = 12

function feedPctFor(mood: number): number {
  const hours = Math.max(0, (mood - HUNGRY_LINE) / MOOD_DECAY_PER_HOUR)
  return Math.max(0, Math.min(100, (hours / FED_BAR_HOURS) * 100))
}

function hungerLabelFor(mood: number, kind: MoodKind): string {
  if (kind === 'hungry') return 'Needs food now!'
  const hours = Math.max(0, (mood - HUNGRY_LINE) / MOOD_DECAY_PER_HOUR)
  if (hours >= 48) return `Hungry in ~${Math.floor(hours / 24)}d`
  if (hours >= 1) return `Hungry in ~${Math.floor(hours)}h`
  return `Hungry in ~${Math.max(1, Math.round(hours * 60))}m`
}

function meterClass(pct: number): string {
  return pct >= 60 ? 'meter-high' : pct >= 35 ? 'meter-mid' : 'meter-low'
}

function moodLabelFor(mood: number, kind: MoodKind): string {
  if (mood <= MOOD_FLOOR) return '😢 Sad'
  if (kind === 'happy') return '😊 Happy'
  if (kind === 'okay') return '🙂 Okay'
  return '🥺 Hungry'
}

// ---------- pet detail page (internal navigation; App.tsx still renders <Stable/> as one screen) ----------
type PetDetailProps = {
  p: PetDef
  pets: PetState
  coins: number
  now: number
  today: string
  owned: boolean
  trial: boolean
  isActive: boolean
  freePickMode: boolean
  onBack: () => void
  onBuy: (id: PetId) => void
  onClaimFree: (id: PetId) => void
  onCare: (id: PetId) => void
  onFeed: (id: PetId, treat: TreatId) => void
  onEquip: (id: PetId | null) => void
}

function PetDetail({ p, pets, coins, now, today, owned, trial, isActive, freePickMode, onBack, onBuy, onClaimFree, onCare, onFeed, onEquip }: PetDetailProps) {
  const lv = levelInfo(petXp(pets, p.id))
  const perk = perkFor(p.id, lv.level, lv.stars)

  // Locked: preview mode — darkened art, unlock button, meters + care hidden until owned.
  if (!owned && !trial) {
    const sale = onSale(p, now)
    const coupon = sale ? couponFor(pets, p.id, now) : null
    const cost = priceWith(p.price, coupon)
    return (
      <div className="stable-detail is-locked">
        <button type="button" className="stable-detail-back" onClick={onBack}>
          {'< Stable'}
        </button>
        <div className="stable-detail-hero">
          <PetArt id={p.id} size={150} locked level={1} stars={0} title={`${p.name} (locked)`} />
        </div>
        <h3 className="stable-detail-name">
          {p.name} <small>the {p.species}</small>
        </h3>
        <p className="stable-detail-blurb">{p.blurb}</p>
        <p className="stable-detail-perk">✨ {perk.label}</p>
        {freePickMode ? (
          <button type="button" className="btn primary stable-detail-unlock stable-free-btn" onClick={() => onClaimFree(p.id)}>
            🎉 Pick {p.name} — FREE!
          </button>
        ) : sale ? (
          <>
            {coupon ? (
              <p className="stable-detail-coupon">
                🏷️ {coupon.pct}% off <small>({COUPON_FROM[coupon.source]} · {leftLabel(coupon.expires - now)})</small>
              </p>
            ) : null}
            <button type="button" className="btn primary stable-detail-unlock" onClick={() => onBuy(p.id)} disabled={coins < cost}>
              {coins >= cost ? `🔒 Unlock for ${cost} 🪙` : `Need ${cost - coins} more 🪙`}
            </button>
          </>
        ) : (
          <p className="stable-detail-off">{p.limited ? `Only ${md(p.limited.from)} – ${md(p.limited.to)}` : 'Not for sale'}</p>
        )}
      </div>
    )
  }

  const care = owned ? careInfo(pets, p.id, now, today) : null
  // Trial buddies have no saved mood yet; the game treats a fresh buddy as MOOD_START (50).
  const mood = care ? care.mood : moodNow(undefined, now)
  const kind = care ? care.kind : moodKind(mood)
  const feedPct = feedPctFor(mood)

  return (
    <div className="stable-detail">
      <button type="button" className="stable-detail-back" onClick={onBack}>
        {'< Stable'}
      </button>
      {trial ? (
        <p className="stable-detail-trial">
          🎁 Trial · {leftLabel(pets.trial!.until - now)}
        </p>
      ) : null}
      <div className="stable-detail-hero">
        <PetArt id={p.id} size={150} level={lv.level} stars={lv.stars} title={p.name} />
      </div>
      <h3 className="stable-detail-name">{p.name}</h3>
      <p className="stable-detail-mood" aria-live="polite">
        {moodLabelFor(mood, kind)}
      </p>

      <section className="stable-meter" aria-label={`Happy, ${mood} percent`}>
        <div className="stable-meter-head">
          <span>Happy</span>
          <span>{mood}%</span>
        </div>
        <div className="stable-meter-bar">
          <i className={meterClass(mood)} style={{ width: `${mood}%` }} />
        </div>
        <p className="stable-meter-sub">Stays happy when you solve boards cleanly. Drops on mistakes.</p>
      </section>

      <section className="stable-meter" aria-label={`Fed, ${hungerLabelFor(mood, kind)}`}>
        <div className="stable-meter-head">
          <span>Fed</span>
          <span>{hungerLabelFor(mood, kind)}</span>
        </div>
        <div className="stable-meter-bar">
          <i className={meterClass(feedPct)} style={{ width: `${feedPct}%` }} />
        </div>
        <p className="stable-meter-sub">Drains while defending. Feed to keep {p.name} active.</p>
      </section>

      <button type="button" className={`btn ${isActive ? 'ghost' : 'primary'} stable-detail-assign`} onClick={() => onEquip(isActive ? null : p.id)}>
        {isActive ? '🛡️ Defending ✓ — Tap to recall' : '🛡️ Assign as Defender'}
      </button>

      {owned && care ? (
        <div className="stable-detail-care" role="group" aria-label="Care actions">
          <button type="button" className="btn tool" onClick={() => onCare(p.id)} disabled={!care.canPet}>
            {care.canPet ? (
              <>
                👋 Pet<small>free</small>
              </>
            ) : (
              <>
                👋 Petted<small>today ✓</small>
              </>
            )}
          </button>
          {TREATS.map((t) => {
            const stock = pets.treats[t.id] ?? 0
            const fromStock = stock > 0
            const short = t.cost - coins
            const noFeeds = care.feedsLeft <= 0
            // Costs always visible: free stock first, otherwise the real coin cost from TREATS,
            // greyed with "Need X more" when the player can't afford it.
            const costLabel = care.maxed ? 'fully grown' : noFeeds ? 'full today' : !fromStock && short > 0 ? `need ${short} more` : fromStock ? `free ×${stock}` : `${t.cost} 🪙`
            return (
              <button
                key={t.id}
                type="button"
                className="btn tool"
                onClick={() => onFeed(p.id, t.id)}
                disabled={care.maxed || noFeeds || (!fromStock && short > 0)}
              >
                {t.id === 'snack' ? '🍪' : '🍖'} {t.name}
                <small>{costLabel}</small>
              </button>
            )
          })}
        </div>
      ) : null}

      {trial ? (
        <button type="button" className="btn primary stable-detail-keep" onClick={() => onBuy(p.id)} disabled={coins < priceWith(p.price, couponFor(pets, p.id, now))}>
          {(() => {
            const cost = priceWith(p.price, couponFor(pets, p.id, now))
            return coins >= cost ? `Keep ${p.name} for ${cost} 🪙` : `Need ${cost - coins} more 🪙`
          })()}
        </button>
      ) : null}

      <p className="stable-detail-perk">✨ {perk.label}</p>
    </div>
  )
}

export type StableProps = {
  pets: PetState
  coins: number
  now: number
  onBuy: (id: PetId) => void
  /** 10.06: claim the one free welcome buddy */
  onClaimFree: (id: PetId) => void
  /** 9.30-b coin bundles */
  onBuyBundle: (id: BundleId) => void
  /** 9.30-m: the free daily pet, and feeding a treat */
  onCare: (id: PetId) => void
  onFeed: (id: PetId, treat: TreatId) => void
  /** 10.06: swap the safe snack stash for coins */
  onSwapTreats: () => void
  /** Toronto date, for the once-a-day care */
  today: string
  onEquip: (id: PetId | null) => void
  /** Look up a gift code without using it (the preview card) */
  onPeek: (code: string) => Promise<{ ok: boolean; message: string; gift?: Gift; note?: string; code?: string }>
  /** Claim it (uses the code) */
  onRedeem: (code: string) => Promise<{ ok: boolean; message: string }>
  onShop: () => void
  onBack: () => void
  /** Redeem link (?gift=CODE) prefill */
  giftCode?: string
  /** PR #53 batch 2: deep-link from the Unseen guide — opens this pet's detail page */
  focusPet?: { id: PetId; key: number } | null
  /** Owner gift codes need the website's functions */
  giftsOnline: boolean
  /** Hide gift code box from guests (2026-10-19: registered players only) */
  isSignedIn: boolean
  /** Signed-in (or local) player name, highlighted in the stable */
  playerName?: string
  signedIn?: boolean
}

export function Stable({ pets, coins, now, onBuy, onClaimFree, onBuyBundle, onCare, onFeed, onSwapTreats, today, onEquip, onPeek, onRedeem, onShop, onBack, giftCode, focusPet, giftsOnline, isSignedIn, playerName, signedIn }: StableProps) {
  const [code, setCode] = useState(giftCode ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /** PR #53 batch 2: pet detail page navigation lives inside Stable — no App.tsx changes. */
  const [selectedPet, setSelectedPet] = useState<PetId | null>(null)
  // PR #53 batch 2: the Unseen guide can deep-link to a pet's detail page.
  const focusKeyRef = useRef(0)
  useEffect(() => {
    if (focusPet && focusPet.key !== focusKeyRef.current) {
      focusKeyRef.current = focusPet.key
      setSelectedPet(focusPet.id)
    }
  }, [focusPet])
  const active = pets.active && hasPet(pets, pets.active, now) ? pets.active : null
  /** 10.06: new player hasn't claimed their free buddy yet */
  const freePickMode = Object.keys(pets.owned).length === 0 && !pets.freePickUsed

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

  // Pet detail page: dedicated full-screen view for one pet (Tony 2026-10-19 spec).
  if (selectedPet) {
    const p = PETS.find((x) => x.id === selectedPet)!
    const owned = !!pets.owned[p.id]
    const trial = !owned && pets.trial?.id === p.id && pets.trial.until > now
    return (
      <main className="panel scroll-pane stable" data-screen="stable">
        <PetDetail
          p={p}
          pets={pets}
          coins={coins}
          now={now}
          today={today}
          owned={owned}
          trial={trial}
          isActive={active === p.id}
          freePickMode={freePickMode}
          onBack={() => setSelectedPet(null)}
          onBuy={onBuy}
          onClaimFree={onClaimFree}
          onCare={onCare}
          onFeed={onFeed}
          onEquip={onEquip}
        />
      </main>
    )
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
          {playerName ? (
            <p className="stable-player" data-testid="stable-player">
              {signedIn ? 'Signed in as ' : 'Playing as '}
              <strong className="player-name-mark">{playerName}</strong>
            </p>
          ) : null}
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

      {/* 10.06: treat defense — safe stash (never stealable) + swap snacks for coins */}
      <div className="stable-stash" aria-label="Treat stash">
        <span>
          🍖 Stash: <strong>{pets.treats.snack}</strong> snacks · <strong>{pets.treats.feast}</strong> feasts
          <small>safe from wild buddies · field pile: {pets.fieldTreats ?? 0}</small>
        </span>
        <button type="button" className="btn tool" onClick={onSwapTreats} disabled={(pets.treats.snack ?? 0) <= 0}>
          Swap snacks → coins <small>1 🍖 = {SNACK_COIN_RATE} 🪙</small>
        </button>
      </div>

      {pets.trial && pets.trial.until > now ? (
        <p className="stable-trial">
          🎁 Free trial: <strong>{PETS.find((p) => p.id === pets.trial!.id)?.name}</strong> · {leftLabel(pets.trial.until - now)}. When it ends you get a coupon for it.
        </p>
      ) : null}

      {Object.keys(pets.owned).length === 0 && !pets.freePickUsed ? (
        <div className="stable-freepick" role="region" aria-label="Pick your free buddy">
          <p className="stable-freepick-title">🎉 Pick your buddy — FREE!</p>
          <p className="stable-freepick-sub">Tap a buddy to meet it, then pick your free one.</p>
        </div>
      ) : null}

      {/* PR #53 batch 2: compact grid — tap a card for the pet detail page. Fits one phone screen. */}
      <div className="stable-list-grid">
        {PETS.map((p) => {
          const owned = pets.owned[p.id]
          const trial = !owned && pets.trial?.id === p.id && pets.trial.until > now
          const have = !!owned || trial
          const lv = levelInfo(petXp(pets, p.id))
          const isActive = active === p.id
          const care = owned ? careInfo(pets, p.id, now, today) : null
          // Trial buddies have no saved mood yet; a fresh buddy starts at MOOD_START (50).
          const mood = care ? care.mood : trial ? moodNow(undefined, now) : null
          const feedPct = mood === null ? null : feedPctFor(mood)
          // A buddy at the hungry line needs care: greyed card + wake-up prompt.
          const dormant = !!care && care.kind === 'hungry'
          return (
            <button
              key={p.id}
              type="button"
              className={`stable-mini ${have ? 'is-owned' : 'is-locked'} ${isActive ? 'is-active' : ''} ${dormant ? 'is-dormant' : ''}`}
              data-pet={p.id}
              data-owned={owned ? 'yes' : trial ? 'trial' : 'no'}
              onClick={() => setSelectedPet(p.id)}
              aria-label={`${p.name} the ${p.species} — open details`}
            >
              <span className="stable-mini-art">
                <PetArt id={p.id} size={80} locked={!have} level={lv.level} stars={lv.stars} title={have ? p.name : `${p.name} (locked)`} />
              </span>
              <span className="stable-mini-name">
                {p.name}
                {owned?.gift ? <small title={GIFT_TAG}> 🎁</small> : null}
              </span>
              {mood !== null && feedPct !== null ? (
                <span className="stable-mini-bars" aria-hidden="true">
                  <span className="stable-mini-bar" title={`Happy ${mood}%`}>
                    <i className={meterClass(mood)} style={{ width: `${mood}%` }} />
                  </span>
                  <span className="stable-mini-bar" title={`Fed ${Math.round(feedPct)}%`}>
                    <i className={meterClass(feedPct)} style={{ width: `${feedPct}%` }} />
                  </span>
                </span>
              ) : (
                <span className="stable-mini-locked">🔒 tap to preview</span>
              )}
              {isActive ? <span className="stable-mini-badge">🛡️ Defending</span> : null}
              {trial ? <span className="stable-mini-badge is-trial">🎁 Trial</span> : null}
              {dormant ? <span className="stable-mini-dormant">💤 Needs care</span> : null}
            </button>
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

      {isSignedIn ? (
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
      ) : null}

      <p className="stable-note">
        Coins only, no random boxes. Win boards to earn coins, or grab more in the <button type="button" className="linkish" onClick={onShop}>Shop</button>. Coupons:
        20% off for a 7-day daily streak, 30% off for a Roman's Trial clear (one per adoption).
      </p>
    </main>
  )
}
