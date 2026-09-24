import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CRITTER_STASH_GOAL } from './SparkCritter'

const LATIN_SAYINGS = [
  { latin: 'Veni, vidi, vici.', gloss: 'I came, I saw, I conquered.' },
  { latin: 'Alea iacta est.', gloss: 'The die is cast.' },
  { latin: 'Audentes fortuna iuvat.', gloss: 'Fortune favors the bold.' },
  { latin: 'Per aspera ad astra.', gloss: 'Through hardship to the stars.' },
  { latin: 'Carpe diem.', gloss: 'Seize the day.' },
  { latin: 'Fortes fortuna adiuvat.', gloss: 'Fortune helps the brave.' },
  { latin: 'Ad astra.', gloss: 'To the stars.' },
  { latin: 'Aut viam inveniam aut faciam.', gloss: "I'll find a way — or make one." },
] as const

export type WinScreenProps = {
  puzzleName: string
  difficultyLabel: string
  themeLabel: string
  timeLabel: string
  score: number
  hintsUsed: number
  livesLeft: number
  maxLives: number
  sparkCount: number
  romanSaying: string
  spins: number
  perfect: boolean
  onNext: () => void
  onReplay: () => void
  onLevels: () => void
  onHome: () => void
  onSpin?: () => void
}

export function WinScreen({
  puzzleName,
  difficultyLabel,
  themeLabel,
  timeLabel,
  score,
  hintsUsed,
  livesLeft,
  maxLives,
  sparkCount,
  romanSaying,
  spins,
  perfect,
  onNext,
  onReplay,
  onLevels,
  onHome,
  onSpin,
}: WinScreenProps) {
  const [entered, setEntered] = useState(false)
  const latin = useMemo(
    () => LATIN_SAYINGS[Math.floor(Math.random() * LATIN_SAYINGS.length)],
    [],
  )

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    <div className={`win-screen ${entered ? 'in' : ''}`} role="dialog" aria-label="Board cleared">
      <div className="win-screen-burst" aria-hidden="true" />
      <div className="win-screen-sparkles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="win-spark" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>

      <div className="win-screen-card">
        <p className="win-screen-kicker">{difficultyLabel} · {themeLabel}</p>
        <h2 className="win-screen-title">Victory!</h2>
        <p className="win-screen-board">{puzzleName}</p>

        <blockquote className="win-latin">
          <p className="win-latin-line">{latin.latin}</p>
          <cite className="win-latin-gloss">{latin.gloss}</cite>
        </blockquote>

        <p className="win-roman-says">{romanSaying}</p>

        {perfect ? <p className="win-perfect">Perfect clear — no hints</p> : null}

        <div className="win-stats" aria-label="Run stats">
          <div className="win-stat">
            <span className="win-stat-label">Time</span>
            <strong className="win-stat-value">{timeLabel}</strong>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">Score</span>
            <strong className="win-stat-value">{score}</strong>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">Sparks</span>
            <strong className="win-stat-value">
              {sparkCount}/{CRITTER_STASH_GOAL}
            </strong>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">Hints</span>
            <strong className="win-stat-value">{hintsUsed}</strong>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">Hearts</span>
            <strong className="win-stat-value">
              {livesLeft}/{maxLives}
            </strong>
          </div>
        </div>

        <div className="win-screen-actions">
          <button type="button" className="btn primary win-cta" onClick={onNext}>
            Next board
          </button>
          {spins > 0 && onSpin ? (
            <button type="button" className="btn ghost win-cta win-spin" onClick={onSpin}>
              Spin prize ({spins})
            </button>
          ) : null}
          <button type="button" className="btn ghost win-cta" onClick={onReplay}>
            Replay
          </button>
          <div className="win-screen-secondary">
            <button type="button" className="btn tool" onClick={onLevels}>
              Levels
            </button>
            <button type="button" className="btn tool" onClick={onHome}>
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
