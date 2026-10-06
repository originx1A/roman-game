import { useEffect, useRef } from 'react'
import { sfxSpark } from '../game/sound'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'

/**
 * 10.06: Buddy flyby — the player's ACTIVE buddy pet occasionally swoops
 * across the screen during play, like the spark critter. Tap it for a
 * perk-flavored reward. Miss it and your tap lands on the board (risk!).
 *
 * Only runs when the player has an active pet (not Solo mode).
 * Spawn cadence is gentler than the critter: every ~75-120s of play.
 */

export type FlybyReward =
  | { type: 'coins'; amount: number }
  | { type: 'hint' }
  | { type: 'heart' }
  | { type: 'bigcoins'; amount: number }
  | { type: 'rescue' }

interface Props {
  active: boolean
  /** The currently active pet, or null for Solo (flyby disabled) */
  petId: PetId | null
  onCatch: (reward: FlybyReward, petId: PetId) => void
}

/** ms of play between flybys */
const FLYBY_FIRST_MS = [45000, 75000] as const
const FLYBY_GAP_MS = [75000, 120000] as const
const FLYBY_GRACE_MS = 5000

export function BuddyFlyby({ active, petId, onCatch }: Props) {
  const elRef = useRef<HTMLButtonElement>(null)
  const caughtRef = useRef(false)
  const rafRef = useRef(0)
  const busyRef = useRef(false)
  const trailRef = useRef<HTMLSpanElement>(null)
  const trailPos = useRef<{ x: number; y: number }[]>([])
  const pathRef = useRef<{
    t0: number
    dur: number
    fromY: number
    amp: number
    dir: 1 | -1
  } | null>(null)
  // keep latest petId in a ref so the rAF loop sees updates
  const petRef = useRef(petId)
  petRef.current = petId
  const catchRef = useRef(onCatch)
  catchRef.current = onCatch

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    // Solo mode or inactive: never show
    if (!active || !petRef.current) {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      el.setAttribute('aria-hidden', 'true')
      cancelAnimationFrame(rafRef.current)
      return
    }

    let cancelled = false

    const hide = () => {
      el.style.opacity = '0'
      el.style.pointerEvents = 'none'
      el.setAttribute('aria-hidden', 'true')
      trailPos.current = []
      if (trailRef.current) trailRef.current.innerHTML = ''
    }

    const show = () => {
      el.style.opacity = '1'
      el.style.pointerEvents = 'auto'
      el.removeAttribute('aria-hidden')
    }

    const startRun = () => {
      caughtRef.current = false
      busyRef.current = false
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
      pathRef.current = {
        t0: performance.now(),
        dur: 6000 + Math.random() * 2000,
        fromY: 25 + Math.random() * 45,
        amp: 5 + Math.random() * 8,
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
        // smooth eased flight, gentle bob
        const ue = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
        const x = p.dir === 1 ? -16 + ue * 132 : 116 - ue * 132
        const y = p.fromY + Math.sin(u * Math.PI * 2) * p.amp
        const rot = Math.sin(u * Math.PI * 2) * 8
        el.style.transform = `translate3d(${x}vw, ${y}vh, 0) translate(-50%, -50%) rotate(${rot}deg)`
        // motion trail
        trailPos.current.push({ x, y })
        if (trailPos.current.length > 5) trailPos.current.shift()
        const trail = trailRef.current
        if (trail) {
          const ghosts = trailPos.current
            .map((pt, i) => {
              const op = ((i + 1) / trailPos.current.length) * 0.3
              return `<span style="position:absolute;left:${pt.x}vw;top:${pt.y}vh;transform:translate(-50%,-50%);opacity:${op.toFixed(2)};font-size:16px;">💫</span>`
            })
            .join('')
          trail.innerHTML = ghosts
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    hide()
    let nextAt = FLYBY_FIRST_MS[0] + Math.random() * (FLYBY_FIRST_MS[1] - FLYBY_FIRST_MS[0])
    let played = 0
    let boardMs = 0
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(now - last, 2000)
      last = now
      if (cancelled || document.hidden) return
      // pet changed to Solo mid-run: hide
      if (!petRef.current) {
        hide()
        return
      }
      played += dt
      boardMs += dt
      const onScreen = pathRef.current != null && !caughtRef.current && el.style.opacity === '1'
      if (!onScreen && played >= nextAt && boardMs >= FLYBY_GRACE_MS) {
        nextAt = played + FLYBY_GAP_MS[0] + Math.random() * (FLYBY_GAP_MS[1] - FLYBY_GAP_MS[0])
        startRun()
      }
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  function catchIt() {
    if (caughtRef.current || busyRef.current) return
    const el = elRef.current
    const pid = petRef.current
    if (!el || !pid || el.style.opacity === '0') return
    caughtRef.current = true
    busyRef.current = true
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    cancelAnimationFrame(rafRef.current)
    sfxSpark()

    // Perk-flavored reward based on the active buddy
    switch (pid) {
      case 'lupa':
        catchRef.current({ type: 'coins', amount: 40 + Math.floor(Math.random() * 41) }, pid)
        break
      case 'aquila':
        catchRef.current({ type: 'hint' }, pid)
        break
      case 'leo':
        catchRef.current({ type: 'heart' }, pid)
        break
      case 'invictus':
        catchRef.current({ type: 'bigcoins', amount: 100 + Math.floor(Math.random() * 51) }, pid)
        break
      case 'nox':
        catchRef.current({ type: 'rescue' }, pid)
        break
      default:
        catchRef.current({ type: 'coins', amount: 30 }, pid)
        break
    }
  }

  return (
    <button
      ref={elRef}
      type="button"
      className="buddy-flyby"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: 'none',
        transform: 'translate3d(-20vw, 40vh, 0) translate(-50%, -50%)',
        willChange: 'transform',
        background: 'none',
        border: 'none',
        padding: 8,
        cursor: 'pointer',
        zIndex: 40,
      }}
      onClick={catchIt}
      aria-label="Your buddy is flying by — tap for a reward"
      aria-hidden
    >
      <span ref={trailRef} className="flyby-trail" aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1 }} />
      <span className="flyby-bob">{petId ? <PetArt id={petId} size={56} /> : null}</span>
    </button>
  )
}
