import { useEffect, useState } from 'react'
import { CloudScoresButton } from './CloudScores'
import { loadPublicScores } from './cloud'
import {
  BOARD_TABS,
  formatBoardTime,
  rankScores,
  sliceBoard,
  type BoardLine,
  type BoardTab,
  type PublicScore,
  type RankedPlayer,
} from '../game/leaderboard'

function isGap(line: BoardLine): line is { gap: true } {
  return 'gap' in line
}

/**
 * Today, this week, and all-time. Built in the browser from public.public_scores.
 * The signed-in player's public name is highlighted. Signed-out players can still read the board.
 */
export function Leaderboard({ you, signedIn }: { you?: string; signedIn: boolean }) {
  const [tab, setTab] = useState<BoardTab>('today')
  const [rows, setRows] = useState<PublicScore[] | null>(null)
  const [failed, setFailed] = useState(false)
  const name = (you ?? '').trim()

  useEffect(() => {
    let cancel = false
    void loadPublicScores().then((next) => {
      if (cancel) return
      if (next === null) setFailed(true)
      else setRows(next)
    })
    return () => {
      cancel = true
    }
  }, [])

  const tabMeta = BOARD_TABS.find((t) => t.id === tab) ?? BOARD_TABS[0]
  const ranked = rows ? rankScores(rows, tab) : []
  const slice = sliceBoard(ranked, signedIn ? name : '')

  return (
    <main className="panel leaderboard-screen scroll-pane" data-testid="leaderboard">
      <h2>Leaderboard</h2>
      <div className="level-tabs lb-tabs" role="tablist" aria-label="Leaderboard">
        {BOARD_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`level-tab ${tab === item.id ? 'on' : ''}`}
            data-testid={`lb-tab-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="sub lb-hint">{tabMeta.hint}</p>
      {!signedIn ? (
        <div className="lb-signin" data-testid="lb-signin">
          <p>Sign in to get on the board.</p>
          <CloudScoresButton suggestedName={name} />
        </div>
      ) : slice.you ? (
        <p className="lb-you" data-testid="lb-you">
          You're #{slice.you.rank}
        </p>
      ) : rows && !failed ? (
        <p className="lb-you is-empty" data-testid="lb-you">
          You're not on this board yet.
        </p>
      ) : null}
      {rows === null && !failed ? (
        <p className="sub">Loading scores…</p>
      ) : failed ? (
        <p className="sub">The board will show when you're online.</p>
      ) : ranked.length === 0 ? (
        <p className="sub">No scores on this board yet.</p>
      ) : (
        <ol className="lb">
          {slice.lines.map((line, i) =>
            isGap(line) ? (
              <li key={`gap-${i}`} className="lb-gap" aria-hidden="true">
                · · ·
              </li>
            ) : (
              <Row key={`${line.rank}-${line.name}`} line={line} yours={!!slice.you && line.name === slice.you.name} />
            ),
          )}
        </ol>
      )}
    </main>
  )
}

function Row({ line, yours }: { line: RankedPlayer; yours: boolean }) {
  return (
    <li className={`lb-row${yours ? ' is-you' : ''}`} data-testid={yours ? 'lb-you-row' : undefined}>
      <span className="lb-rank">#{line.rank}</span>
      <span className="lb-name">
        {yours ? <strong className="player-name-mark">{line.name}</strong> : line.name}
        {yours ? <small> you</small> : null}
      </span>
      <span className="lb-meta">
        {line.score.toLocaleString('en-US')} pts · {formatBoardTime(line.timeSeconds)}
      </span>
    </li>
  )
}
