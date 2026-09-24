/** Reconstructed from roman-game.surge.sh production JS. */
import { useEffect, useRef, useState } from 'react'

export type PrizeId =
  | 'coins_25'
  | 'coins_50'
  | 'coins_100'
  | 'hint_2'
  | 'heart_refill'
  | 'shield'
  | 'jackpot'

export interface Prize {
  id: PrizeId
  label: string
  weight: number
  color: string
}

export const PRIZES: Prize[] = [
  { id: 'coins_25', label: '+25 coins', weight: 28, color: '#ffd166' },
  { id: 'coins_50', label: '+50 coins', weight: 18, color: '#ffe08a' },
  { id: 'coins_100', label: '+100 coins', weight: 8, color: '#ff9f1c' },
  { id: 'hint_2', label: '+2 hints', weight: 20, color: '#3dffa8' },
  { id: 'heart_refill', label: 'Full hearts', weight: 12, color: '#ff6b6b' },
  { id: 'shield', label: 'Mistake shield', weight: 10, color: '#1a6dff' },
  { id: 'jackpot', label: 'JACKPOT 200', weight: 4, color: '#c77dff' },
]

const SPIN_MS = 2800

function pickPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let r = Math.random() * total
  for (const p of PRIZES) {
    r -= p.weight
    if (r <= 0) return p
  }
  return PRIZES[0]
}

export function PrizeWheel({
  open,
  spinsLeft,
  onConsumeSpin,
  onDone,
  onClose,
}: {
  open: boolean
  spinsLeft: number
  onConsumeSpin: () => boolean
  onDone: (prize: Prize) => void
  onClose: () => void
}) {
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Prize | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const rafRef = useRef(0)
  const locked = useRef(false)
  const finished = useRef(false)

  useEffect(() => {
    if (!open) {
      setSpinning(false)
      setResult(null)
      locked.current = false
      finished.current = false
      offsetRef.current = 0
    }
  }, [open])

  if (!open) return null

  function spin() {
    if (spinning || result || locked.current || finished.current || spinsLeft <= 0 || !onConsumeSpin()) return
    locked.current = true
    setSpinning(true)
    const prize = pickPrize()
    const idx = Math.max(0, PRIZES.findIndex((p) => p.id === prize.id))
    const steps = 6 * PRIZES.length + idx
    const from = offsetRef.current
    const to = -(steps * 64) + 64
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS)
      const eased = 1 - (1 - t) ** 3
      const y = from + (to - from) * eased
      offsetRef.current = y
      if (stripRef.current) stripRef.current.style.transform = `translate3d(0, ${y}px, 0)`
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        setResult(prize)
        setSpinning(false)
        if (!finished.current) {
          finished.current = true
          onDone(prize)
        }
      }
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  const strip = Array.from({ length: 8 }, () => PRIZES).flat()
  const canSpin = !spinning && !result && !locked.current && spinsLeft > 0

  return (
    <div className="overlay prize-overlay">
      <div className="overlay-card prize-card">
        <p className="eyebrow">Roman's bonus</p>
        <h2>Spin for a prize</h2>
        <p className="reel-spins">
          {spinsLeft} spin{spinsLeft === 1 ? '' : 's'} left
        </p>
        <div className="reel-wrap">
          <div className="reel-window">
            <div className="reel-shade top" />
            <div className="reel-shade bot" />
            <div className="reel-pointer" />
            <div className="reel-strip" ref={stripRef}>
              {strip.map((p, i) => (
                <div key={`${p.id}-${i}`} className="reel-cell" style={{ background: p.color }}>
                  <strong>{p.label}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        {result ? (
          <p className="prize-result">
            You got <strong>{result.label}</strong>!
          </p>
        ) : (
          <button type="button" className="btn primary" onClick={spin} disabled={!canSpin}>
            {spinning ? 'Spinning…' : spinsLeft <= 0 ? 'No spins left' : 'Spin it'}
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onClose} disabled={spinning}>
          {result ? 'Continue' : locked.current ? 'Wait…' : 'Close'}
        </button>
      </div>
    </div>
  )
}
