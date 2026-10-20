import { useEffect, useState } from 'react'
import { loadLeaderboard, type LeaderboardRow } from './cloud'

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds) || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Public leaderboard. Read-only. The signed-in player's rows are highlighted by their public name. */
export function Leaderboard({ you }: { you?: string }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const mine = (you ?? '').trim().toLowerCase()

  useEffect(() => {
    let cancel = false
    void loadLeaderboard().then((next) => {
      if (!cancel) setRows(next)
    })
    return () => {
      cancel = true
    }
  }, [])

  return (
    <section className="leaderboard" data-testid="leaderboard" aria-label="Leaderboard">
      <h3>Leaderboard</h3>
      {rows === null ? (
        <p className="sub">Loading scores…</p>
      ) : rows.length === 0 ? (
        <p className="sub">Leaderboard will show when you're online.</p>
      ) : (
        <ol className="lb">
          {rows.map((row, i) => {
            const yours = !!mine && row.name.trim().toLowerCase() === mine
            return (
              <li key={`${row.name}-${row.level}-${i}`} className={`lb-row${yours ? ' is-you' : ''}`}>
                <span className="lb-rank">#{row.rank}</span>
                <span className="lb-name">
                  {yours ? <strong className="player-name-mark">{row.name}</strong> : row.name}
                  {yours ? <small> you</small> : null}
                </span>
                <span className="lb-meta">
                  Lv {row.level} · {row.best_score} pts · {clock(row.best_time_seconds)}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
