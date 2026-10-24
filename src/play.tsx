import { useEffect, useRef, useState } from 'react'
import { ApiError, api, type Me } from './api'
import { BoardView } from './ui/BoardView'
import { DefenderArt } from './ui/DefenderArt'
import { CHARGE_LABEL, DEFENDERS, MAX_HEARTS, type Ability } from './game/catalog'
import { dailyPuzzle, makePuzzle, type Difficulty } from './game/generate'
import { buddyIndexes, conflicts, cycleCell, emptyBoard, isSolved, ruledOut, type Cell, type Puzzle } from './game/logic'
import { playVoice, sfxError, sfxGiggle, sfxMark, sfxPlace, sfxWin, unlockAudio } from './game/sound'
import { boardFromPuzzleId, boardSteps, throneForBoards, throneProgress, winMap } from './game/thrones'
import { pickUnseen, type UnseenLine } from './game/unseen'
import type { Copy, Lang } from './i18n'
import { go } from './nav'

type Mode = 'daily' | 'free' | 'survival'
type Phase = 'play' | 'unseen' | 'victory' | 'loss' | 'over' | 'hunt' | 'hunt-end'

const GOAL_LINE = {
  en: 'Place one buddy in every row, every column and every colour. Buddies cannot touch, even on a corner. An X marks a square you have ruled out.',
  fr: 'Place un compagnon dans chaque rangée, chaque colonne et chaque couleur. Les compagnons ne se touchent pas, même par un coin. Un X écarte une case.',
}

interface Guest {
  wins: number
  winsByBoard: Record<string, number>
  perfects: number
  charges: Record<string, number>
  bestRun: Record<string, number>
  streak: number
  streakDay: string
}

function loadGuest(): Guest {
  try {
    const raw = JSON.parse(localStorage.getItem('rg.guest') || '') as Guest
    if (raw && typeof raw.wins === 'number') {
      return { ...raw, winsByBoard: winMap(raw) }
    }
  } catch {
    /* ignore */
  }
  return { wins: 0, winsByBoard: {}, perfects: 0, charges: {}, bestRun: {}, streak: 0, streakDay: '' }
}

function saveGuest(guest: Guest) {
  localStorage.setItem('rg.guest', JSON.stringify(guest))
}

export function PlayScreen({
  t,
  lang,
  pc,
  me,
  onMe,
}: {
  t: Copy
  lang: Lang
  pc: boolean
  me: Me | null
  onMe: (me: Me | null) => void
}) {
  const [mode, setMode] = useState<Mode>('daily')
  const [size, setSize] = useState<5 | 6 | 7 | 8>(6)
  const [difficulty, setDifficulty] = useState<Difficulty>(1)
  const [puzzle, setPuzzle] = useState<Puzzle>(() => dailyPuzzle())
  const [cells, setCells] = useState<Cell[]>(() => emptyBoard(6))
  const [hearts, setHearts] = useState(MAX_HEARTS)
  const [run, setRun] = useState(0)
  const [moves, setMoves] = useState(0)
  const [started, setStarted] = useState(() => Date.now())
  const [tick, setTick] = useState(0)
  const [phase, setPhase] = useState<Phase>('play')
  const [line, setLine] = useState<UnseenLine | null>(null)
  const [hurt, setHurt] = useState(false)
  const [used, setUsed] = useState(false)
  const [highlights, setHighlights] = useState<number[]>([])
  const [seconds, setSeconds] = useState(0)
  const [huntTiles, setHuntTiles] = useState<boolean[]>([])
  const [huntOpen, setHuntOpen] = useState<boolean[]>([])
  const [huntTaps, setHuntTaps] = useState(0)
  const [shareNote, setShareNote] = useState('')
  const [guest, setGuest] = useState<Guest>(loadGuest)
  const charges = me?.charges ?? guest.charges
  const boards = me?.winsByBoard ?? guest.winsByBoard
  const playing = boardFromPuzzleId(puzzle.id, puzzle.size)
  const throne = throneForBoards(boards)
  const progress = throneProgress(boards[playing.key] ?? 0, boardSteps(playing.size, playing.difficulty))
  const diffLabel = [t.easy, t.medium, t.hard, t.expert][difficulty]
  const phaseRef = useRef(phase)
  const afterRef = useRef<() => void>(() => undefined)
  phaseRef.current = phase

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (phase !== 'play') return
    const quiet = Date.now() - started > 25000 && moves < 2 && tick > 0 && tick % 28 === 0
    if (!quiet) return
    const picked = pickUnseen('slow', true)
    setLine(picked)
    playVoice(picked.id)
  }, [tick, phase, moves, started])

  useEffect(() => {
    if (!line) return
    const id = window.setTimeout(() => {
      const current = phaseRef.current
      if (current === 'unseen') afterRef.current()
      else if (current === 'hunt-end') {
        setLine(null)
        setPhase('victory')
      } else setLine(null)
    }, 4500)
    return () => window.clearTimeout(id)
  }, [line])

  function boot(nextMode: Mode, nextSize: number, nextDiff: Difficulty, nextHearts: number, nextRun: number) {
    const seed = nextMode === 'daily' ? undefined : `${nextMode}-${nextRun}-${Date.now()}`
    const next = nextMode === 'daily' ? dailyPuzzle() : makePuzzle(nextSize, nextDiff, seed!)
    setPuzzle(next)
    setCells(emptyBoard(next.size))
    setHearts(nextHearts)
    setRun(nextRun)
    setMoves(0)
    setHurt(false)
    setUsed(false)
    setHighlights([])
    setPhase('play')
    setLine(null)
    setStarted(Date.now())
  }

  function finish(won: boolean, board: Cell[] = cells) {
    const secs = Math.max(1, Math.round((Date.now() - started) / 1000))
    setSeconds(secs)
    const slow = secs > 90
    const picked = pickUnseen(won ? 'win' : 'loss', slow)
    setLine(picked)
    playVoice(picked.id)
    setPhase('unseen')
    if (!won) return
    const perfect = !hurt && !used
    if (me) {
      void api<{ me: Me }>('/api/win', {
        size: puzzle.size,
        seconds: secs,
        moves: Math.max(moves, puzzle.size),
        puzzleId: puzzle.id,
        cells: board,
        mode,
        perfect,
        run: run + 1,
        hearts,
      })
        .then((res) => onMe(res.me))
        .catch(() => undefined)
    } else {
      const wonOn = boardFromPuzzleId(puzzle.id, puzzle.size)
      const winsByBoard = { ...guest.winsByBoard, [wonOn.key]: (guest.winsByBoard[wonOn.key] ?? 0) + 1 }
      const next = { ...guest, wins: guest.wins + 1, winsByBoard, perfects: guest.perfects + (perfect ? 1 : 0) }
      if (mode === 'survival') next.bestRun = { ...guest.bestRun, [puzzle.size]: Math.max(guest.bestRun[puzzle.size] ?? 0, run + 1) }
      setGuest(next)
      saveGuest(next)
    }
  }

  function tap(index: number) {
    unlockAudio()
    if (phase !== 'play') return
    const nextState = cycleCell(cells[index])
    const next = cells.slice()
    next[index] = nextState
    if (nextState === 'mark') sfxMark()
    if (nextState === 'buddy') {
      if (conflicts(puzzle, next).size) {
        sfxError()
        setHurt(true)
        const left = hearts - 1
        setHearts(left)
        setMoves((n) => n + 1)
        if (left <= 0) finish(false)
        return
      }
      sfxPlace()
      sfxGiggle()
    }
    setCells(next)
    setMoves((n) => n + 1)
    if (isSolved(puzzle, next)) {
      sfxWin()
      finish(true, next)
    }
  }

  function spend(ability: Ability) {
    const have = charges[ability] ?? 0
    if (have < 1 || phase !== 'play') return
    const nextCharges = { ...charges, [ability]: have - 1 }
    if (me) void api<{ me: Me }>('/api/charge', { ability }).then((res) => onMe(res.me)).catch(() => undefined)
    else {
      const next = { ...guest, charges: nextCharges }
      setGuest(next)
      saveGuest(next)
    }
    setUsed(true)
    if (ability === 'place') {
      const open = puzzle.solution.find((index) => cells[index] !== 'buddy')
      if (open == null) return
      const next = cells.slice()
      next[open] = 'buddy'
      sfxPlace()
      sfxGiggle()
      setCells(next)
      if (isSolved(puzzle, next)) {
        sfxWin()
        finish(true, next)
      }
    } else if (ability === 'heart') {
      setHearts((n) => (n < 2 ? 2 : n))
    } else if (ability === 'rule') {
      const marks = ruledOut(puzzle, cells).slice(0, 12)
      const next = cells.slice()
      marks.forEach((index) => {
        if (next[index] === 'empty') next[index] = 'mark'
      })
      sfxMark()
      setCells(next)
    } else if (ability === 'light' || ability === 'light6') {
      const buddies = new Set(buddyIndexes(cells).map((index) => Math.floor(index / puzzle.size)))
      const row = Array.from({ length: puzzle.size }, (_, r) => r).find((r) => !buddies.has(r)) ?? 0
      const cellsInRow = Array.from({ length: puzzle.size }, (_, c) => row * puzzle.size + c)
      setHighlights(ability === 'light' ? cellsInRow : ruledOut(puzzle, cells).slice(0, 6))
    }
    if (!me) return
    me.charges = nextCharges
    onMe({ ...me, charges: nextCharges })
  }

  function afterUnseen() {
    setLine(null)
    if (hearts <= 0 && !isSolved(puzzle, cells)) setPhase(mode === 'survival' ? 'over' : 'loss')
    else setPhase('victory')
  }
  afterRef.current = afterUnseen

  function nextBoard() {
    if (mode === 'survival') {
      boot('survival', size, difficulty, hearts, run + 1)
      return
    }
    if (mode === 'daily') boot('daily', 6, 1, MAX_HEARTS, 0)
    else boot('free', size, difficulty, MAX_HEARTS, 0)
  }

  async function shareBoard(copyOnly = false) {
    try {
      const res = await api<{ code: string; path: string }>('/api/challenge', { puzzle, seconds })
      const url = `${location.origin}${res.path}`
      setShareNote('')
      if (copyOnly) {
        await navigator.clipboard.writeText(url)
        return
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: t.brand, url })
          return
        } catch {
          /* dismissed */
        }
      }
      await navigator.clipboard.writeText(url)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      setShareNote(code === 'schema' ? t.errorSchema : t.errorSupabase)
    }
  }

  const modeName = mode === 'daily' ? t.daily : mode === 'free' ? t.freePlay : t.survival
  const boardBlock = (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div className="spread">
        <button className="logo" type="button" onClick={() => go('/')}>{t.brand}</button>
        <span className="chip">{modeName}</span>
        <span className="chip">{'♥'.repeat(Math.max(0, hearts))}</span>
        <button className="chip" type="button" onClick={() => go('/thrones')}>{throne ? (lang === 'fr' ? throne.nameFr : throne.name) : t.throne}</button>
        {pc ? null : <button className="chip" type="button" onClick={() => go('/leaderboard')}>{t.solo}</button>}
      </div>
      {mode === 'survival' ? (
        <div className="spread muted">
          <span>{t.boardsCleared} {run}</span>
          <span>{t.bestRun} {me?.bestRun?.[String(size)] ?? guest.bestRun[size] ?? 0}</span>
          <span>{progress.left} → {lang === 'fr' ? progress.next.nameFr : progress.next.name}</span>
        </div>
      ) : null}
      {!pc && line ? <UnseenCutout line={line} /> : null}
      <div className="board-slot">
        <BoardView puzzle={puzzle} cells={cells} highlights={highlights} onTap={tap} />
      </div>
      <div className="defs">
        {DEFENDERS.map((defender) => (
          <button key={defender.id} className="btn" type="button" onClick={() => spend(defender.ability)}>
            <DefenderArt id={defender.id} size={28} />
            {defender.name}
            <br />
            {CHARGE_LABEL[defender.ability][lang]} · {charges[defender.ability] ?? 0}
          </button>
        ))}
      </div>
      <div className={mode === 'daily' ? 'stack' : 'grid2'}>
        <div className="tabs">
          {(['daily', 'free', 'survival'] as Mode[]).map((item) => (
            <button
              key={item}
              className={`tab ${mode === item ? 'on' : ''}`}
              type="button"
              onClick={() => {
                setMode(item)
                const nextSize = item === 'daily' ? 6 : size
                const nextDiff = item === 'daily' ? 1 : difficulty
                boot(item, nextSize, nextDiff as Difficulty, item === 'survival' ? hearts : MAX_HEARTS, item === 'survival' ? run : 0)
              }}
            >
              {item === 'daily' ? t.daily : item === 'free' ? t.freePlay : t.survival}
            </button>
          ))}
        </div>
        {mode !== 'daily' ? (
          <div className="tabs">
            <button className="tab on" type="button" onClick={() => {
              const order = [5, 6, 7, 8] as const
              const next = order[(order.indexOf(size) + 1) % order.length]
              setSize(next)
              boot(mode, next, difficulty, mode === 'survival' ? hearts : MAX_HEARTS, run)
            }}>{size}×{size}</button>
            <button className="tab" type="button" onClick={() => {
              const next = ((difficulty + 1) % 4) as Difficulty
              setDifficulty(next)
              boot(mode, size, next, mode === 'survival' ? hearts : MAX_HEARTS, run)
            }}>{diffLabel}</button>
          </div>
        ) : null}
      </div>
    </div>
  )

  const result = phase === 'play' || phase === 'unseen' ? null : (
      <div className="card stack result-card">
        {phase === 'victory' ? (
          <>
            <h2>{t.victory}</h2>
            <p className="muted">{formatTime(seconds)} · {moves}</p>
            <button className="btn gold full" type="button" onClick={() => void shareBoard()}>{t.share}</button>
            {shareNote ? <p className="muted">{shareNote}</p> : null}
            {pc ? <button className="btn full" type="button" onClick={() => void shareBoard(true)}>{t.copyLink}</button> : null}
            <div className="grid2">
              <button className="btn" type="button" onClick={nextBoard}>{t.nextBoard}</button>
              <button className="btn" type="button" onClick={() => void shareBoard()}>{t.challenge}</button>
              <button className="btn" type="button" onClick={() => boot(mode, size, difficulty, mode === 'survival' ? hearts : MAX_HEARTS, run)}>{t.playAgain}</button>
              <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
            </div>
            {(me?.perfects ?? guest.perfects) >= 3 ? (
              <button className="btn" type="button" onClick={() => {
                const flags = [true, true, true, false, false, false, false, false]
                for (let i = flags.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1))
                  const swap = flags[i]
                  flags[i] = flags[j]
                  flags[j] = swap
                }
                setHuntTiles(flags)
                setHuntOpen(flags.map(() => false))
                setHuntTaps(0)
                setPhase('hunt')
              }}>{t.hunt}</button>
            ) : null}
          </>
        ) : null}
        {phase === 'loss' ? (
          <>
            <h2>{t.outOfHearts}</h2>
            <div className="grid2">
              {(charges.heart ?? 0) > 0 ? (
                <button className="btn gold" type="button" onClick={() => {
                  const nextCharges = { ...charges, heart: (charges.heart ?? 1) - 1 }
                  if (me) {
                    onMe({ ...me, charges: nextCharges })
                    void api<{ me: Me }>('/api/charge', { ability: 'heart' }).then((res) => onMe(res.me)).catch(() => undefined)
                  } else {
                    const next = { ...guest, charges: nextCharges }
                    setGuest(next)
                    saveGuest(next)
                  }
                  setHearts(2)
                  setPhase('play')
                }}>{t.keepGoing}</button>
              ) : null}
              <button className="btn gold" type="button" onClick={() => boot(mode, size, difficulty, MAX_HEARTS, 0)}>{t.tryAgain}</button>
              <button className="btn" type="button" onClick={() => void shareBoard()}>{t.challenge}</button>
              <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
            </div>
          </>
        ) : null}
        {phase === 'over' ? (
          <>
            <h2>{t.runOver}</h2>
            <p className="muted">{t.boardsCleared} {run}</p>
            <div className="grid2">
              <button className="btn gold" type="button" onClick={() => boot('survival', size, difficulty, MAX_HEARTS, 0)}>{t.playAgain}</button>
              <button className="btn" type="button" onClick={() => go('/')}>{t.home}</button>
            </div>
          </>
        ) : null}
        {phase === 'hunt' ? (
          <>
            <h2>{t.hunt}</h2>
            <p className="muted">{t.huntRule}</p>
            <div className="grid2">
              {huntTiles.map((buddy, index) => (
                <button key={index} className="btn" type="button" onClick={() => {
                  if (huntOpen[index] || huntTaps >= 5) return
                  const next = huntOpen.slice()
                  next[index] = true
                  const taps = huntTaps + 1
                  setHuntOpen(next)
                  setHuntTaps(taps)
                  if (buddy) sfxPlace()
                  else sfxMark()
                  const found = huntTiles.filter((flag, tile) => flag && next[tile]).length
                  if (taps >= 5 || found >= 3) {
                    const picked = pickUnseen('hunt', false)
                    setLine(picked)
                    playVoice(picked.id)
                    setPhase('hunt-end')
                  }
                }}>{huntOpen[index] ? (buddy ? '●' : '×') : '·'}</button>
              ))}
            </div>
          </>
        ) : null}
        {phase === 'hunt-end' ? (
          <p>{t.huntFound} {huntTiles.filter((buddy, index) => buddy && huntOpen[index]).length} {t.huntOf}</p>
        ) : null}
      </div>
  )

  const nextThrone = lang === 'fr' ? progress.next.nameFr : progress.next.name

  if (!pc) {
    return (
      <div className={`body play-frame${line ? ' with-unseen' : ''}`}>
        {boardBlock}
        {result}
      </div>
    )
  }

  return (
    <div className="pc-body" style={{ width: '100%' }}>
      <div className="pc-side">
        <div className="card stack">
          <b>{t.goal}</b>
          <p className="muted">{GOAL_LINE[lang]}</p>
          <p>{t.hearts} {'♥'.repeat(Math.max(0, hearts))}</p>
          <p>{t.streak} {me?.streak ?? guest.streak}</p>
          <p className="muted">{modeName} · {diffLabel}</p>
          <p className="muted">{progress.left} → {nextThrone}</p>
        </div>
        <div className="card stack">
          <b>{t.myTeam}</b>
          <button className="btn" type="button" onClick={() => go('/teams')}>{t.teams}</button>
          <button className="btn" type="button" onClick={() => go('/shop')}>{t.shop}</button>
          <button className="btn" type="button" onClick={() => go('/stable')}>{t.stable}</button>
        </div>
      </div>
      <div className="pc-main play-main">{boardBlock}{result}</div>
      <MiniBoard t={t} line={line} />
    </div>
  )
}

function UnseenCutout({ line }: { line: UnseenLine }) {
  const [src, setSrc] = useState('/images/unseen.webp')
  return (
    <div className="unseen-pop" aria-live="polite">
      <span className="bubble"><small>The Unseen</small>{line.text}</span>
      <img
        src={src}
        alt=""
        onError={() => setSrc((current) => (current.endsWith('.webp') ? '/images/unseen.png' : '/unseen.png'))}
      />
    </div>
  )
}

function MiniBoard({ t, line }: { t: Copy; line: UnseenLine | null }) {
  const [rows, setRows] = useState<{ name: string; score: number; hostPet?: string | null }[]>([])
  const [note, setNote] = useState('')
  useEffect(() => {
    void api<{ rows: { name: string; score: number; hostPet?: string | null }[] }>('/api/leaderboard?scope=week').then((res) => setRows(res.rows.slice(0, 8))).catch((err) => {
      setNote(err instanceof ApiError && err.code === 'schema' ? t.errorSchema : t.errorSupabase)
    })
  }, [t])
  return (
    <aside className="pc-side">
      {line ? <UnseenCutout line={line} /> : null}
      <div className="card scroll stack">
        <b>{t.leaderboard}</b>
        <span className="chip">{t.week}</span>
        {note ? <p className="muted">{note}</p> : rows.length === 0 ? <p className="muted">{t.noRank}</p> : rows.map((row, index) => (
          <div key={row.name} className="spread"><span className="row"><DefenderArt id={row.hostPet} size={24} />{index + 1}. {row.name}</span><span>{row.score}</span></div>
        ))}
        <button className="btn" type="button" onClick={() => go('/leaderboard')}>{t.seeAll}</button>
      </div>
    </aside>
  )
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
