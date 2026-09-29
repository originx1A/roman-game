import { useEffect, useRef, useState } from 'react'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'
import { petById } from '../game/pets'
import { treasureIcon, treasureLabel, type Treasure } from '../game/paradeTreasure'
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
 * "You got: ..." summary shows with a Continue button; only Continue returns to the game.
 * With reduced motion the buddies stand still in a row.
 */
export function ParadeOverlay({
  buddies,
  treasure,
  featured,
  featuredKind,
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
  durationMs: number
  reduce: boolean
  /** returns what was really paid (a spin over the daily limit turns into coins) */
  onCatch: (t: Treasure) => Treasure
  /** the saved wallet right now (shown in the corner chip and on the summary) */
  readWallet: () => { coins: number; hints: number; spins: number }
  onDone: () => void
}) {
  const [got, setGot] = useState<Record<number, Treasure>>({})
  const [phase, setPhase] = useState<'march' | 'summary'>('march')
  const [wallet, setWallet] = useState(() => readWallet())
  const [flies, setFlies] = useState<{ id: number; x0: number; y0: number; dx: number; dy: number; icon: string }[]>([])
  const chipRef = useRef<HTMLDivElement | null>(null)
  const flyId = useRef(0)
  const doneRef = useRef(false)
  const startWallet = useRef(readWallet())
  const caughtIdx = useRef(new Set<number>())
  const total = treasure.filter(Boolean).length
  const caughtList = Object.values(got)

  const toSummary = () => setPhase('summary')
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }
  useEffect(() => {
    const t = window.setTimeout(toSummary, reduce ? Math.min(durationMs, 12000) : durationMs)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const featuredName = featured ? petById(featured)?.name : null
  const sum = treasureSummary(caughtList)

  const now = readWallet()
  const gain = { coins: now.coins - startWallet.current.coins, hints: now.hints - startWallet.current.hints, spins: now.spins - startWallet.current.spins }

  const grab = (i: number, t: Treasure, el: HTMLElement) => {
    if (caughtIdx.current.has(i)) return
    caughtIdx.current.add(i)
    const real = onCatch(t)
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
      setFlies((f) => f.filter((x) => x.id !== id))
    }, 850)
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
              </>
            ) : (
              <>
                <strong>You got: nothing this time</strong>
                <span className="parade-got-list">{total ? 'Tap the glowing treasure on the buddies next time!' : 'Treasure rides in the first 3 parades of each day.'}</span>
              </>
            )}
          </div>
          <div className="parade-wallet" data-testid="parade-wallet">
            Wallet now: <b>{now.coins}</b> coins · <b>{now.hints}</b> free hints · <b>{now.spins}</b> spins
            {caughtList.length ? <small>(added {[gain.coins ? `+${gain.coins} coins` : '', gain.hints ? `+${gain.hints} hint` : '', gain.spins ? `+${gain.spins} spin` : ''].filter(Boolean).join(', ')})</small> : null}
          </div>
        </div>
        <div className="parade-day" data-testid="parade-day">
          Buddy of the day: <strong>{featuredName ?? 'a guest buddy'}</strong>
          <small>{dayLabel(featuredKind)} for your next 3 boards</small>
        </div>
        <button type="button" className="btn primary parade-continue" data-testid="parade-continue" onClick={finish}>
          Continue
        </button>
      </div>
    )
  }

  return (
    <div
      className={`parade ${reduce ? 'is-still' : ''}`}
      role="dialog"
      aria-label="Buddy parade. Tap the buddies to grab their treasure."
      data-testid="parade"
      data-phase="march"
      style={{ ['--parade-ms' as string]: `${reduce ? 0 : durationMs}ms` }}
    >
      <button type="button" className="parade-skip-btn" data-testid="parade-skip" onClick={toSummary}>
        Skip ›
      </button>
      <div className="parade-wallet-chip" data-testid="parade-wallet-chip" ref={chipRef}>
        🪙 <b>{wallet.coins}</b> · 💡 <b>{wallet.hints}</b>{wallet.spins ? <> · 🎡 <b>{wallet.spins}</b></> : null}
      </div>
      <div className="parade-title">Buddy Parade!</div>
      <div className="parade-prompt" data-testid="parade-prompt">
        {total ? `👆 Tap the buddies to grab treasure! (${caughtList.length}/${total})` : 'Enjoy the parade! (Treasure rides in the first 3 parades a day)'}
      </div>
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
              <div className="parade-hop">
                {t ? (
                  <button
                    type="button"
                    className={`parade-loot ${mine ? 'is-got' : 'is-live'}`}
                    data-testid="parade-loot"
                    aria-label={mine ? `Caught ${treasureLabel(mine)}` : `Grab ${treasureLabel(t)}`}
                    disabled={!!mine}
                    onClick={(e) => {
                      e.stopPropagation()
                      grab(i, t, e.currentTarget)
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
                  onClick={(e) => {
                    if (t && !mine) grab(i, t, e.currentTarget as HTMLElement)
                  }}
                >
                  <PetArt id={b.id} size={b.id === featured ? 104 : 88} locked={b.locked} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="parade-skip">{caughtList.length ? `Caught so far: ${sum.text}` : 'Buddies march slowly. Tap Skip to stop early.'}</div>
      {flies.map((f) => (
        <span key={f.id} className="parade-fly" data-testid="parade-fly" style={{ left: f.x0, top: f.y0, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px` }} aria-hidden="true">
          {f.icon}
        </span>
      ))}
    </div>
  )
}
