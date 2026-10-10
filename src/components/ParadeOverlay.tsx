import { useEffect, useRef, useState } from 'react'
import { TapButton } from './TapButton'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'
import { petById } from '../game/pets'
import { CAPPED_TAP_COINS, treasureIcon, treasureLabel, type Treasure } from '../game/paradeTreasure'
import { dayLabel, type DayPerkKind } from '../game/buddyDay'

export interface ParadeBuddy {
  id: PetId
  /** not owned yet: drawn as a silhouette */
  locked: boolean
}

/** "You got: 🪙 +26 coins · 💡 1 free hint" from what was caught */
export function treasureSummary(got: Treasure[]): { coins: number; hints: number; spins: number; text: string } {
  const coins = got.filter((t) => t.kind === 'coins').reduce((a, t) => a + t.amount, 0)
  const hints = got.filter((t) => t.kind === 'hint').length
  const spins = got.filter((t) => t.kind === 'spin').length
  const bits: string[] = []
  if (coins) bits.push(`🪙 +${coins} coins`)
  if (hints) bits.push(`💡 ${hints} free hint${hints > 1 ? 's' : ''}`)
  if (spins) bits.push(`🎡 ${spins} spin${spins > 1 ? 's' : ''}`)
  return { coins, hints, spins, text: bits.join(' · ') }
}

/**
 * Buddy Parade (9.30-j; treasure + buddy of the day 9.30-l; clearer controls 9.30-n).
 * Buddies march across the screen and some carry treasure. TAP A BUDDY'S TREASURE to catch it: it pops
 * with a "+coins" text. Tapping empty space does NOTHING (it used to skip, which felt like the game just
 * went back). A Skip button sits in the top-right corner. When the march ends (or Skip is tapped) a
 * "You got: ..." card shows with a Continue button (tap to close). Treasure not tapped is paid automatically when the march ends or Skip is tapped.
 * With reduced motion the buddies stand still in a row.
 */
export function ParadeOverlay({
  buddies,
  treasure: treasureIn,
  featured,
  featuredKind,
  capped = false,
  readPotPct,
  durationMs,
  reduce,
  onCatch,
  readWallet,
  onDone,
}: {
  buddies: ParadeBuddy[]
  /** index-aligned with `buddies`; missing = nothing carried */
  treasure: (Treasure | undefined)[]
  /** the buddy of the day (null = a guest silhouette) */
  featured: PetId | null
  featuredKind: DayPerkKind
  /** the 3 treasure parades of today are used: buddies still give small coins */
  capped?: boolean
  /** 9.30-t: percent of today's treasure pot still left (live) */
  readPotPct?: () => number
  durationMs: number
  reduce: boolean
  /** returns what was really paid (a spin over the daily limit turns into coins) */
  onCatch: (t: Treasure) => Treasure
  /** the saved wallet right now (shown in the corner chip and on the summary) */
  readWallet: () => { coins: number; hints: number; spins: number }
  onDone: () => void
}) {
  // 9.30-s: EVERY marching buddy can be tapped for something (a buddy with no drop gives a few small coins), never a silent nothing
  const treasure: Treasure[] = buddies.map((_, i) => treasureIn[i] ?? { kind: 'coins', amount: CAPPED_TAP_COINS, fallback: true })
  const [got, setGot] = useState<Record<number, Treasure>>({})
  const [phase, setPhase] = useState<'march' | 'summary'>('march')
  const [wallet, setWallet] = useState(() => readWallet())
  const [potPct, setPotPct] = useState(() => (readPotPct ? readPotPct() : 0))
  const [flies, setFlies] = useState<{ id: number; x0: number; y0: number; dx: number; dy: number; icon: string }[]>([])
  const chipRef = useRef<HTMLDivElement | null>(null)
  const flyId = useRef(0)
  const doneRef = useRef(false)
  const startWallet = useRef(readWallet())
  const caughtIdx = useRef(new Set<number>())
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [grabAllOn, setGrabAllOn] = useState(false)
  const [holding, setHolding] = useState(false)
  // 9.31-m: when every treasure is caught, buddies scurry off and the summary shows right away
  const [scurry, setScurry] = useState(false)
  const scurryTimer = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null)
  const total = treasure.filter(Boolean).length
  const caughtList = Object.values(got)

  /** March over (or Skip): anything not tapped is paid now, then the "You got..." card shows and closes itself */
  const toSummary = () => {
    if (doneRef.current) return
    if (scurryTimer.current) {
      window.clearTimeout(scurryTimer.current)
      scurryTimer.current = null
    }
    treasure.forEach((t, i) => {
      if (!t || caughtIdx.current.has(i)) return
      caughtIdx.current.add(i)
      let real: Treasure = t
      try {
        real = onCatch(t)
      } catch {
        /* keep going */
      }
      setGot((g) => ({ ...g, [i]: real }))
    })
    setWallet(readWallet())
    setPhase('summary')
  }
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }
  useEffect(() => {
    const t = window.setTimeout(toSummary, reduce ? Math.min(durationMs, 12000) : durationMs)
    return () => {
      window.clearTimeout(t)
      if (scurryTimer.current) window.clearTimeout(scurryTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Grab all" appears after 6 seconds so a phone can never fail to collect
  useEffect(() => {
    if (phase !== 'march' || !total) return
    const t = window.setTimeout(() => setGrabAllOn(true), reduce ? 2500 : 6000)
    return () => window.clearTimeout(t)
  }, [phase, total, reduce])

  const featuredName = featured ? petById(featured)?.name : null
  const sum = treasureSummary(caughtList)

  const now = readWallet()
  const gain = { coins: now.coins - startWallet.current.coins, hints: now.hints - startWallet.current.hints, spins: now.spins - startWallet.current.spins }

  const grab = (i: number, t: Treasure, el: HTMLElement) => {
    if (caughtIdx.current.has(i)) return
    caughtIdx.current.add(i)
    let real: Treasure = t
    try {
      real = onCatch(t)
    } catch {
      /* a sound / storage hiccup on a phone must never stop the catch from showing */
    }
    setGot((s) => ({ ...s, [i]: real }))
    // the treasure flies from the buddy to the wallet chip in the corner
    const r = el.getBoundingClientRect()
    const c = chipRef.current?.getBoundingClientRect()
    const x0 = r.left + r.width / 2
    const y0 = r.top + r.height / 2
    const id = ++flyId.current
    if (c) setFlies((f) => [...f, { id, x0, y0, dx: c.left + c.width / 2 - x0, dy: c.top + c.height / 2 - y0, icon: treasureIcon(real) }])
    window.setTimeout(() => {
      setWallet(readWallet())
      if (readPotPct) setPotPct(readPotPct())
      setFlies((f) => f.filter((x) => x.id !== id))
    }, 850)
    // 9.31-m: everything caught — scurry the buddies off and show the summary right away
    if (caughtIdx.current.size >= total) scurryOff()
  }

  /** All treasure caught: buddies scurry off-screen, then the "You got..." summary appears. */
  const scurryOff = () => {
    if (doneRef.current || scurryTimer.current) return
    setScurry(true)
    scurryTimer.current = window.setTimeout(() => {
      scurryTimer.current = null
      toSummary()
    }, 650)
  }

  /**
   * iOS Safari can hand a tap on a moving (CSS-animated) element to the wrong node, drop the click after a finger
   * wobble, or never send it at all. So the whole overlay listens for the FIRST touch event (pointerdown / touchstart /
   * mousedown) and finds the buddy by COORDINATES: the nearest buddy whose (enlarged, at least 96 px) box is within
   * ~70 px of the finger. Click is only a backup. Each treasure can be caught once.
   */
  const HIT_MIN = 96
  const HIT_NEAR = 70
  const tapAt = (x: number, y: number): boolean => {
    const root = rootRef.current
    if (!root) return false
    let best: { i: number; d: number; t: Treasure; el: HTMLElement } | null = null
    root.querySelectorAll<HTMLElement>('[data-parade-i]').forEach((el) => {
      const i = Number(el.dataset.paradeI)
      const t = treasure[i]
      if (!t || caughtIdx.current.has(i)) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const hw = Math.max(r.width, HIT_MIN) / 2
      const hh = Math.max(r.height, HIT_MIN) / 2
      const dx = Math.max(0, Math.abs(x - cx) - hw)
      const dy = Math.max(0, Math.abs(y - cy) - hh)
      const d = Math.hypot(dx, dy)
      if (d <= HIT_NEAR && (!best || d < best.d)) best = { i, d, t, el }
    })
    if (!best) return false
    const b = best as { i: number; d: number; t: Treasure; el: HTMLElement }
    grab(b.i, b.t, b.el)
    return true
  }
  const onTouchDown = (x: number, y: number, target: EventTarget | null, kind: 'down' | 'click' = 'down') => {
    if ((target as HTMLElement | null)?.closest?.('.parade-skip-btn, .parade-grab-all, .parade-continue')) return
    // One touch fires pointerdown + touchstart + mousedown within a few ms, then a click after release.
    // Act on the first; ignore the rest of THAT touch (but a genuinely new tap always counts).
    const at = Date.now()
    const last = lastTap.current
    if (kind === 'click') {
      if (last && at - last.at < 2500) return
    } else if (last && at - last.at < 150) return
    lastTap.current = { at, x, y }
    // hold the march still for a moment under the finger
    setHolding(true)
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => setHolding(false), 700)
    // the buddy under the finger wins; otherwise the nearest one within reach
    const under = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-parade-i]')
    if (under) {
      const i = Number(under.dataset.paradeI)
      const t = treasure[i]
      if (t && !caughtIdx.current.has(i)) {
        grab(i, t, under)
        return
      }
    }
    tapAt(x, y)
  }
  useEffect(() => {
    const root = rootRef.current
    if (!root || phase !== 'march') return
    const pd = (e: PointerEvent) => onTouchDown(e.clientX, e.clientY, e.target)
    const ts = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (t) onTouchDown(t.clientX, t.clientY, e.target)
    }
    const tm = (e: MouseEvent) => onTouchDown(e.clientX, e.clientY, e.target)
    const tc = (e: MouseEvent) => onTouchDown(e.clientX, e.clientY, e.target, 'click')
    root.addEventListener('pointerdown', pd)
    root.addEventListener('touchstart', ts, { passive: true })
    root.addEventListener('mousedown', tm)
    root.addEventListener('click', tc)
    return () => {
      root.removeEventListener('pointerdown', pd)
      root.removeEventListener('touchstart', ts)
      root.removeEventListener('mousedown', tm)
      root.removeEventListener('click', tc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  const grabAll = () => {
    const root = rootRef.current
    if (!root) return
    root.querySelectorAll<HTMLElement>('[data-parade-i]').forEach((el) => {
      const i = Number(el.dataset.paradeI)
      const t = treasure[i]
      if (t && !caughtIdx.current.has(i)) grab(i, t, el)
    })
  }

  if (phase === 'summary') {
    return (
      <div className="parade parade-summary" role="dialog" aria-label="Parade rewards" data-testid="parade" data-phase="summary">
        <div className="parade-title">Parade over!</div>
        <div className="parade-card" data-testid="parade-card">
          <div className="parade-got" data-testid="parade-got">
            {caughtList.length ? (
              <>
                <strong>You got {sum.text}</strong>
                {capped ? <span className="parade-got-list" data-testid="parade-capped-note">Today's treasure is all used up (it is shared by the day's first 3 parades). Each buddy gave a few coins.</span> : null}
              </>
            ) : (
              <strong>No buddies marched this time.</strong>
            )}
          </div>
          {readPotPct ? <div className="parade-pot-left" data-testid="parade-pot-left">Today's treasure left: <b>{readPotPct()}%</b></div> : null}
          <div className="parade-wallet" data-testid="parade-wallet">
            Wallet now: <b>{now.coins}</b> coins · <b>{now.hints}</b> free hints · <b>{now.spins}</b> spins
            {caughtList.length ? <small>(added {[gain.coins ? `+${gain.coins} coins` : '', gain.hints ? `+${gain.hints} hint` : '', gain.spins ? `+${gain.spins} spin` : ''].filter(Boolean).join(', ')})</small> : null}
          </div>
        </div>
        <div className="parade-day" data-testid="parade-day">
          Buddy of the day: <strong>{featuredName ?? 'a guest buddy'}</strong>
          <small>{dayLabel(featuredKind)} for your next 3 boards</small>
        </div>
        <TapButton className="btn primary parade-continue" data-testid="parade-continue" onTap={finish}>
          Continue
        </TapButton>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`parade ${reduce ? 'is-still' : ''} ${holding ? 'is-holding' : ''} ${scurry ? 'is-scurry' : ''}`}
      role="dialog"
      aria-label="Buddy parade. Tap the buddies to grab their treasure."
      data-testid="parade"
      data-phase="march"
      style={{ ['--parade-ms' as string]: `${reduce ? 0 : durationMs}ms` }}
    >
      <TapButton className="parade-skip-btn" data-testid="parade-skip" onTap={toSummary}>
        Skip ›
      </TapButton>
      <div className="parade-wallet-chip" data-testid="parade-wallet-chip" ref={chipRef}>
        🪙 <b>{wallet.coins}</b> · 💡 <b>{wallet.hints}</b>{wallet.spins ? <> · 🎡 <b>{wallet.spins}</b></> : null}
      </div>
      <div className="parade-title">Buddy Parade!</div>
      <div className="parade-prompt" data-testid="parade-prompt">
        {capped
          ? `Today's treasure is all used up. Tap each buddy for +${CAPPED_TAP_COINS} coins! (${caughtList.length}/${total})`
          : `👆 Tap the buddies to grab treasure! (${caughtList.length}/${total})`}
      </div>
      {readPotPct ? (
        <div className="parade-pot" data-testid="parade-pot">
          Today's treasure left: <b>{potPct}%</b>
          <span className="parade-pot-bar" aria-hidden="true"><i style={{ width: `${potPct}%` }} /></span>
        </div>
      ) : null}
      <div className="parade-day" data-testid="parade-day">
        Buddy of the day: <strong>{featuredName ?? 'a guest buddy'}</strong>
        <small>{dayLabel(featuredKind)} for your next 3 boards</small>
      </div>
      <div className="parade-lane">
        {buddies.map((b, i) => {
          const t = treasure[i]
          const mine = got[i]
          return (
            <div key={b.id} className="parade-buddy" style={{ ['--i' as string]: i, ['--n' as string]: buddies.length }}>
              <div className="parade-hop" data-parade-i={t ? i : undefined}>
                {t ? (
                  <button
                    type="button"
                    className={`parade-loot ${mine ? 'is-got' : 'is-live'}`}
                    data-testid="parade-loot"
                    aria-label={mine ? `Caught ${treasureLabel(mine)}` : `Grab ${treasureLabel(t)}`}
                    disabled={!!mine}
                    onClick={(e) => {
                      // keyboard / screen reader / mouse: the button itself
                      e.stopPropagation()
                      // the same touch was already handled by the first-touch listener
                      const last = lastTap.current
                      if (last && Date.now() - last.at < 2500) return
                      if (!caughtIdx.current.has(i)) grab(i, t, e.currentTarget)
                    }}
                  >
                    <span className="parade-loot-icon" aria-hidden>{mine ? '✔' : treasureIcon(t)}</span>
                    <b>{mine ? 'Got it!' : treasureLabel(t)}</b>
                  </button>
                ) : null}
                {mine ? (
                  <span className="parade-pop" data-testid="parade-pop" aria-hidden="true">
                    {treasureIcon(mine)} {treasureLabel(mine)}
                    {mine.kind === 'coins' ? ' coins' : ''}
                  </span>
                ) : null}
                {/* tapping the buddy itself grabs its treasure too */}
                <div
                  className={b.id === featured ? 'parade-star' : undefined}
                  data-testid="parade-buddy-body"
                >
                  <PetArt id={b.id} size={b.id === featured ? 104 : 88} locked={b.locked} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="parade-skip">{caughtList.length ? `Caught so far: ${sum.text}` : 'Tap the buddies to grab their coins. Or just watch: it is paid when the parade ends.'}</div>
      {grabAllOn && total > caughtList.length ? (
        <TapButton className="btn primary parade-grab-all" data-testid="parade-grab-all" onTap={grabAll}>
          ✋ Grab all treasure
        </TapButton>
      ) : null}
      {flies.map((f) => (
        <span key={f.id} className="parade-fly" data-testid="parade-fly" style={{ left: f.x0, top: f.y0, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` }} aria-hidden="true">
          {f.icon}
        </span>
      ))}
    </div>
  )
}
