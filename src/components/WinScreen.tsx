import { useEffect, useState, type CSSProperties } from 'react'
import { CRITTER_STASH_GOAL } from './SparkCritter'

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
  onShare?: () => void
  onDuel?: () => void
  /** Buddy meter after this win: filled notches of `goal`; `pending` = Buddy Hunt is ready */
  buddyMeter?: { notches: number; goal: number; pending: boolean; perfect: boolean }
  onBuddyHunt?: () => void
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
  onShare,
  onDuel,
  buddyMeter,
  onBuddyHunt,
}: WinScreenProps) {
  const [entered, setEntered] = useState(false)

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
        {/* Scrolls on its own only if a very short screen can't fit it; the buttons stay pinned below. */}
        <div className="win-screen-body">
          <h2 className="win-screen-title">Victory!</h2>
          <p className="win-screen-kicker">
            <span className="win-screen-board">{puzzleName}</span> · {difficultyLabel} · {themeLabel}
          </p>

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

          {buddyMeter ? (
            <div
              className={`buddy-meter ${buddyMeter.pending ? 'is-full' : ''}`}
              aria-label={`Buddy meter ${buddyMeter.pending ? buddyMeter.goal : buddyMeter.notches} of ${buddyMeter.goal}`}
              data-meter={buddyMeter.pending ? buddyMeter.goal : buddyMeter.notches}
            >
              <span className="buddy-meter-label">Buddy meter</span>
              <span className="buddy-meter-notches">
                {Array.from({ length: buddyMeter.goal }, (_, i) => (
                  <i
                    key={i}
                    className={
                      buddyMeter.pending || i < buddyMeter.notches
                        ? `on ${buddyMeter.perfect && (buddyMeter.pending ? i === buddyMeter.goal - 1 : i === buddyMeter.notches - 1) ? 'new' : ''}`
                        : ''
                    }
                  />
                ))}
              </span>
              <span className="buddy-meter-hint">
                {buddyMeter.pending ? 'Full!' : buddyMeter.perfect ? 'Perfect win +1' : 'Perfect wins fill it'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="win-screen-actions">
          {buddyMeter?.pending && onBuddyHunt ? (
            <button type="button" className="btn primary win-cta win-hunt" onClick={onBuddyHunt}>
              Buddy Hunt!
            </button>
          ) : null}
          <button type="button" className={`btn ${buddyMeter?.pending && onBuddyHunt ? 'ghost' : 'primary'} win-cta`} onClick={onNext}>
            Next board
          </button>
          <div className="win-screen-row">
            {onShare ? (
              <button type="button" className="btn ghost win-cta" onClick={onShare}>
                Share
              </button>
            ) : null}
            <button type="button" className="btn ghost win-cta" onClick={onReplay}>
              Play again
            </button>
            {onDuel ? (
              <button type="button" className="btn ghost win-cta" onClick={onDuel}>
                Head-to-head
              </button>
            ) : null}
            {spins > 0 && onSpin ? (
              <button type="button" className="btn ghost win-cta win-spin" onClick={onSpin}>
                Spin prize ({spins})
              </button>
            ) : null}
          </div>
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
