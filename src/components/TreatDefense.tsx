import { useEffect, useRef, useState } from 'react'
import { PETS, weaponFor, rollStealAmount, type PetId } from '../game/pets'
import { PetArt } from './PetArt'

/**
 * 10.06: Treat defense — wild pets sneak in from the screen edge to steal from
 * the player's vulnerable field treat pile. The player's OWNED buddies (up to 3
 * shown) guard the pile and auto-chase the invader.
 *
 * - Defender catches invader → +3-5 field treats (petGiggle + old-timer banter in App)
 * - Invader reaches the pile → steals tier-based amount (bigger pile = bigger steal), then flees
 * - Player taps the invader → scares it off for +1-2 field treats
 * - Safe stash (snacks/feasts) and coins are NEVER at risk — only the field pile
 *
 * All movement is CSS transforms on fixed elements; only the invader is tappable.
 * Never blocks gameplay. Reduced-motion skips the animation and resolves instantly.
 */

export interface DefenseHandlers {
  onApproach: () => void
  onCaught: (earned: number) => void
  onScared: (earned: number) => void
  onStolen: (stolen: number) => void
}

interface Props extends DefenseHandlers {
  active: boolean
  /** owned pet ids — up to 3 are shown as defenders */
  defenders: PetId[]
  /** all owned pet ids — for attacker pool (mystery attacker when they own them all) */
  allOwned: PetId[]
  /** pet id → level, for the cosmetic weapon badges */
  levels: Partial<Record<PetId, number>>
  /** current field pile (lets the run skip stealing when the pile is empty) */
  fieldTreats: number
  /** home spawns every 3-5 min; during play every 6-9 min */
  mode: 'home' | 'play'
}

/** ms between wild pet visits */
const GAP_HOME: readonly [number, number] = [180000, 300000]
const GAP_PLAY: readonly [number, number] = [360000, 540000]
const FIRST_MS: readonly [number, number] = [45000, 90000]

/** pile anchor — mobile top-center; desktop lower-right of the left margin */
const PILE = { x: 50, y: 13 }
const PILE_DESKTOP = { x: 18, y: 68 }
const CATCH_DIST = 4.2
const STEAL_DIST = 3.5
const INVADER_SPEED = 13 // vw per second
const CHASER_SPEED = 24 // vw per second
const FLEE_SPEED = 22 // vw per second

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
/** pile position — desktop sits in the left black margin, mobile at the top */
const isWideScreen = () => typeof window !== 'undefined' && window.innerWidth >= 900
const pileX = () => (isWideScreen() ? PILE_DESKTOP.x : PILE.x)
const pileY = () => (isWideScreen() ? PILE_DESKTOP.y : PILE.y)

type Phase = 'idle' | 'approach' | 'resolve' | 'flee'

export function TreatDefense({ active, defenders, allOwned, levels, fieldTreats, mode, onApproach, onCaught, onScared, onStolen }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const pileRef = useRef<HTMLDivElement>(null)
  const invaderRef = useRef<HTMLButtonElement>(null)
  const defRefs = useRef<Array<HTMLDivElement | null>>([])
  const [wildId, setWildId] = useState<PetId>('lupa')
  const [wildMystery, setWildMystery] = useState(false)
  const shown = defenders.slice(0, 3)

  // latest props for the rAF loop
  const live = useRef({ defenders, allOwned, levels, fieldTreats, onApproach, onCaught, onScared, onStolen })
  live.current = { defenders, allOwned, levels, fieldTreats, onApproach, onCaught, onScared, onStolen }

  const sim = useRef<{
    phase: Phase
    inv: { x: number; y: number }
    fromX: number
    chasers: { x: number; y: number; bx: number; by: number }[]
    t: number
    last: number
  }>({ phase: 'idle', inv: { x: -20, y: 0 }, fromX: -20, chasers: [], t: 0, last: 0 })

  useEffect(() => {
    const layer = layerRef.current
    const pile = pileRef.current
    const invader = invaderRef.current
    if (!layer || !pile || !invader) return
    let cancelled = false
    let raf = 0
    const reduced = () => document.documentElement.dataset.motion === 'reduce'

    const setVisible = (on: boolean) => {
      for (const el of [...defRefs.current]) {
        if (!el) continue
        el.style.opacity = on ? '1' : '0'
      }
      // pile stays visible always — only defenders/invader toggle
      if (pile) pile.style.opacity = '1'
      invader.style.opacity = on ? '1' : '0'
      invader.style.pointerEvents = on ? 'auto' : 'none'
      invader.setAttribute('aria-hidden', on ? 'false' : 'true')
    }

    // ambient wander: defenders stroll when no invasion is running.
    // On wide screens they stay in the black side margins (off the board);
    // on narrow screens they wander across the top.
    const ambient = { t: 0, last: 0, raf: 0 }
    const startAmbient = () => {
      const ds = live.current.defenders.slice(0, 3)
      if (ds.length === 0 || reduced()) return
      ds.forEach((_, i) => {
        const el = defRefs.current[i]
        if (el) {
          el.style.opacity = '1'
          el.style.pointerEvents = 'none'
        }
      })
      if (pile) {
        pile.style.opacity = '1'
        pile.style.transform = `translate3d(${pileX()}vw, ${pileY()}vh, 0) translate(-50%, -50%)`
      }
      ambient.last = performance.now()
      const wander = (now: number) => {
        if (cancelled || sim.current.phase !== 'idle') return
        const dt = Math.min(0.1, (now - ambient.last) / 1000)
        ambient.last = now
        ambient.t += dt
        const isWide = window.innerWidth >= 900
        ds.forEach((_, i) => {
          const el = defRefs.current[i]
          if (!el) return
          let x: number, y: number
          if (isWide) {
            // desktop: wander in the left black margin around the treat pile
            const baseX = pileX() + (i - (ds.length - 1) / 2) * 4
            x = baseX + Math.sin(ambient.t * 0.5 + i * 2.1) * 1.5
            y = pileY() - 6 + i * 7 + Math.cos(ambient.t * 0.4 + i * 1.7) * 1.2
          } else {
            // mobile: wander across the top
            const baseX = pileX() + (i - (ds.length - 1) / 2) * 12
            x = baseX + Math.sin(ambient.t * 0.5 + i * 2.1) * 4
            y = pileY() + 1.5 + Math.cos(ambient.t * 0.4 + i * 1.7) * 1.2
          }
          el.style.transform = `translate3d(${x}vw, ${y}vh, 0) translate(-50%, -50%)`
        })
        ambient.raf = requestAnimationFrame(wander)
      }
      ambient.raf = requestAnimationFrame(wander)
    }
    const stopAmbient = () => cancelAnimationFrame(ambient.raf)

    const placeDefenders = () => {
      const ds = live.current.defenders.slice(0, 3)
      const s = sim.current
      s.chasers = ds.map((_, i) => {
        const a = (-0.5 + i * 0.5) * 1.1
        return { x: pileX() + Math.sin(a) * 9, y: pileY() + 2.5 + Math.cos(a) * 2, bx: pileX() + Math.sin(a) * 9, by: pileY() + 2.5 + Math.cos(a) * 2 }
      })
      s.chasers.forEach((c, i) => {
        const el = defRefs.current[i]
        if (el) el.style.transform = `translate3d(${c.x}vw, ${c.y}vh, 0) translate(-50%, -50%)`
      })
    }

    const startRun = () => {
      const L = live.current
      // pick a wild pet the player doesn't own; if they own them all,
      // use a mystery silhouette attacker instead of a duplicate
      const owned = new Set(L.allOwned)
      const pool = PETS.map((p) => p.id).filter((id) => !owned.has(id))
      if (pool.length) {
        setWildId(pool[Math.floor(Math.random() * pool.length)])
        setWildMystery(false)
      } else {
        setWildId(PETS[Math.floor(Math.random() * PETS.length)].id)
        setWildMystery(true)
      }

      // reduced motion: resolve instantly, no animation
      if (reduced()) {
        if (L.defenders.length > 0) L.onCaught(3 + Math.floor(Math.random() * 3))
        else if (L.fieldTreats > 0) L.onStolen(rollStealAmount(L.fieldTreats))
        return
      }

      const s = sim.current
      const fromLeft = Math.random() < 0.5
      s.fromX = fromLeft ? -12 : 112
      s.inv = { x: s.fromX, y: rand(9, 15) }
      s.phase = 'approach'
      s.t = 0
      s.last = performance.now()
      stopAmbient()
      placeDefenders()
      setVisible(true)
      L.onApproach()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }

    const finishRun = () => {
      sim.current.phase = 'idle'
      setVisible(false)
      // defenders go back to ambient wandering
      startAmbient()
    }

    const tick = (now: number) => {
      if (cancelled) return
      const s = sim.current
      if (s.phase === 'idle') return
      const dt = Math.min(0.1, (now - s.last) / 1000)
      s.last = now
      s.t += dt
      const L = live.current

      if (s.phase === 'approach') {
        // invader runs at the pile with a wobble
        const dx = pileX() - s.inv.x
        const dy = pileY() - s.inv.y
        const d = Math.max(0.001, dist(s.inv.x, s.inv.y, pileX(), pileY()))
        const wob = Math.sin(s.t * 6) * 1.2
        s.inv.x += (dx / d) * INVADER_SPEED * dt
        s.inv.y += (dy / d) * INVADER_SPEED * dt + wob * dt
        // nearest defender chases
        let best = -1
        let bestD = Infinity
        s.chasers.forEach((c, i) => {
          const cd = dist(c.x, c.y, s.inv.x, s.inv.y)
          if (cd < bestD) {
            bestD = cd
            best = i
          }
        })
        s.chasers.forEach((c, i) => {
          if (i === best && bestD < 26) {
            const cx = s.inv.x - c.x
            const cy = s.inv.y - c.y
            const cd = Math.max(0.001, Math.hypot(cx, cy))
            c.x += (cx / cd) * CHASER_SPEED * dt
            c.y += (cy / cd) * CHASER_SPEED * dt
          } else {
            // hold patrol with a bob
            c.x += (c.bx - c.x) * Math.min(1, dt * 3)
            c.y = c.by + Math.sin(s.t * 2.4 + i) * 0.6
          }
          const el = defRefs.current[i]
          if (el) el.style.transform = `translate3d(${c.x}vw, ${c.y}vh, 0) translate(-50%, -50%)`
        })
        invader.style.transform = `translate3d(${s.inv.x}vw, ${s.inv.y}vh, 0) translate(-50%, -50%)`
        pile.style.transform = `translate3d(${pileX()}vw, ${pileY()}vh, 0) translate(-50%, -50%)`

        if (bestD < CATCH_DIST && best >= 0) {
          // caught!
          s.phase = 'resolve'
          L.onCaught(3 + Math.floor(Math.random() * 3))
          window.setTimeout(() => {
            if (!cancelled && sim.current.phase === 'resolve') {
              sim.current.phase = 'flee'
              sim.current.last = performance.now()
            }
          }, 650)
        } else if (dist(s.inv.x, s.inv.y, pileX(), pileY()) < STEAL_DIST) {
          // reached the pile — steal scales with pile size (bigger pile = bigger target)
          s.phase = 'resolve'
          if (L.fieldTreats > 0) L.onStolen(rollStealAmount(L.fieldTreats))
          window.setTimeout(() => {
            if (!cancelled && sim.current.phase === 'resolve') {
              sim.current.phase = 'flee'
              sim.current.last = performance.now()
            }
          }, 650)
        }
      } else if (s.phase === 'flee') {
        // invader bolts for the nearest edge
        const dirX = s.inv.x < pileX() ? -1 : 1
        s.inv.x += dirX * FLEE_SPEED * dt
        s.inv.y += Math.sin(s.t * 8) * 2 * dt
        invader.style.transform = `translate3d(${s.inv.x}vw, ${s.inv.y}vh, 0) translate(-50%, -50%)`
        if (s.inv.x < -14 || s.inv.x > 114) finishRun()
      } else if (s.phase === 'resolve') {
        s.last = now
      }

      // tick() returns early without rescheduling once the phase is back to idle,
      // so the loop stops on its own when the run finishes
      raf = requestAnimationFrame(tick)
    }

    const scare = () => {
      const s = sim.current
      if (s.phase !== 'approach') return
      s.phase = 'resolve'
      live.current.onScared(1 + Math.floor(Math.random() * 2))
      window.setTimeout(() => {
        if (!cancelled && sim.current.phase === 'resolve') {
          // the rAF loop is still running from the approach phase; it picks up 'flee' on its next tick
          sim.current.phase = 'flee'
          sim.current.last = performance.now()
        }
      }, 450)
    }
    ;(invader as HTMLButtonElement & { __scare?: () => void }).__scare = scare

    setVisible(false)
    if (!active) {
      // not on the board screen — hide everything, no wandering, no invasions
      if (pile) pile.style.opacity = '0'
      for (const el of defRefs.current) if (el) el.style.opacity = '0'
      return () => {
        cancelled = true
      }
    }
    // pile always visible; defenders start wandering immediately
    if (pile) {
      pile.style.opacity = '1'
      pile.style.transform = `translate3d(${pileX()}vw, ${pileY()}vh, 0) translate(-50%, -50%)`
    }
    startAmbient()
    let nextAt = performance.now() + rand(FIRST_MS[0], FIRST_MS[1])
    const timer = window.setInterval(() => {
      if (cancelled || document.hidden || !active) return
      if (sim.current.phase !== 'idle') return
      if (performance.now() >= nextAt) {
        const g: readonly [number, number] = mode === 'home' ? GAP_HOME : GAP_PLAY
        nextAt = performance.now() + rand(g[0], g[1])
        startRun()
      }
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      cancelAnimationFrame(raf)
      cancelAnimationFrame(ambient.raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode])

  const tapScare = () => {
    const el = invaderRef.current as (HTMLButtonElement & { __scare?: () => void }) | null
    el?.__scare?.()
  }

  return (
    <div ref={layerRef} className="treat-defense" aria-hidden="true">
      <div ref={pileRef} className="td-pile" style={{ opacity: 0 }} title="Treat pile">
        🍖
      </div>
      {shown.map((id, i) => {
        const weapon = weaponFor(levels[id] ?? 1)
        return (
          <div
            key={id}
            ref={(el) => {
              defRefs.current[i] = el
            }}
            className="td-defender"
            style={{ opacity: 0 }}
          >
            <PetArt id={id} size={44} level={levels[id] ?? 1} />
            {weapon ? (
              <span className="td-weapon" title={`${weapon.name} — level ${weapon.level}`}>
                {weapon.icon}
              </span>
            ) : null}
          </div>
        )
      })}
      <button
        ref={invaderRef}
        type="button"
        className="td-invader"
        style={{ opacity: 0, pointerEvents: 'none' }}
        onClick={tapScare}
        aria-label="Wild buddy — tap to scare it off"
        aria-hidden="true"
      >
        <span style={wildMystery ? { filter: 'brightness(0)', opacity: 0.85 } : undefined} title={wildMystery ? 'Mystery attacker!' : undefined}>
          <PetArt id={wildId} size={48} />
        </span>
      </button>
    </div>
  )
}
