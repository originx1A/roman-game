import { useEffect, useRef } from 'react'

/*
 * 9.33-a6p — Concept C proof: Invictus ACTS.
 *
 * When Invictus's activation fires on his branded board, the abstract row flash
 * becomes the real charge: a painterly war-horse sprite (WebP atlas, 12 frames at
 * 12 fps, JS-stepped) gallops left→right across the landing row, trailing a canvas
 * dust/ember wake, while each crossed tile flares as he passes it. Horse, flares
 * and App's buddy reveal all read the one ease profile below, so the buddy lands
 * the moment the horse crosses its square (see chargePassMs).
 *
 * Asset: /images/fx/invictus-charge-atlas.webp (92 KB) — 1758×348 sheet, 12 frames
 * of 288×171 in a 6×2 grid with 6 px gutters, chroma-keyed from a generated clip
 * (the production route ANIMATION-FORMATS-RESEARCH.md prescribes). Lazy by design:
 * App preloads it only when an Invictus board starts and motion is allowed, so
 * reduced-motion players never download it and keep the abstract charge instead.
 */

export const CHARGE_MS = 1300

const ATLAS_URL = '/images/fx/invictus-charge-atlas.webp'
const FRAME_W = 288
const FRAME_H = 171
const GUTTER = 6
const COLS = 6
const FRAMES = 12
const ATLAS_W = 1758
const ATLAS_H = 348
const STEP_MS = 1000 / 12

/** Horse-centre travel range, as board-width fractions: fully off one edge to fully off the other. */
function travel(size: number): { x0: number; x1: number } {
  const half = 1.2 / size + 0.02 // the horse is 2.4 cells wide; half of that, plus a breath
  return { x0: -half, x1: 1 + half }
}

/** EaseInOutSine — the single motion profile the horse, the flares and the reveal share. */
function ease(u: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * u)
}

/** ms after the charge starts when the horse's centre crosses column `col`'s centre. */
export function chargePassMs(col: number, size: number): number {
  const { x0, x1 } = travel(size)
  const f = (col + 0.5) / size
  const p = Math.min(1, Math.max(0, (f - x0) / (x1 - x0)))
  return Math.round((Math.acos(1 - 2 * p) / Math.PI) * CHARGE_MS)
}

/** True when the player allows cinematic motion (the OS setting AND the game's own toggle). */
export function chargeFxAllowed(): boolean {
  if (typeof window === 'undefined') return false
  if (document.documentElement.dataset.motion === 'reduce') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Warm the atlas cache. Call when an Invictus board starts — never on first paint. */
export function preloadChargeAtlas(): void {
  const img = new Image()
  img.src = ATLAS_URL
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
  ember: boolean
}

export function ChargeHorse({ row, size }: { row: number; size: number }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const horseRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const horse = horseRef.current
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!root || !horse || !img || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    let W = root.clientWidth
    let H = root.clientHeight
    const fitCanvas = () => {
      W = root.clientWidth
      H = root.clientHeight
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fitCanvas()
    window.addEventListener('resize', fitCanvas)

    const { x0, x1 } = travel(size)
    const particles: Particle[] = []
    let raf = 0
    let last = performance.now()
    let t = 0 // accumulated *visible* ms — the charge clock pauses while the tab is hidden

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(64, now - last)
      last = now
      if (document.hidden) return
      t += dt

      const u = Math.min(1, t / CHARGE_MS)
      const centerX = (x0 + (x1 - x0) * ease(u)) * W
      const horseW = (2.4 / size) * W
      const horseH = horseW * (FRAME_H / FRAME_W)
      const rowCenterY = ((row + 0.5) / size) * H

      // The horse: travel across the row, gallop frames stepped at 12 fps
      horse.style.transform = `translate(${Math.round(centerX - horseW / 2)}px, ${Math.round(rowCenterY - horseH / 2)}px)`
      const frame = Math.floor(t / STEP_MS) % FRAMES
      const c = frame % COLS
      const r = Math.floor(frame / COLS)
      img.style.transform = `translate(${(-(c * (FRAME_W + GUTTER)) / ATLAS_W) * 100}%, ${(-(r * (FRAME_H + GUTTER)) / ATLAS_H) * 100}%)`

      // The wake: dust and embers kicked up at his heels while he is over the board
      const centerF = centerX / W
      if (t < CHARGE_MS && centerF > -0.05 && centerF < 1.05) {
        for (let k = 0; k < 3; k++) {
          if (particles.length >= 110) particles.shift()
          particles.push({
            x: centerX - horseW * 0.36 + (Math.random() - 0.5) * horseW * 0.18,
            y: rowCenterY + horseH * (0.24 + Math.random() * 0.22),
            vx: -(0.03 + Math.random() * 0.07),
            vy: (Math.random() - 0.62) * 0.045,
            born: t,
            life: 450 + Math.random() * 400,
            size: 1.6 + Math.random() * 3.2,
            ember: Math.random() < 0.42,
          })
        }
      }
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        const age = t - p.born
        if (age >= p.life) {
          particles.splice(i, 1)
          continue
        }
        const a = 1 - age / p.life
        p.x += p.vx * dt
        p.y += p.vy * dt
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 1.5), 0, Math.PI * 2)
        ctx.fillStyle = p.ember ? `rgba(255, 150, 60, ${0.7 * a})` : `rgba(216, 182, 140, ${0.30 * a})`
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fitCanvas)
    }
  }, [row, size])

  return (
    <div className="charge-fx" ref={rootRef} aria-hidden="true">
      {Array.from({ length: size }, (_, c) => (
        <span
          key={c}
          className="charge-flare"
          style={{
            left: `${(c / size) * 100}%`,
            top: `${(row / size) * 100}%`,
            width: `${100 / size}%`,
            height: `${100 / size}%`,
            animationDelay: `${chargePassMs(c, size)}ms`,
          }}
        />
      ))}
      <canvas className="charge-fx-canvas" ref={canvasRef} />
      <div
        className="charge-horse"
        ref={horseRef}
        style={{ width: `${240 / size}%`, aspectRatio: `${FRAME_W} / ${FRAME_H}` }}
      >
        <img
          ref={imgRef}
          src={ATLAS_URL}
          alt=""
          draggable={false}
          style={{ width: `${(ATLAS_W / FRAME_W) * 100}%` }}
        />
      </div>
    </div>
  )
}
