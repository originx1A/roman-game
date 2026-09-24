import { useEffect, useRef } from 'react'
import { sfxCoin } from '../game/sound'

export const CRITTER_STASH_GOAL = 5

export type CritterReward =
  | { type: 'coins'; amount: number }
  | { type: 'heart' }
  | { type: 'hint' }

interface Props {
  active: boolean
  /** Informational only — parent owns stash math */
  stashCount: number
  onCatch: (reward: CritterReward) => void
}

/**
 * Spark critter — smooth CSS transform via DOM.
 * One tap = one catch reward. Parent decides stash / spin (never auto-spin here).
 */
export function SparkCritter({ active, onCatch }: Props) {
  const elRef = useRef<HTMLButtonElement>(null)
  const caughtRef = useRef(false)
  const rafRef = useRef(0)
  const spawnTimer = useRef(0)
  const pathRef = useRef<{
    t0: number
    dur: number
    fromY: number
    amp: number
    dir: 1 | -1
  } | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    if (!active) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      el.setAttribute('aria-hidden', 'true')
      window.clearTimeout(spawnTimer.current)
      cancelAnimationFrame(rafRef.current)
      return
    }

    let cancelled = false

    const hide = () => {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      el.setAttribute('aria-hidden', 'true')
    }

    const show = () => {
      el.style.opacity = '1'
      el.style.pointerEvents = 'auto'
      el.removeAttribute('aria-hidden')
    }

    const schedule = () => {
      const delay = 8000 + Math.random() * 14000
      spawnTimer.current = window.setTimeout(() => {
        if (cancelled) return
        startRun()
        schedule()
      }, delay)
    }

    const startRun = () => {
      caughtRef.current = false
      busyRef.current = false
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
      pathRef.current = {
        t0: performance.now(),
        dur: 5200 + Math.random() * 1800,
        fromY: 22 + Math.random() * 50,
        amp: 6 + Math.random() * 10,
        dir,
      }
      show()
      cancelAnimationFrame(rafRef.current)

      const tick = (now: number) => {
        if (cancelled || caughtRef.current) return
        const p = pathRef.current
        if (!p) return
        const u = (now - p.t0) / p.dur
        if (u >= 1) {
          hide()
          return
        }
        const x = p.dir === 1 ? -14 + u * 128 : 114 - u * 128
        const y =
          p.fromY +
          Math.sin(u * Math.PI * 2.4) * p.amp +
          Math.sin(u * Math.PI * 5.2) * (p.amp * 0.28)
        const rot = Math.sin(u * Math.PI * 3) * 12
        el.style.transform = `translate3d(${x}vw, ${y}vh, 0) translate(-50%, -50%) rotate(${rot}deg)`
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    hide()
    spawnTimer.current = window.setTimeout(() => {
      if (cancelled) return
      startRun()
      schedule()
    }, 3500 + Math.random() * 4500)

    return () => {
      cancelled = true
      window.clearTimeout(spawnTimer.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  function catchIt() {
    if (caughtRef.current || busyRef.current) return
    const el = elRef.current
    if (!el || el.style.opacity === '0') return
    caughtRef.current = true
    busyRef.current = true
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    cancelAnimationFrame(rafRef.current)
    sfxCoin()
    // Small random perk only — parent handles 5-catch bonus / spin credit
    const roll = Math.random()
    if (roll < 0.35) onCatch({ type: 'heart' })
    else if (roll < 0.55) onCatch({ type: 'hint' })
    else onCatch({ type: 'coins', amount: 10 + Math.floor(Math.random() * 16) })
  }

  return (
    <button
      ref={elRef}
      type="button"
      className="spark-critter"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: 'none',
        transform: 'translate3d(-20vw, 40vh, 0) translate(-50%, -50%)',
      }}
      onClick={catchIt}
      aria-label="Catch the spark critter"
      aria-hidden
    >
      <span className="critter-body">
        <span className="critter-eye l" />
        <span className="critter-eye r" />
        <span className="critter-tail" />
      </span>
      <span className="critter-glow" />
    </button>
  )
}
