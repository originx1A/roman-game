import { useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * 9.33-a4: the Collector's-card LIFE (Tony: "look like a cinematic movie… smoke
 * and flames… no more kids game"). A reusable atmosphere layer:
 *  - rising EMBER particles on a canvas (capped budget, paused when tab hidden)
 *  - three drifting SMOKE layers (soft blurred blobs, slow drift)
 *  - a FLAME GLOW breathing at the base (flickering radial gradient)
 *  - a cinematic VIGNETTE grading the screen edges
 * Pure decoration: pointer-events none, painted behind the screen's content
 * (the .has-atmo sibling rules lift real content above it). A `tint` (a
 * Defender's accent) recolours smoke + flame on branded boards.
 * Fully OFF under reduced motion — the OS setting or the game's Reduce motion
 * toggle (which flips data-motion='reduce' on <html>).
 */
export function Atmosphere({ variant = 'home', tint }: { variant?: 'home' | 'play'; tint?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.motion === 'reduce'),
  )

  // Watch both reduced-motion sources for the component's lifetime.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () =>
      setReduced(mq.matches || document.documentElement.dataset.motion === 'reduce')
    sync()
    mq.addEventListener('change', sync)
    const mo = new MutationObserver(sync)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    return () => {
      mq.removeEventListener('change', sync)
      mo.disconnect()
    }
  }, [])

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    interface Ember {
      x: number
      y: number
      r: number
      vy: number
      sway: number
      ph: number
      hue: number
      a: number
    }
    let embers: Ember[] = []
    const spawn = (initial: boolean): Ember => ({
      x: Math.random() * Math.max(1, w),
      y: initial ? Math.random() * Math.max(1, h) : h + 4,
      r: 0.7 + Math.random() * 1.7,
      vy: 0.16 + Math.random() * 0.5,
      sway: 6 + Math.random() * 16,
      ph: Math.random() * Math.PI * 2,
      hue: 18 + Math.random() * 26, // ember orange → gold
      a: 0.32 + Math.random() * 0.5,
    })
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Particle budget: ~1 per 26px of width, hard-capped (fewer over a live board)
      const cap = variant === 'play' ? 34 : 60
      const target = Math.max(12, Math.min(cap, Math.floor(w / 26)))
      embers = Array.from({ length: target }, () => spawn(true))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let last = performance.now()
    const tick = (now: number) => {
      const step = Math.min(50, now - last) / 16.7
      last = now
      ctx.clearRect(0, 0, w, h)
      for (const e of embers) {
        e.y -= e.vy * step
        e.ph += 0.012 * step
        if (e.y < -6) Object.assign(e, spawn(false))
        const x = e.x + Math.sin(e.ph) * e.sway * 0.3
        const flicker = 0.72 + 0.28 * Math.sin(e.ph * 3.1)
        ctx.beginPath()
        ctx.arc(x, e.y, e.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${e.hue}, 95%, 60%, ${(e.a * flicker).toFixed(3)})`
        ctx.shadowColor = `hsla(${e.hue}, 95%, 55%, 0.8)`
        ctx.shadowBlur = 6
        ctx.fill()
      }
      ctx.shadowBlur = 0
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reduced, variant])

  if (reduced) return null
  return (
    <div
      className={`atmo atmo-${variant}`}
      style={tint ? ({ '--atmo-tint': tint } as CSSProperties) : undefined}
      aria-hidden
    >
      <div className="atmo-smoke s1" />
      <div className="atmo-smoke s2" />
      <div className="atmo-smoke s3" />
      <canvas ref={canvasRef} className="atmo-canvas" />
      <div className="atmo-flame" />
      <div className="atmo-vignette" />
    </div>
  )
}
