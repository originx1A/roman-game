import { useEffect, useState } from 'react'
import { CloudScoresButton, useCloud } from '../cloud/CloudScores'
import { loadPlayerBoard, type BoardRow } from '../cloud/cloud'

const TOP = 8

/**
 * Compact board for the desktop play column.
 * Reads the public player_board view (each player's best score, ranked by place).
 * Guests can look. Their own row is highlighted, and shown under the top eight when they rank lower.
 */
export function LiveBoard({ playerName, onSeeAll }: { playerName: string; onSeeAll: () => void }) {
  const cloud = useCloud()
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [note, setNote] = useState('')
  const guest = cloud.status !== 'signed-in'
  const you = cloud.publicName

  useEffect(() => {
    let gone = false
    const load = () => {
      void loadPlayerBoard().then((result) => {
        if (gone) return
        if (!result.ok) {
          setRows([])
          setNote(result.error)
          return
        }
        setNote('')
        setRows(result.rows)
      })
    }
    load()
    const id = window.setInterval(load, 20000)
    return () => {
      gone = true
      window.clearInterval(id)
    }
  }, [cloud.status, cloud.lastSync, cloud.publicName])

  const top = (rows ?? []).slice(0, TOP)
  const mine = you && rows ? rows.find((row) => row.name === you) : undefined
  const mineOutside = mine != null && mine.place > TOP

  return (
    <section className="live-board" data-testid="live-board" aria-label="Leaderboard">
      <header>
        <h3>Leaderboard</h3>
        <button type="button" className="live-board-all" onClick={onSeeAll}>
          See all
        </button>
      </header>
      {rows === null ? (
        <p className="live-board-note">Loading…</p>
      ) : note ? (
        <p className="live-board-note" role="alert">{note}</p>
      ) : top.length === 0 ? (
        <p className="live-board-note">No scores yet.</p>
      ) : (
        <ol>
          {top.map((row) => (
            <li key={`${row.place}-${row.name}`} className={you && row.name === you ? 'is-you' : undefined}>
              <span className="place">{row.place}</span>
              <span className="name">{row.name}</span>
              <span className="score">{row.score.toLocaleString('en-US')}</span>
            </li>
          ))}
          {mineOutside ? (
            <li className="is-you is-own">
              <span className="place">{mine.place}</span>
              <span className="name">{mine.name}</span>
              <span className="score">{mine.score.toLocaleString('en-US')}</span>
            </li>
          ) : null}
        </ol>
      )}
      {guest ? <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" /> : null}
      {!guest && rows && !note && !mine ? <p className="live-board-note">You&rsquo;re not on the board yet.</p> : null}
    </section>
  )
}
