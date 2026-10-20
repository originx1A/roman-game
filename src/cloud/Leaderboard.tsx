import { useEffect, useMemo, useState } from 'react'
import { CloudScoresButton, useCloud } from './CloudScores'
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

const STARS_KEY = 'roman.board.follows.v1'
const SEARCH_CAP = 24

function loadStars(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STARS_KEY) || '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim())
  } catch {
    return []
  }
}

function saveStars(names: string[]) {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(names.slice(0, 80)))
  } catch {
    /* private mode: the star lasts for this visit only */
  }
}

export interface BoardShowcase {
  /** Pieces of the Unseen card collected on this device. */
  pieces: number
  earned: boolean
}

/**
 * Today, this week, all-time, and friends you starred.
 * Built in the browser from public.public_scores. Badge icons and the showcase
 * card are known for the signed-in player only — other rows keep an empty slot.
 */
export function Leaderboard({
  you,
  signedIn,
  badges = [],
  showcase,
  onChallenge,
}: {
  you?: string
  signedIn: boolean
  badges?: string[]
  showcase?: BoardShowcase
  onChallenge?: (name: string) => void
}) {
  const [tab, setTab] = useState<BoardTab>('today')
  const [rows, setRows] = useState<PublicScore[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [stars, setStars] = useState<string[]>(() => loadStars())
  const cloud = useCloud()
  const name = (you ?? '').trim()
  const starred = useMemo(() => new Set(stars.map((n) => n.toLowerCase())), [stars])

  useEffect(() => {
    let cancel = false
    void loadPublicScores().then((next) => {
      if (cancel) return
      if (next === null) setFailed(true)
      else {
        setFailed(false)
        setRows(next)
      }
    })
    return () => {
      cancel = true
    }
  }, [cloud.lastSync])

  function toggleStar(player: string) {
    const key = player.trim().toLowerCase()
    if (!key) return
    setStars((cur) => {
      const has = cur.some((n) => n.toLowerCase() === key)
      const next = has ? cur.filter((n) => n.toLowerCase() !== key) : [...cur, player.trim()]
      saveStars(next)
      return next
    })
  }

  const tabMeta = BOARD_TABS.find((t) => t.id === tab) ?? BOARD_TABS[0]
  const q = query.trim().toLowerCase()
  const ranked = rows ? (tab === 'friends' ? rankScores(rows, 'all') : rankScores(rows, tab)) : []
  const pool = tab === 'friends' ? ranked.filter((r) => starred.has(r.name.toLowerCase())) : ranked
  const matched = q ? pool.filter((r) => r.name.toLowerCase().includes(q)) : pool
  const youRanked = name ? ranked.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null : null
  const slice = q || tab === 'friends'
    ? {
        lines: matched.slice(0, SEARCH_CAP) as BoardLine[],
        you: youRanked && matched.some((r) => r.name.toLowerCase() === name.toLowerCase()) ? youRanked : tab === 'friends' ? null : youRanked && !q ? youRanked : null,
      }
    : sliceBoard(matched, signedIn ? name : '')
  const hidden = matched.length - slice.lines.filter((line) => !isGap(line)).length

  return (
    <main className="panel leaderboard-screen scroll-pane" data-testid="leaderboard">
      <h2>Leaderboard</h2>
      <label className="lb-search">
        <input
          type="search"
          value={query}
          placeholder="Search names"
          aria-label="Search players"
          data-testid="lb-search"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
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
          {tab === 'friends' ? "Star a player and they'll show up here." : name ? `${name} isn't on this board yet.` : "You're not on this board yet."}
        </p>
      ) : null}
      {rows === null && !failed ? (
        <p className="sub">Loading scores…</p>
      ) : failed ? (
        <p className="sub">The board will show when you're online.</p>
      ) : matched.length === 0 ? (
        <p className="sub">{tab === 'friends' ? 'No starred players on the board yet.' : q ? 'No names match that search.' : 'No scores on this board yet.'}</p>
      ) : (
        <ol className="lb">
          {slice.lines.map((line, i) =>
            isGap(line) ? (
              <li key={`gap-${i}`} className="lb-gap" aria-hidden="true">
                · · ·
              </li>
            ) : (
              <Row
                key={`${line.rank}-${line.name}`}
                line={line}
                yours={!!name && line.name.toLowerCase() === name.toLowerCase()}
                badges={badges}
                showcase={showcase}
                starred={starred.has(line.name.toLowerCase())}
                onStar={() => toggleStar(line.name)}
                onChallenge={onChallenge}
              />
            ),
          )}
        </ol>
      )}
      {hidden > 0 ? <p className="sub lb-more">Showing {matched.length - hidden} of {matched.length}. Search to narrow it.</p> : null}
    </main>
  )
}

function Row({
  line,
  yours,
  badges,
  showcase,
  starred,
  onStar,
  onChallenge,
}: {
  line: RankedPlayer
  yours: boolean
  badges: string[]
  showcase?: BoardShowcase
  starred: boolean
  onStar: () => void
  onChallenge?: (name: string) => void
}) {
  const icons = yours ? badges.slice(0, 4) : []
  return (
    <li className={`lb-row${yours ? ' is-you' : ''}`} data-testid={yours ? 'lb-you-row' : 'lb-row'}>
      <button
        type="button"
        className={`lb-star${starred ? ' on' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Stop following ${line.name}` : `Follow ${line.name}`}
        onClick={onStar}
      >
        {starred ? '★' : '☆'}
      </button>
      <span className="lb-rank">#{line.rank}</span>
      <span className="lb-name">
        {yours ? <strong className="player-name-mark">{line.name}</strong> : line.name}
        {yours ? <small> you</small> : null}
        <span className="lb-badges" aria-label={yours && icons.length ? 'Your badges' : undefined}>
          {icons.map((icon, i) => (
            <span key={`${icon}-${i}`} className="lb-badge">{icon}</span>
          ))}
        </span>
        <span
          className={`lb-showcase${yours && showcase?.earned ? ' is-earned' : ''}`}
          title={yours && showcase?.earned ? 'Unseen card' : 'Showcase'}
          aria-hidden="true"
        >
          {yours && showcase && showcase.pieces > 0 ? (
            <img src={showcase.earned ? '/images/unseen-card.webp' : '/images/unseen-card-back.webp'} alt="" />
          ) : null}
        </span>
      </span>
      <span className="lb-meta">
        {line.score.toLocaleString('en-US')} · {formatBoardTime(line.timeSeconds)}
      </span>
      <button type="button" className="lb-challenge" onClick={() => onChallenge?.(line.name)}>
        Challenge
      </button>
    </li>
  )
}
