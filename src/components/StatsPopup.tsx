import { useEffect } from 'react'
import './StatsPopup.css'

export interface StatsPopupProps {
  streak: number
  bestStreak: number
  wins?: number
  bestDailyMs?: number | null
  formatMs?: (ms: number) => string
  onClose: () => void
}

/**
 * 9.32-a: small props-driven stats popup — current/best streak, plus total
 * wins and best daily time when the parent passes them. Reuses the shared
 * `.overlay` / `.overlay-card` modal classes; dismiss via X, backdrop tap, or
 * Escape. Phone-first: fixed overlay, no layout shift on open/close.
 */
export function StatsPopup({ streak, bestStreak, wins, bestDailyMs, formatMs, onClose }: StatsPopupProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const showDaily = bestDailyMs != null && formatMs != null

  return (
    <div className="overlay stats-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Your stats">
      <div className="overlay-card stats-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="stats-close" onClick={onClose} aria-label="Close stats">
          ✕
        </button>
        <h2 className="stats-title">Stats</h2>
        <div className="stats-grid">
          <div className="stats-cell">
            <span className="stats-label">Streak</span>
            <strong className="stats-value" data-stat="streak">
              {streak}
            </strong>
          </div>
          <div className="stats-cell">
            <span className="stats-label">Best streak</span>
            <strong className="stats-value" data-stat="best-streak">
              {bestStreak}
            </strong>
          </div>
          {wins != null ? (
            <div className="stats-cell">
              <span className="stats-label">Wins</span>
              <strong className="stats-value" data-stat="wins">
                {wins}
              </strong>
            </div>
          ) : null}
          {showDaily ? (
            <div className="stats-cell">
              <span className="stats-label">Best daily time</span>
              <strong className="stats-value" data-stat="best-daily">
                {formatMs!(bestDailyMs!)}
              </strong>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
