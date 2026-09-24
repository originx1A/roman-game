import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Board } from './components/Board'
import { HowToPlay } from './components/HowToPlay'
import { PrizeWheel } from './components/PrizeWheel'
import { ShareBar } from './components/ShareBar'
import { SparkCritter, CRITTER_STASH_GOAL, type CritterReward } from './components/SparkCritter'
import { ThemeBackdrop } from './components/ThemeBackdrop'
import { WinScreen } from './components/WinScreen'
import {
  applyHint,
  clearBuddy,
  emptyBoard,
  findHint,
  findMisplacedBuddy,
  isSolved,
  scoreRun,
} from './game/logic'
import { PUZZLES, getPuzzle, puzzlesByDifficulty } from './game/puzzles'
import type { CellState, Challenge, Draft, Profile, Puzzle, Screen } from './game/types'
import { DIFFICULTY_LABEL } from './game/types'
import {
  createChallenge,
  encodeChallengeLink,
  parseChallengeFromHash,
} from './game/challenges'
import { banterFor, sparkProgressBanter, type ConflictKind as BanterConflictKind } from './game/comments'
import type { ConflictKind as BoardConflictKind } from './game/logic'
import { THEMES, themeForPuzzle } from './game/themes'
import {
  ACHIEVEMENTS,
  HINT_COST,
  MAX_LIVES,
  RESCUE_COST,
  REVIVE_COST,
  applyPrize,
  evaluateAchievements,
  unlockIf,
  type Prize,
  type Wallet,
} from './game/rewards'
import {
  addChallenge,
  exportSaveJson,
  getProgress,
  importSaveJson,
  loadChallenges,
  loadDraft,
  loadProfile,
  loadSettings,
  loadWallet,
  recordClear,
  saveDraft,
  saveSettings,
  saveWallet,
  signInWithEmail,
  signOutKeepDevice,
  type Settings,
} from './game/storage'
import {
  playBanterClip,
  setMuted,
  setVoiceEnabled,
  sfxAchievement,
  sfxCoin,
  sfxHeartLose,
  sfxHint,
  sfxLose,
  sfxUndo,
  sfxWhoosh,
  sfxWin,
  unlockAudio,
  warmVoices,
} from './game/sound'
import './App.css'

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

function burstConfetti(root: HTMLElement) {
  const layer = document.createElement('div')
  layer.className = 'confetti-layer'
  root.appendChild(layer)
  const colors = ['#ffd166', '#3dffa8', '#1a6dff', '#ff6b6b', '#fff6cf']
  for (let i = 0; i < 56; i++) {
    const p = document.createElement('span')
    p.className = 'confetti'
    p.style.left = `${Math.random() * 100}%`
    p.style.background = colors[i % colors.length]
    p.style.animationDelay = `${Math.random() * 0.25}s`
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`)
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`)
    layer.appendChild(p)
  }
  window.setTimeout(() => layer.remove(), 1800)
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const [progress, setProgress] = useState(() => getProgress())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [wallet, setWallet] = useState<Wallet>(() => loadWallet())
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [cells, setCells] = useState<CellState[]>([])
  const [history, setHistory] = useState<CellState[][]>([])
  const [future, setFuture] = useState<CellState[][]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintIndex, setHintIndex] = useState<number | null>(null)
  const [giggleIndex, setGiggleIndex] = useState<number | null>(null)
  const [heartPop, setHeartPop] = useState<number | null>(null)
  const [, setHintText] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [defeated, setDefeated] = useState(false)
  const [lives, setLives] = useState(MAX_LIVES)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [winSaying, setWinSaying] = useState('')
  const [toast, setToast] = useState('')
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [, setChallenges] = useState(() => loadChallenges())
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('Roman')
  const [challengeEmail, setChallengeEmail] = useState('')
  const [challengeMsg, setChallengeMsg] = useState('Can you beat Roman on this board?')
  const [shareLink, setShareLink] = useState('')
  const [showWheel, setShowWheel] = useState(false)
  const [awaitingComeback, setAwaitingComeback] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef<number | null>(null)
  const recordedRef = useRef(false)

  const byDiff = useMemo(() => puzzlesByDifficulty(), [])
  const draft = loadDraft<Draft>()
  const draftPuzzle = draft ? getPuzzle(draft.puzzleId) : undefined
  const playUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'https://roman-game-pebble.netlify.app'

  useEffect(() => {
    warmVoices()
    setMuted(!settings.sound)
    setVoiceEnabled(settings.voice)
  }, [settings.sound, settings.voice])

  useEffect(() => {
    document.documentElement.dataset.motion = settings.reduceMotion ? 'reduce' : 'ok'
  }, [settings.reduceMotion])

  useEffect(() => {
    // Only strip Netlify badge chrome on Netlify hosts (not needed on GitHub Pages)
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    if (!host.includes('netlify')) return
    const kill = () => {
      document.querySelectorAll('a, iframe, div, span, button').forEach((el) => {
        const node = el as HTMLElement
        const href = (node.getAttribute('href') || '').toLowerCase()
        const text = (node.textContent || '').toLowerCase()
        const id = (node.id || '').toLowerCase()
        const cls = (node.className || '').toString().toLowerCase()
        const hit =
          href.includes('netlify') ||
          id.includes('netlify') ||
          cls.includes('netlify') ||
          (text.includes('powered by netlify') && text.length < 40)
        if (!hit) return
        // Don't hide our own UI roots
        if (node.closest('#root')) return
        node.style.setProperty('display', 'none', 'important')
        node.style.setProperty('visibility', 'hidden', 'important')
        node.style.setProperty('pointer-events', 'none', 'important')
        node.setAttribute('aria-hidden', 'true')
      })
    }
    kill()
    const obs = new MutationObserver(kill)
    obs.observe(document.documentElement, { childList: true, subtree: true })
    const t = window.setInterval(kill, 800)
    return () => {
      obs.disconnect()
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    const parsed = parseChallengeFromHash(window.location.hash)
    if (parsed) {
      const full: Challenge = { ...parsed, createdAt: new Date().toISOString() }
      setIncoming(full)
      addChallenge(full)
      setChallenges(loadChallenges())
      setScreen('challenge')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current)
      return
    }
    tickRef.current = window.setInterval(() => setElapsedMs((e) => e + 250), 250)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [running])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  /** Toast + one voice at a time (coach / Roman). Buddy giggle is separate via Board. */
  function pushBanter(
    event: Parameters<typeof banterFor>[0],
    conflict?: BanterConflictKind,
    opts?: { skipToast?: boolean },
  ): ReturnType<typeof banterFor> {
    const line = banterFor(event, conflict)
    if (line.silent && !line.giggle) return line
    if (line.text && !opts?.skipToast) showToast(line.text)
    // place-good: Board already plays buddy giggle — don't speak here
    if (line.giggle || !line.speak || !line.clip) return line
    playBanterClip(line.clip, line.voiceMood, line.text)
    return line
  }

  function persistWallet(next: Wallet) {
    setWallet(next)
    saveWallet(next)
  }

  function startPuzzle(p: Puzzle, resume = false) {
    unlockAudio()
    sfxWhoosh()
    const themeId = p.theme ?? themeForPuzzle(p.id, p.difficulty)
    setPuzzle({ ...p, theme: themeId })
    recordedRef.current = false
    setCelebrate(false)
    setDefeated(false)
    setShowWheel(false)
    setLastScore(null)
    setWinSaying('')
    setHintIndex(null)
    setHintText('')
    setFuture([])
    setLives(MAX_LIVES)
    // Quiet start — no theme blob/voice; board stays fully visible

    if (resume) {
      const d = loadDraft<Draft>()
      if (d && d.puzzleId === p.id) {
        setCells(d.cells as CellState[])
        setElapsedMs(d.elapsedMs)
        setHintsUsed(d.hintsUsed)
        setHistory([])
        setRunning(true)
        setScreen('play')
        return
      }
    }

    const board = emptyBoard(p.size)
    setCells(board)
    setHistory([])
    setElapsedMs(0)
    setHintsUsed(0)
    setRunning(true)
    setScreen('play')
    saveDraft({
      puzzleId: p.id,
      cells: board,
      elapsedMs: 0,
      hintsUsed: 0,
      startedAt: new Date().toISOString(),
    })
  }

  function onBoardChange(
    next: CellState[],
    meta: {
      kind: CellState
      conflict: boolean
      index: number
      conflictKind?: BoardConflictKind | null
    },
  ) {
    setHistory((h) => [...h, cells])
    setFuture([])
    setCells(next)

    if (meta.kind === 'mark') {
      // X marks: Board already played sfxMark — never banter/voice
    } else if (meta.kind === 'stone' && meta.conflict) {
      const kind: BanterConflictKind = meta.conflictKind ?? 'generic'
      pushBanter('place-bad', kind)
      let nextLives = lives
      let w = { ...wallet, totalMistakes: wallet.totalMistakes + 1 }
      if (w.shields > 0) {
        w = { ...w, shields: w.shields - 1 }
        showToast('Shield blocked a mistake!')
        sfxCoin()
      } else {
        const lostSlot = Math.max(0, lives - 1)
        setHeartPop(lostSlot)
        sfxHeartLose()
        window.setTimeout(() => setHeartPop(null), 700)
        nextLives = lives - 1
        setLives(nextLives)
      }
      persistWallet(w)
      if (nextLives <= 0) {
        setDefeated(true)
        setRunning(false)
        saveDraft(null)
        sfxLose()
        pushBanter('lose')
        setAwaitingComeback(true)
      }
    } else if (meta.kind === 'stone') {
      pushBanter('place-good')
      setGiggleIndex(meta.index)
      window.setTimeout(() => setGiggleIndex((g) => (g === meta.index ? null : g)), 900)
    }

    if (puzzle) {
      saveDraft({
        puzzleId: puzzle.id,
        cells: next,
        elapsedMs,
        hintsUsed,
        startedAt: new Date().toISOString(),
      })
    }

    if (puzzle && isSolved(puzzle, next) && !recordedRef.current) {
      recordedRef.current = true
      setRunning(false)
      setCelebrate(true)
      sfxWin()
      const winLine = pushBanter('win', undefined, { skipToast: true })
      setWinSaying(winLine?.text || 'Roman says: Veni, vidi, vici!')
      const perfect = hintsUsed === 0
      const score = scoreRun({
        size: puzzle.size,
        elapsedMs,
        hintsUsed,
        perfect,
      })
      setLastScore(score)
      const prog = recordClear({
        puzzleId: puzzle.id,
        elapsedMs,
        score,
        hintsUsed,
      })
      setProgress(prog)
      setProfile(loadProfile())
      saveDraft(null)

      let w: Wallet = {
        ...wallet,
        coins: wallet.coins + Math.max(20, Math.floor(score / 8)),
        totalWins: wallet.totalWins + 1,
        perfectWins: wallet.perfectWins + (perfect ? 1 : 0),
      }
      if (awaitingComeback) {
        w = unlockIf(w, 'comeback')
        setAwaitingComeback(false)
      }
      const evaled = evaluateAchievements(w, {
        perfect,
        difficulty: puzzle.difficulty,
        justWon: true,
      })
      w = evaled.wallet
      persistWallet(w)
      if (evaled.newly.length) {
        // Let the win Roman punchline finish before achievement voice/toast
        const achievementName = evaled.newly[0]
        window.setTimeout(() => {
          sfxAchievement()
          pushBanter('achievement')
          showToast(`Achievement: ${achievementName}`)
        }, 3400)
      }
      if (shellRef.current) burstConfetti(shellRef.current)
    }
  }

  function undo() {
    if (!history.length || celebrate || defeated) return
    sfxUndo()
    const prev = history[history.length - 1]
    setFuture((f) => [cells, ...f])
    setHistory((h) => h.slice(0, -1))
    setCells(prev)
  }

  function redo() {
    if (!future.length || celebrate || defeated) return
    sfxUndo()
    const [next, ...rest] = future
    setHistory((h) => [...h, cells])
    setFuture(rest)
    setCells(next)
  }

  function onHint() {
    if (!puzzle || celebrate || defeated) return
    const hint = findHint(puzzle, cells)
    if (!hint) {
      showToast('No hint available')
      return
    }
    let w = { ...wallet }
    if (w.freeHints > 0) {
      w = { ...w, freeHints: w.freeHints - 1 }
    } else if (w.coins >= HINT_COST) {
      w = { ...w, coins: w.coins - HINT_COST }
      showToast(`−${HINT_COST} coins`)
    } else {
      showToast(`Need ${HINT_COST} coins or a free hint`)
      return
    }
    persistWallet(w)
    sfxHint()
    pushBanter('hint')
    setHintIndex(hint.index)
    setHintText(hint.explanation)
    setHintsUsed((n) => n + 1)
    onBoardChange(applyHint(cells, hint), {
      kind: hint.kind === 'stone' ? 'stone' : 'mark',
      conflict: false,
      index: hint.index,
    })
  }

  /** Rare rescue: clear a buddy that does not belong (wrong spot / conflict) */
  function onRescue() {
    if (!puzzle || celebrate || defeated) return
    const hit = findMisplacedBuddy(puzzle, cells)
    if (!hit) {
      showToast('No rescue needed — buddies look fine')
      return
    }
    if (wallet.coins < RESCUE_COST) {
      showToast(`Need ${RESCUE_COST} coins for a rescue`)
      return
    }
    persistWallet({ ...wallet, coins: wallet.coins - RESCUE_COST })
    sfxHint()
    pushBanter('hint')
    setHintIndex(hit.index)
    setHintText(hit.explanation)
    showToast(hit.explanation)
    onBoardChange(clearBuddy(cells, hit.index), {
      kind: 'empty',
      conflict: false,
      index: hit.index,
    })
  }

  function resetBoard() {
    if (!puzzle) return
    sfxWhoosh()
    const board = emptyBoard(puzzle.size)
    setCells(board)
    setHistory([])
    setFuture([])
    setElapsedMs(0)
    setHintsUsed(0)
    setCelebrate(false)
    setDefeated(false)
    setShowWheel(false)
    setLastScore(null)
    recordedRef.current = false
    setRunning(true)
    setLives(MAX_LIVES)
    setHintIndex(null)
    setHintText('')
    showToast('Fresh board')
  }

  function revive() {
    if (wallet.coins < REVIVE_COST) {
      showToast(`Need ${REVIVE_COST} coins to revive`)
      return
    }
    const w = { ...wallet, coins: wallet.coins - REVIVE_COST }
    persistWallet(w)
    sfxCoin()
    setLives(MAX_LIVES)
    setDefeated(false)
    setRunning(true)
    showToast('Revived!')
  }

  function consumeSpin(): boolean {
    const current = loadWallet()
    if (current.spins <= 0) {
      showToast('No spins left — catch 5 sparks for one')
      return false
    }
    persistWallet({ ...current, spins: current.spins - 1 })
    return true
  }

  function openPrizeWheel() {
    const current = loadWallet()
    if (current.spins <= 0) {
      showToast('No spins left — catch 5 sparks for one')
      return
    }
    setShowWheel(true)
  }

  /** Apply prize only — spin already consumed when the reel started */
  function handlePrize(prize: Prize) {
    let w = applyPrize(loadWallet(), prize)
    if (prize.id === 'heart_refill') setLives(MAX_LIVES)
    const evaled = evaluateAchievements(w, {
      perfect: false,
      difficulty: puzzle?.difficulty ?? 'easy',
      justWon: false,
    })
    persistWallet(evaled.wallet)
    pushBanter('prize')
    showToast(prize.label)
  }

  function handleSignIn(e: FormEvent) {
    e.preventDefault()
    if (!emailInput.includes('@')) {
      showToast('Enter a valid email')
      return
    }
    const p = signInWithEmail(emailInput, nameInput)
    setProfile(p)
    setProgress(getProgress())
    showToast(`Signed in as ${p.displayName}`)
    unlockAudio()
  }

  function handleCritterCatch(reward: CritterReward) {
    const current = loadWallet()
    const have = (current.critterStash ?? 0) + 1

    // 5th catch across games: earn ONE spin. Do not auto-open the reel.
    if (have >= CRITTER_STASH_GOAL) {
      let w: Wallet = {
        ...current,
        critterStash: 0,
        coins: current.coins + (reward.type === 'coins' ? reward.amount : 25),
        freeHints: current.freeHints + (reward.type === 'hint' ? 1 : 0) + 1,
        shields: current.shields + 1,
        spins: current.spins + 1,
      }
      w = unlockIf(w, 'stash')
      w = unlockIf(w, 'critter')
      persistWallet(w)
      setLives(MAX_LIVES)
      pushBanter('critter-stash')
      showToast('Sparkle mode unlocked! +1 spin — open Rewards to spin')
      return
    }

    let w: Wallet = { ...current, critterStash: have }
    w = unlockIf(w, 'critter')
    if (reward.type === 'coins') w.coins += reward.amount
    else if (reward.type === 'hint') w.freeHints += 1
    else if (reward.type === 'heart') setLives((n) => Math.min(MAX_LIVES, n + 1))
    persistWallet(w)

    const line = sparkProgressBanter(have, CRITTER_STASH_GOAL)
    if (line.text) showToast(line.text)
    if (line.speak && line.clip) playBanterClip(line.clip, line.voiceMood, line.text)
  }

  function handleCreateChallenge() {
    const target = puzzle ?? PUZZLES[0]
    const c = createChallenge({
      puzzleId: target.id,
      fromEmail: profile?.email || 'guest@device.local',
      fromName: profile?.displayName || 'Roman',
      message: challengeMsg,
      toEmail: challengeEmail || undefined,
    })
    addChallenge(c)
    setChallenges(loadChallenges())
    const link = encodeChallengeLink(c)
    setShareLink(link)
    void navigator.clipboard?.writeText(link)
    showToast('Challenge link ready — share below')
  }

  const done = new Set(progress.clears.map((c) => c.puzzleId))

  const hideChrome = screen === 'play' || screen === 'how'

  return (
    <div
      className={`shell fixed-shell ${screen === 'play' ? 'shell-play' : ''} ${hideChrome ? 'shell-immersive' : ''} shell-${screen}`}
      ref={shellRef}
      onPointerDown={unlockAudio}
    >
      <div className="atmosphere" aria-hidden />
      {!hideChrome && (
        <header className="topbar topbar-slim">
          <button
            type="button"
            className="brand"
            onClick={() => {
              setScreen('home')
              sfxWhoosh()
            }}
          >
            <span className="brand-mark" />
            <span className="brand-name">Roman</span>
          </button>
          <nav className="nav">
            <button type="button" className={screen === 'levels' ? 'on' : ''} onClick={() => setScreen('levels')}>
              Play
            </button>
            <button type="button" className={screen === 'rewards' ? 'on' : ''} onClick={() => setScreen('rewards')}>
              Rewards
            </button>
            <button type="button" className={screen === 'challenge' ? 'on' : ''} onClick={() => setScreen('challenge')}>
              Share
            </button>
            <button type="button" className={screen === 'profile' ? 'on' : ''} onClick={() => setScreen('profile')}>
              {profile ? profile.displayName.split(' ')[0] : 'Save'}
            </button>
          </nav>
          <div className="hud-pills">
            <div className="score-pill coin" title="Coins">
              {wallet.coins}
              <span>¢</span>
            </div>
          </div>
        </header>
      )}

      {toast && <div className="toast">{toast}</div>}

      {screen === 'home' && (
        <main className="home scroll-pane">
          <section className="hero">
            <p className="dedication">
              <span className="dedication-star" aria-hidden />
              Made for Roman
            </p>
            <p className="eyebrow">Buddy logic boards</p>
            <h1 className="logo-hero">Roman</h1>
            <p className="lede">
              Drop animated buddies — one per row, column, and region. They hate cuddling (even corners).
            </p>
            <div className="cta-row">
              {draftPuzzle ? (
                <button type="button" className="btn primary" onClick={() => startPuzzle(draftPuzzle, true)}>
                  Resume {draftPuzzle.name}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => startPuzzle(PUZZLES.find((p) => !done.has(p.id)) ?? PUZZLES[0])}
                >
                  Play
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => setScreen('how')}>
                How to play
              </button>
            </div>
          </section>
          <section className="home-strip">
            <div>
              <strong>{progress.clears.length}</strong>
              <span>cleared</span>
            </div>
            <div>
              <strong>{wallet.coins}</strong>
              <span>coins</span>
            </div>
            <div>
              <strong>{wallet.achievements.length}</strong>
              <span>badges</span>
            </div>
          </section>
        </main>
      )}

      {screen === 'how' && (
        <HowToPlay
          onDone={() => setScreen('levels')}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'levels' && (
        <main className="panel levels scroll-pane">
          <h2>Levels</h2>
          <p className="sub">Progress + coins save on this device.</p>
          {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => (
            <section key={diff} className="diff-block">
              <h3>{DIFFICULTY_LABEL[diff]}</h3>
              <div className="level-grid">
                {byDiff[diff].map((p) => {
                  const rec = progress.clears.find((c) => c.puzzleId === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`level-card ${rec ? 'cleared' : ''}`}
                      onClick={() => startPuzzle(p)}
                    >
                      <span className="lv-name">{p.name}</span>
                      <span className="lv-meta">
                        {p.size}×{p.size} · {THEMES[themeForPuzzle(p.id, p.difficulty)].label}
                        {rec ? ` · ${rec.bestScore} pts` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </main>
      )}

      {screen === 'play' && puzzle && (
        <main className={`play play-fixed ${THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].className}`}>
          <ThemeBackdrop themeId={puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)} />
          <div className="play-hud">
            <button type="button" className="hud-back" onClick={() => setScreen('levels')} aria-label="Back">
              ←
            </button>
            <div className="hud-title">
              <strong>{puzzle.name}</strong>
              <span>
                {DIFFICULTY_LABEL[puzzle.difficulty]} · {THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].label}
              </span>
            </div>
            <div className="hud-stats">
              <span className="lives" aria-label={`${lives} lives`}>
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <i
                    key={i}
                    className={['heart', i < lives ? 'on' : '', heartPop === i ? 'pop' : '']
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
              </span>
              <span className="hud-time">{formatMs(elapsedMs)}</span>
              <span className="hud-stash" title="Catch 5 sparks across games for a prize">
                ✨{(wallet.critterStash ?? 0)}/{CRITTER_STASH_GOAL}
              </span>
            </div>
          </div>

          <div className="board-stage">
            <Board
              puzzle={puzzle}
              cells={cells}
              onChange={onBoardChange}
              hintIndex={hintIndex}
              giggleIndex={giggleIndex}
              celebrate={celebrate}
              defeated={defeated}
              disabled={celebrate || defeated}
              themeId={puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)}
            />
          </div>

          <div className="toolbar play-toolbar">
            <button type="button" className="btn tool" onClick={undo} disabled={!history.length || celebrate || defeated}>
              Undo
            </button>
            <button type="button" className="btn tool" onClick={redo} disabled={!future.length || celebrate || defeated}>
              Redo
            </button>
            <button type="button" className="btn tool" onClick={onHint} disabled={celebrate || defeated}>
              Hint{wallet.freeHints > 0 ? ` (${wallet.freeHints})` : ''}
            </button>
            <button
              type="button"
              className="btn tool"
              onClick={onRescue}
              disabled={celebrate || defeated}
              title={`Clear a misplaced buddy · ${RESCUE_COST} coins`}
            >
              Rescue
            </button>
            <button type="button" className="btn tool" onClick={resetBoard}>
              Reset
            </button>
          </div>

          <SparkCritter
            active={!celebrate && !defeated && !showWheel}
            stashCount={wallet.critterStash ?? 0}
            onCatch={handleCritterCatch}
          />

          {celebrate && !showWheel && (
            <WinScreen
              puzzleName={puzzle.name}
              difficultyLabel={DIFFICULTY_LABEL[puzzle.difficulty]}
              themeLabel={THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].label}
              timeLabel={formatMs(elapsedMs)}
              score={lastScore ?? 0}
              hintsUsed={hintsUsed}
              livesLeft={lives}
              maxLives={MAX_LIVES}
              sparkCount={wallet.critterStash ?? 0}
              romanSaying={winSaying || 'Roman says: Veni, vidi, vici!'}
              spins={wallet.spins}
              perfect={hintsUsed === 0}
              onNext={() => {
                const idx = PUZZLES.findIndex((p) => p.id === puzzle.id)
                startPuzzle(PUZZLES[idx + 1] ?? PUZZLES[0])
              }}
              onReplay={resetBoard}
              onLevels={() => setScreen('levels')}
              onHome={() => setScreen('home')}
              onSpin={wallet.spins > 0 ? openPrizeWheel : undefined}
            />
          )}

          {defeated && (
            <div className="lose-banner lose-fx">
              <p>Out of hearts</p>
              <div className="cta-row">
                <button type="button" className="btn primary" onClick={revive}>
                  Revive · {REVIVE_COST} coins
                </button>
                <button type="button" className="btn ghost" onClick={resetBoard}>
                  Try again
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {screen === 'rewards' && (
        <main className="panel scroll-pane">
          <h2>Rewards</h2>
          <p className="sub">Win boards for coins. Catch 5 sparks for a spin. Spend on hints, shields, and revives.</p>
          <div className="wallet-grid">
            <div><strong>{wallet.coins}</strong><span>coins</span></div>
            <div><strong>{wallet.freeHints}</strong><span>free hints</span></div>
            <div><strong>{wallet.shields}</strong><span>shields</span></div>
            <div><strong>{wallet.spins}</strong><span>spins left</span></div>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={wallet.spins <= 0}
            onClick={openPrizeWheel}
          >
            {wallet.spins > 0 ? `Use a spin (${wallet.spins})` : 'Catch 5 sparks to earn a spin'}
          </button>
          <h3 className="ach-title">Achievements</h3>
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = wallet.achievements.includes(a.id)
              return (
                <div key={a.id} className={`ach-card ${unlocked ? 'on' : ''}`}>
                  <span className="ach-icon">{a.icon}</span>
                  <strong>{a.title}</strong>
                  <span>{a.blurb}</span>
                </div>
              )
            })}
          </div>
        </main>
      )}

      {screen === 'profile' && (
        <main className="panel profile scroll-pane">
          <h2>Save & settings</h2>
          {profile ? (
            <div className="profile-card">
              <p className="profile-name">{profile.displayName}</p>
              <p className="profile-email">{profile.email}</p>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  signOutKeepDevice()
                  setProfile(null)
                  setProgress(getProgress())
                }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSignIn}>
              <label>
                Email
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required />
              </label>
              <label>
                Display name
                <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
              </label>
              <button type="submit" className="btn primary">Save with email</button>
            </form>
          )}
          <section className="settings">
            <h3>Settings</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => {
                  const next = { ...settings, sound: e.target.checked }
                  setSettings(next)
                  saveSettings(next)
                  setMuted(!next.sound)
                }}
              />
              Sound effects
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.voice}
                onChange={(e) => {
                  const next = { ...settings, voice: e.target.checked }
                  setSettings(next)
                  saveSettings(next)
                  setVoiceEnabled(next.voice)
                }}
              />
              Voice comments
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => {
                  const next = { ...settings, reduceMotion: e.target.checked }
                  setSettings(next)
                  saveSettings(next)
                }}
              />
              Reduce motion
            </label>
          </section>
          <section className="backup">
            <h3>Backup</h3>
            <div className="cta-row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const blob = new Blob([exportSaveJson()], { type: 'application/json' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'roman-save.json'
                  a.click()
                }}
              >
                Export
              </button>
              <label className="btn ghost file-btn">
                Import
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (importSaveJson(await file.text())) {
                      setProfile(loadProfile())
                      setProgress(getProgress())
                      setSettings(loadSettings())
                      setWallet(loadWallet())
                      setChallenges(loadChallenges())
                      showToast('Imported')
                    }
                  }}
                />
              </label>
            </div>
          </section>
        </main>
      )}

      {screen === 'challenge' && (
        <main className="panel challenge scroll-pane">
          <h2>Share & challenge</h2>
          <p className="sub">SMS, WhatsApp, socials, email, or copy link — not just email.</p>
          <ShareBar
            url={shareLink || playUrl}
            text={challengeMsg}
            onCopied={() => showToast('Copied')}
          />
          {incoming && (
            <div className="incoming">
              <p><strong>{incoming.fromName}</strong> challenged you</p>
              <p>{incoming.message}</p>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const p = getPuzzle(incoming.puzzleId)
                  if (p) startPuzzle(p)
                }}
              >
                Accept
              </button>
            </div>
          )}
          <label>
            Board
            <select
              value={puzzle?.id ?? PUZZLES[0].id}
              onChange={(e) => {
                const p = getPuzzle(e.target.value)
                if (p) setPuzzle(p)
              }}
            >
              {PUZZLES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({DIFFICULTY_LABEL[p.difficulty]})
                </option>
              ))}
            </select>
          </label>
          <label>
            Friend email (optional)
            <input type="email" value={challengeEmail} onChange={(e) => setChallengeEmail(e.target.value)} />
          </label>
          <label>
            Message
            <input type="text" value={challengeMsg} onChange={(e) => setChallengeMsg(e.target.value)} maxLength={120} />
          </label>
          <button type="button" className="btn primary" onClick={handleCreateChallenge}>
            Make challenge link
          </button>
          {shareLink && (
            <div className="share-box">
              <code>{shareLink}</code>
              <ShareBar url={shareLink} text={challengeMsg} onCopied={() => showToast('Copied')} />
            </div>
          )}
        </main>
      )}

      <PrizeWheel
        open={showWheel}
        spinsLeft={wallet.spins}
        onConsumeSpin={consumeSpin}
        onDone={handlePrize}
        onClose={() => setShowWheel(false)}
      />

      <footer className={`foot ${screen === 'play' ? 'foot-hidden' : ''}`}>
        <span>Made for Roman</span>
        <button
          type="button"
          className="mute"
          onClick={() => {
            const next = { ...settings, sound: !settings.sound }
            setSettings(next)
            saveSettings(next)
            setMuted(!next.sound)
          }}
        >
          {settings.sound ? 'Sound on' : 'Sound off'}
        </button>
      </footer>
      {/* Keep clear of Netlify “Powered by” badge */}
      <div className="netlify-safe" aria-hidden />
    </div>
  )
}
