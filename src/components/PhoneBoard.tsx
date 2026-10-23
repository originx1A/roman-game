import { useEffect, useState } from 'react'
import { CloudScoresButton, useCloud } from '../cloud/CloudScores'
import { loadPlayerBoard, type BoardRow } from '../cloud/cloud'

/** Phone board. One row per signed-in player. Guests can look. The button opens the save card.
 *  Desktop See all passes onClose and shows this list in a centred card. */
export function PhoneBoard({ playerName, onInfo, onClose }: { playerName: string; onInfo?: () => void; onClose?: () => void }) {
  const cloud = useCloud()
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [note, setNote] = useState('')
  const guest = cloud.status !== 'signed-in'

  useEffect(() => {
    let gone = false
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
    return () => {
      gone = true
    }
  }, [cloud.status, cloud.lastSync, cloud.publicName])

  const you = cloud.publicName

  return (
    <main className="phone-board scroll-pane" data-testid="phone-board">
      {onClose ? (
        <div className="phone-board-head">
          <h2>Leaderboard</h2>
          <button type="button" className="board-x" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : (
        <h2>Leaderboard</h2>
      )}
      {rows === null ? null : note ? (
        <p className="cloud-err" role="alert">{note}</p>
      ) : rows.length === 0 ? (
        <p className="phone-board-empty">No scores yet.</p>
      ) : (
        <ol aria-label="Leaderboard">
          {rows.map((row) => (
            <li key={`${row.place}-${row.name}`} className={you && row.name === you ? 'is-you' : undefined}>
              <span className="place">{row.place}</span>
              <span className="name">{row.name}</span>
              <span className="score">{row.score.toLocaleString('en-US')}</span>
            </li>
          ))}
        </ol>
      )}
      {guest ? <CloudScoresButton suggestedName={playerName} cta="Sign in to get on the board" onInfo={onInfo} /> : null}
    </main>
  )
}
