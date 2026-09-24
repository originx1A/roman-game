import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Board } from './components/Board'
import { HowToPlay } from './components/HowToPlay'
import { PrizeWheel } from './components/PrizeWheel'
import { ResultOverlay } from './components/ResultOverlay'
import { type ShortfallAction } from './components/ShortfallSheet'
import { ShortfallSheetHost } from './components/ShortfallSheetHost'
import { CoinPackCard } from './components/CoinPackCard'
import './styles/store-layer.css'
import { ShareBar } from './components/ShareBar'
import { SparkCritter, CRITTER_STASH_GOAL, type CritterReward } from './components/SparkCritter'
import { ThemeBackdrop } from './components/ThemeBackdrop'
import {
  applyHint,
  clearBuddy,
  emptyBoard,
  findHint,
  findMisplacedBuddy,
  isSolved,
  scoreRun,
} from './game/logic'
import { PUZZLES, getPuzzle, puzzlesByDifficulty, createFreshPuzzle, nextRandomPuzzle } from './game/puzzles'
import type { CellState, Challenge, DuelResult, Profile, Puzzle, Screen } from './game/types'
import { DIFFICULTY_LABEL } from './game/types'
import {
  boardLabel,
  challengeShareText,
  createChallenge,
  createDuelResult,
  duelShareText,
  duelWinner,
  encodeChallengeLink,
  encodeDuelLink,
  formatShareTime,
  parseChallengeFromHash,
  parseDuelFromHash,
  rankLabel,
} from './game/challenges'
import { publicLinkWithHash, publicPlayUrl } from './game/publicUrl'
import { banterFor, sparkProgressBanter, type ConflictKind as BanterConflictKind } from './game/comments'
import type { ConflictKind as BoardConflictKind } from './game/logic'
import { THEMES, themeForPuzzle } from './game/themes'
import {
  ACHIEVEMENTS,
  BADGES,
  HINT_COST,
  MAX_LIVES,
  RESCUE_COST,
  REVIVE_COST,
  applyPrize,
  badgeRank,
  badgeTitleForShare,
  evaluateAchievements,
  formatBonusPercent,
  grantWinCoins,
  totalBadgePower,
  totalCoinBonusPercent,
  tryUpgradeBadge,
  unlockIf,
  upgradeBadgeCost,
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
import { COIN_PACKS, purchaseCoinPack, restorePurchases, isStoreBuild, subscribeStore, type CoinPackId } from './game/iap'
import { loadWebPacks, type WebPackOffer } from './game/webPacks'
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
  const [winLine, setWinLine] = useState('')
  const [loseLine, setLoseLine] = useState('')
  const [lives, setLives] = useState(MAX_LIVES)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [shortfall, setShortfall] = useState<null | { action: ShortfallAction; need: number; detail?: string }>(null)
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [, setChallenges] = useState(() => loadChallenges())
  const [emailInput, setEmailInput] = useState('')
  const [storePrices, setStorePrices] = useState<Record<string, string>>({})
  const [webPacks, setWebPacks] = useState<WebPackOffer[] | null>(null)
  const [webShop, setWebShop] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [nameInput, setNameInput] = useState('Roman')
  const [challengeEmail, setChallengeEmail] = useState('')
  const [challengeMsg, setChallengeMsg] = useState('Can you beat Roman on this board?')
  const [shareLink, setShareLink] = useState('')
  const [shareText, setShareText] = useState('')
  const [showWheel, setShowWheel] = useState(false)
  const [awaitingComeback, setAwaitingComeback] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [duel, setDuel] = useState<DuelResult | null>(null)
  const [duelLink, setDuelLink] = useState('')
  const shellRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef<number | null>(null)
  const idleRef = useRef<number | null>(null)
  const lastActionRef = useRef(Date.now())
  const recordedRef = useRef(false)

  const byDiff = useMemo(() => puzzlesByDifficulty(), [])
  const draft = loadDraft()
  const draftPuzzle = draft ? getPuzzle(draft.puzzleId) : undefined
  const playUrl = publicPlayUrl()

  useEffect(() => {
    warmVoices()
    setMuted(!settings.sound)
    setVoiceEnabled(settings.voice)
  }, [settings.sound, settings.voice])

  useEffect(() => {
    if (isStoreBuild()) return
    let cancelled = false
    void loadWebPacks()
      .then((packs) => {
        if (cancelled) return
        if (!packs) {
          setWebShop('unavailable')
          setWebPacks(null)
          return
        }
        setWebPacks(packs)
        setWebShop('ready')
      })
      .catch(() => {
        if (!cancelled) {
          setWebShop('unavailable')
          setWebPacks(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isStoreBuild()) return
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get('checkout')
    const sessionId = params.get('session_id')
    const clean = () => {
      const next = window.location.pathname + window.location.hash
      window.history.replaceState(null, '', next)
    }
    if (checkout === 'cancel') {
      showToast('Purchase cancelled. No coins were added.')
      clean()
      return
    }
    if (checkout !== 'success' || !sessionId) return
    let cancelled = false
    void import('./game/webCheckout').then(async (mod) => {
      if (cancelled) return
      if (mod.wasCheckoutRedeemed(sessionId)) {
        showToast('Those coins are already in your wallet.')
        clean()
        return
      }
      const result = await mod.confirmWebCheckout(sessionId)
      if (cancelled) return
      clean()
      if (!result.ok) {
        showToast(result.reason)
        return
      }
      mod.rememberCheckoutRedeemed(sessionId)
      if (result.alreadyRedeemed || result.coins <= 0) {
        showToast('Those coins are already in your wallet.')
        return
      }
      const current = loadWallet()
      persistWallet({ ...current, coins: current.coins + result.coins })
      sfxCoin()
      showToast(`+${result.coins} coins · ${result.label}`)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isStoreBuild()) return
    return subscribeStore((notice) => {
      if (notice.type === 'prices') setStorePrices(notice.prices)
      if (notice.type === 'granted') {
        setWallet(loadWallet())
        sfxCoin()
        showToast(`+${notice.coins} coins · ${notice.label}`)
      }
    })
  }, [])

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
    const duelParsed = parseDuelFromHash(window.location.hash)
    if (duelParsed) {
      setDuel(duelParsed)
      setDuelLink(publicLinkWithHash(window.location.hash))
      setShareText(duelShareText(duelParsed))
      setScreen('duel')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
    const parsed = parseChallengeFromHash(window.location.hash)
    if (parsed) {
      const full: Challenge = { ...parsed, createdAt: new Date().toISOString() }
      setIncoming(full)
      setActiveChallenge(full)
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

  // Roman idle roast — no clues, just roasting long pauses
  useEffect(() => {
    if (!running || celebrate || defeated) {
      if (idleRef.current) window.clearInterval(idleRef.current)
      idleRef.current = null
      return
    }
    lastActionRef.current = Date.now()
    idleRef.current = window.setInterval(() => {
      const quietMs = Date.now() - lastActionRef.current
      // After ~16s of no taps, ~55% chance Roman pokes fun (no hints)
      if (quietMs < 16000) return
      if (Math.random() > 0.55) {
        lastActionRef.current = Date.now() - 8000
        return
      }
      lastActionRef.current = Date.now()
      pushBanter('idle')
    }, 7000)
    return () => {
      if (idleRef.current) window.clearInterval(idleRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, celebrate, defeated])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  /** Toast + one voice at a time (coach / Roman). Buddy giggle is separate via Board. */
  function pushBanter(
    event: Parameters<typeof banterFor>[0],
    conflict?: BanterConflictKind,
  ) {
    const line = banterFor(event, conflict)
    if (line.silent && !line.giggle) return line
    if (line.text) showToast(line.text)
    // place-good: Board already plays buddy giggle — don't speak here
    if (line.giggle || !line.speak || !line.clip) return line
    playBanterClip(line.clip, line.voiceMood, line.text, line.alts)
    return line
  }

  function bumpAction() {
    lastActionRef.current = Date.now()
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
    setWinLine('')
    setLoseLine('')
    setShowWheel(false)
    setLastScore(null)
    setHintIndex(null)
    setHintText('')
    setFuture([])
    setLives(MAX_LIVES)
    // Quiet start — no theme blob/voice; board stays fully visible

    if (resume) {
      const d = loadDraft()
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
    bumpAction()
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
        const lose = pushBanter('lose')
        setLoseLine(lose.text || 'Out of hearts')
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
      const win = pushBanter('win')
      setWinLine(win.text || 'Roman says: nice clear!')
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

      // If this clear answers a scored challenge, build a head-to-head duel link
      if (
        activeChallenge &&
        activeChallenge.puzzleId === puzzle.id &&
        activeChallenge.scoreMs != null &&
        activeChallenge.scorePts != null
      ) {
        const myName = profile?.displayName || 'You'
        const result = createDuelResult({
          code: activeChallenge.code,
          puzzleId: puzzle.id,
          puzzleName: puzzle.name,
          difficulty: DIFFICULTY_LABEL[puzzle.difficulty],
          aName: activeChallenge.fromName,
          aMs: activeChallenge.scoreMs,
          aPts: activeChallenge.scorePts,
          aPower: activeChallenge.badgePower,
          aBonus: activeChallenge.bonusPct,
          bName: myName,
          bMs: elapsedMs,
          bPts: score,
          bPower: totalBadgePower(wallet),
          bBonus: totalCoinBonusPercent(wallet),
        })
        const link = encodeDuelLink(result)
        setDuel(result)
        setDuelLink(link)
        setShareLink(link)
        setShareText(duelShareText(result))
      }

      const baseCoins = Math.max(20, Math.floor(score / 8))
      const paid = grantWinCoins(wallet, baseCoins)
      let w: Wallet = {
        ...paid.wallet,
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
      if (paid.bonusPct > 0) {
        window.setTimeout(() => {
          showToast(`+${paid.gained} coins (+${formatBonusPercent(paid.bonusPct)} badge bonus)`)
        }, 900)
      }
      if (evaled.newly.length) {
        // Let the win Roman punchline finish before badge unlock voice/toast
        const badgeId = evaled.newly[0]
        const badge = BADGES.find((b) => b.id === badgeId)
        window.setTimeout(() => {
          sfxAchievement()
          pushBanter('achievement')
          showToast(`Badge unlocked: ${badge?.title ?? badgeId} · Rank 1`)
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
    bumpAction()
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
      setShortfall({ action: 'hint', need: HINT_COST })
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
    bumpAction()
    const hit = findMisplacedBuddy(puzzle, cells)
    if (!hit) {
      showToast('No rescue needed — buddies look fine')
      return
    }
    if (wallet.coins < RESCUE_COST) {
      setShortfall({ action: 'rescue', need: RESCUE_COST })
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
    setWinLine('')
    setLoseLine('')
    setShowWheel(false)
    setLastScore(null)
    recordedRef.current = false
    setRunning(true)
    setLives(MAX_LIVES)
    setHintIndex(null)
    setHintText('')
    showToast('Fresh board')
    bumpAction()
  }

  function revive() {
    if (wallet.coins < REVIVE_COST) {
      setShortfall({ action: 'revive', need: REVIVE_COST })
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
    if (line.speak && line.clip) playBanterClip(line.clip, line.voiceMood, line.text, line.alts)
  }

  function handleCreateChallenge() {
    const target = puzzle ?? PUZZLES[0]
    const clear = getProgress().clears.find((c) => c.puzzleId === target.id)
    const c = createChallenge({
      puzzleId: target.id,
      puzzleName: target.name,
      difficulty: DIFFICULTY_LABEL[target.difficulty],
      fromEmail: profile?.email || 'guest@device.local',
      fromName: profile?.displayName || 'Roman',
      message: challengeMsg,
      toEmail: challengeEmail || undefined,
      scoreMs: clear?.bestMs,
      scorePts: clear?.bestScore,
      badgePower: totalBadgePower(wallet),
      bonusPct: totalCoinBonusPercent(wallet),
    })
    addChallenge(c)
    setChallenges(loadChallenges())
    const link = encodeChallengeLink(c)
    setShareLink(link)
    setShareText(challengeShareText(c))
    void navigator.clipboard?.writeText(link)
    showToast(
      clear
        ? `Challenge ready · ${target.name} · ${formatShareTime(clear.bestMs)} · ${badgeTitleForShare(wallet)}`
        : 'Challenge link ready — share below',
    )
  }

  /** Share this win as a scored challenge so a friend can beat your time */
  function shareWinAsChallenge() {
    if (!puzzle || lastScore == null) return
    const c = createChallenge({
      puzzleId: puzzle.id,
      puzzleName: puzzle.name,
      difficulty: DIFFICULTY_LABEL[puzzle.difficulty],
      fromEmail: profile?.email || 'guest@device.local',
      fromName: profile?.displayName || 'Roman',
      scoreMs: elapsedMs,
      scorePts: lastScore,
      badgePower: totalBadgePower(wallet),
      bonusPct: totalCoinBonusPercent(wallet),
    })
    addChallenge(c)
    setChallenges(loadChallenges())
    const link = encodeChallengeLink(c)
    setShareLink(link)
    setShareText(challengeShareText(c))
    setIncoming(null)
    setActiveChallenge(null)
    setScreen('challenge')
    void navigator.clipboard?.writeText(link)
    showToast(`Shared ${puzzle.name} · ${formatShareTime(elapsedMs)} · ${badgeTitleForShare(wallet)}`)
  }

  function openDuelShare() {
    if (!duel || !duelLink) return
    setShareLink(duelLink)
    setShareText(duelShareText(duel))
    setScreen('duel')
  }

  function onUpgradeBadge(badgeId: string) {
    const result = tryUpgradeBadge(wallet, badgeId)
    if (!result.ok) {
      const reason = result.reason || ''
      if (reason.startsWith('Need') || (result.cost > 0 && wallet.coins < result.cost)) {
        const def = BADGES.find((b) => b.id === badgeId)
        setShortfall({ action: 'upgrade', need: result.cost, detail: def?.title })
        return
      }
      showToast(reason || 'Cannot upgrade')
      return
    }
    persistWallet(result.wallet)
    sfxCoin()
    const rank = badgeRank(result.wallet, badgeId)
    const def = BADGES.find((b) => b.id === badgeId)
    showToast(`${def?.title ?? badgeId} → Rank ${rank} · +${formatBonusPercent(totalCoinBonusPercent(result.wallet))} coins`)
  }

  async function onBuyCoins(packId: CoinPackId) {
    unlockAudio()
    if (!isStoreBuild()) {
      const { startWebCheckout } = await import('./game/webCheckout')
      const started = await startWebCheckout(packId)
      if (!started.ok) showToast(started.reason)
      return
    }
    const result = await purchaseCoinPack(packId)
    if (!result.ok) {
      showToast(result.reason)
      return
    }
    if (result.credited) setWallet(loadWallet())
    else persistWallet({ ...wallet, coins: wallet.coins + result.coins })
    sfxCoin()
    showToast(`+${result.coins} coins · ${result.pack.label}`)
  }

  async function onRestorePurchases() {
    const result = await restorePurchases()
    if (result.ok) setWallet(loadWallet())
    showToast(result.message)
  }

  const done = new Set(progress.clears.map((c) => c.puzzleId))

  const hideChrome = screen === 'play' || screen === 'how'

  return (
    <div
      className={`shell fixed-shell ${isStoreBuild() ? 'shell-native' : ''} ${screen === 'play' ? 'shell-play' : ''} ${hideChrome ? 'shell-immersive' : ''} shell-${screen}`}
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

      <ShortfallSheetHost
        open={!!shortfall}
        action={shortfall?.action ?? 'hint'}
        need={shortfall?.need ?? 0}
        have={wallet.coins}
        detail={shortfall?.detail}
        onClose={() => setShortfall(null)}
        onPlay={() => {
          setShortfall(null)
          setScreen('levels')
        }}
        onBuyCoins={onBuyCoins}
        webPacks={webPacks}
        purchasesUnavailable={webShop === 'unavailable'}
      />

      {screen === 'home' && (
        <main className="home scroll-pane">
          <section className="hero">
            <p className="eyebrow">Logic puzzle</p>
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
                  onClick={() => {
                    const uncleared = PUZZLES.find((p) => !done.has(p.id))
                    startPuzzle(uncleared ?? createFreshPuzzle('easy'))
                  }}
                >
                  Play
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => setScreen('how')}>
                How to play
              </button>
            </div>
          </section>
          <section className="stat-strip home-strip">
            <div>
              <strong>{progress.clears.length}</strong>
              <span>cleared</span>
            </div>
            <div>
              <strong>{wallet.coins}</strong>
              <span>coins</span>
            </div>
            <div>
              <strong>{totalBadgePower(wallet)}</strong>
              <span>badge power</span>
            </div>
            <div>
              <strong>+{formatBonusPercent(totalCoinBonusPercent(wallet))}</strong>
              <span>win coins</span>
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
          <p className="sub">Classic boards stay here. Tap Random for a brand-new layout every time.</p>
          {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => (
            <section key={diff} className="diff-block">
              <div className="diff-head">
                <h3>
                  {DIFFICULTY_LABEL[diff]}
                  <span className="diff-size">
                    {' '}
                    · {diff === 'easy' ? '5×5' : diff === 'medium' ? '6×6' : diff === 'hard' ? '7×7' : '8×8'}
                  </span>
                </h3>
                <button
                  type="button"
                  className="btn ghost random-btn"
                  onClick={() => {
                    showToast('Shuffling a fresh board…')
                    // Defer so toast paints before heavy generate on expert
                    window.setTimeout(() => {
                      const p = createFreshPuzzle(diff)
                      startPuzzle(p)
                    }, 30)
                  }}
                >
                  Random
                </button>
              </div>
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
                        {rec ? ` · best ${formatMs(rec.bestMs)}` : ''}
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
              {activeChallenge?.scoreMs != null && activeChallenge.scorePts != null ? (
                <span className="hud-rival" title={`${activeChallenge.fromName}'s score to beat`}>
                  ⚔ {activeChallenge.fromName} {formatShareTime(activeChallenge.scoreMs)}
                </span>
              ) : null}
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
              <span className="tool-label">Hint</span>
              <span className="tool-cost">
                {wallet.freeHints > 0 ? `${wallet.freeHints} free` : String(HINT_COST)}
              </span>
            </button>
            <button
              type="button"
              className="btn tool"
              onClick={onRescue}
              disabled={celebrate || defeated}
              title={`Clear a misplaced buddy · ${RESCUE_COST} coins`}
            >
              <span className="tool-label">Rescue</span>
              <span className="tool-cost">{RESCUE_COST}</span>
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
            <ResultOverlay
              kind="win"
              title={formatMs(elapsedMs)}
              subtitle={lastScore != null ? `${lastScore} pts` : undefined}
              romanLine={winLine}
              primaryLabel={
                duel && activeChallenge?.puzzleId === puzzle.id
                  ? 'See both scores'
                  : wallet.spins > 0
                    ? `Spin (${wallet.spins})`
                    : 'Next board'
              }
              onPrimary={() => {
                if (duel && activeChallenge?.puzzleId === puzzle.id) {
                  openDuelShare()
                  return
                }
                if (wallet.spins > 0) openPrizeWheel()
                else startPuzzle(nextRandomPuzzle(puzzle))
              }}
              secondaryLabel={
                duel && activeChallenge?.puzzleId === puzzle.id
                  ? wallet.spins > 0
                    ? `Spin (${wallet.spins})`
                    : 'Next board'
                  : wallet.spins > 0
                    ? 'Next board'
                    : 'Home'
              }
              onSecondary={() => {
                if (duel && activeChallenge?.puzzleId === puzzle.id) {
                  if (wallet.spins > 0) openPrizeWheel()
                  else startPuzzle(nextRandomPuzzle(puzzle))
                  return
                }
                if (wallet.spins > 0) startPuzzle(nextRandomPuzzle(puzzle))
                else setScreen('home')
              }}
              extra={
                <>
                  <button type="button" className="btn ghost result-btn" onClick={shareWinAsChallenge}>
                    Share score &amp; challenge
                  </button>
                  {duel && activeChallenge?.puzzleId === puzzle.id ? (
                    <button type="button" className="btn ghost result-btn" onClick={openDuelShare}>
                      Share head-to-head
                    </button>
                  ) : null}
                </>
              }
            />
          )}

          {defeated && (
            <ResultOverlay
              kind="lose"
              title="Rematch?"
              romanLine={loseLine}
              primaryLabel={`Revive · ${REVIVE_COST}`}
              onPrimary={revive}
              secondaryLabel="Try again"
              onSecondary={resetBoard}
            />
          )}
        </main>
      )}

      {screen === 'rewards' && (
        <main className="panel scroll-pane">
          <h2>Rewards</h2>
          <p className="sub">
            Unlock badges by playing, then spend coins to rank them up forever — each rank boosts coins on every win.
          </p>
          <div className="stat-strip wallet-strip">
            <div><strong>{wallet.coins}</strong><span>coins</span></div>
            <div><strong>{wallet.freeHints}</strong><span>free hints</span></div>
            <div><strong>{wallet.shields}</strong><span>shields</span></div>
            <div><strong>{wallet.spins}</strong><span>spins</span></div>
            <div><strong>{totalBadgePower(wallet)}</strong><span>power</span></div>
            <div><strong>+{formatBonusPercent(totalCoinBonusPercent(wallet))}</strong><span>win bonus</span></div>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={wallet.spins <= 0}
            onClick={openPrizeWheel}
          >
            {wallet.spins > 0 ? `Use a spin (${wallet.spins})` : 'Catch 5 sparks to earn a spin'}
          </button>

          <h3 className="ach-title">Coin shop</h3>
          <p className="sub shop-note">
            {isStoreBuild()
              ? 'Prices come from the App Store / Google Play. Coins spend on hints, rescues, revives, and badge ranks.'
              : webShop === 'unavailable'
                ? 'Purchases are unavailable right now. You can still win coins by playing.'
                : webShop === 'ready'
                  ? 'Prices are in US dollars. Coins are added in this browser after you pay. You can still win coins by playing.'
                  : 'Loading the coin shop.'}
          </p>
          <div className="coin-shop">
            {isStoreBuild()
              ? COIN_PACKS.map((pack) => (
                  <CoinPackCard
                    key={pack.id}
                    pack={pack}
                    onBuy={onBuyCoins}
                    priceText={storePrices[pack.productId]}
                  />
                ))
              : webShop === 'ready' && webPacks
                ? webPacks.map((pack) => (
                    <CoinPackCard
                      key={pack.id}
                      webBuy
                      pack={{
                        id: pack.id,
                        productId: pack.productId,
                        label: pack.label,
                        coins: pack.coins,
                        priceHint: pack.priceLabel,
                      }}
                      priceText={pack.priceLabel}
                      onBuy={onBuyCoins}
                    />
                  ))
                : null}
          </div>
          {isStoreBuild() && (
            <>
              <button type="button" className="btn ghost" onClick={() => void onRestorePurchases()}>
                Restore unfinished purchases
              </button>
              <p className="sub restore-note">
                Coin packs are consumable. A finished purchase is not restored. This only adds a payment
                that was charged but not yet turned into coins.
              </p>
            </>
          )}

          <h3 className="ach-title">Badges · rank up</h3>
          <div className="ach-grid badge-grid">
            {ACHIEVEMENTS.map((a) => {
              const rank = badgeRank(wallet, a.id)
              const unlocked = rank >= 1
              const cost = unlocked ? upgradeBadgeCost(a.id, rank, totalBadgePower(wallet)) : 0
              return (
                <div key={a.id} className={`product-card badge-card ${unlocked ? 'on' : 'is-locked'}`}>
                  <span className="ach-icon">{a.icon}</span>
                  <strong>{a.title}</strong>
                  <span className="badge-rank">{unlocked ? `Rank ${rank}` : 'Locked'}</span>
                  <span className="product-value">
                    {unlocked
                      ? `+${formatBonusPercent(rank * a.bonusPerRank)} coins · next +${a.bonusPerRank}%`
                      : a.blurb}
                  </span>
                  {unlocked ? (
                    <button
                      type="button"
                      className="btn ghost badge-upgrade"
                      onClick={() => onUpgradeBadge(a.id)}
                    >
                      Upgrade · {cost}¢
                    </button>
                  ) : (
                    <span className="badge-locked-hint">Earn by playing</span>
                  )}
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
          <h2>Share &amp; challenge</h2>
          <p className="sub">
            Share your best time. Friends open the link, play the same board, then send a head-to-head score back.
          </p>
          <ShareBar
            url={shareLink || playUrl}
            text={shareText || challengeMsg}
            onCopied={() => showToast('Copied')}
          />
          {incoming && (
            <div className="incoming">
              <p>
                <strong>{incoming.fromName}</strong> challenged you
              </p>
              <p className="incoming-board">{boardLabel(incoming)}</p>
              <p>{incoming.message}</p>
              {incoming.scoreMs != null && incoming.scorePts != null ? (
                <p className="incoming-score">
                  Their score: <strong>{formatShareTime(incoming.scoreMs)}</strong> ·{' '}
                  <strong>{incoming.scorePts} pts</strong>
                  {incoming.badgePower != null ? (
                    <>
                      <br />
                      <span className="incoming-rank">{rankLabel(incoming.badgePower, incoming.bonusPct)}</span>
                    </>
                  ) : null}
                </p>
              ) : incoming.badgePower != null ? (
                <p className="incoming-score">
                  <span className="incoming-rank">{rankLabel(incoming.badgePower, incoming.bonusPct)}</span>
                </p>
              ) : null}
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const p = getPuzzle(incoming.puzzleId)
                  if (p) {
                    setActiveChallenge(incoming)
                    startPuzzle(p)
                  }
                }}
              >
                Accept — beat their score
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
            Make score challenge link
          </button>
          {shareLink && (
            <div className="share-box">
              <code>{shareLink}</code>
              <ShareBar url={shareLink} text={shareText || challengeMsg} onCopied={() => showToast('Copied')} />
            </div>
          )}
        </main>
      )}

      {screen === 'duel' && duel && (
        <main className="panel challenge scroll-pane">
          <h2>Head-to-head</h2>
          <p className="sub">
            {boardLabel(duel)} — both scores on the same board. Share so your friend sees the matchup too.
          </p>
          <p className="duel-board-tag">{boardLabel(duel)}</p>
          <div className="duel-card">
            <div className={`duel-row ${duelWinner(duel) === 'a' ? 'winner' : ''}`}>
              <span className="duel-name">{duel.aName}</span>
              <span className="duel-stats">
                {formatShareTime(duel.aMs)} · {duel.aPts} pts
                {duel.aPower != null ? ` · P${duel.aPower}` : ''}
              </span>
            </div>
            {duel.aPower != null ? (
              <p className="duel-rank-line">{rankLabel(duel.aPower, duel.aBonus)}</p>
            ) : null}
            <p className="duel-vs">vs</p>
            <div className={`duel-row ${duelWinner(duel) === 'b' ? 'winner' : ''}`}>
              <span className="duel-name">{duel.bName}</span>
              <span className="duel-stats">
                {formatShareTime(duel.bMs)} · {duel.bPts} pts
                {duel.bPower != null ? ` · P${duel.bPower}` : ''}
              </span>
            </div>
            {duel.bPower != null ? (
              <p className="duel-rank-line">{rankLabel(duel.bPower, duel.bBonus)}</p>
            ) : null}
            <p className="duel-verdict">
              {duelWinner(duel) === 'tie'
                ? 'It’s a tie!'
                : `${duelWinner(duel) === 'a' ? duel.aName : duel.bName} wins!`}
            </p>
          </div>
          <ShareBar
            url={duelLink || shareLink || playUrl}
            text={shareText || duelShareText(duel)}
            onCopied={() => showToast('Copied')}
          />
          <div className="cta-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const p = getPuzzle(duel.puzzleId)
                if (p) startPuzzle(p)
              }}
            >
              Play this board
            </button>
            <button type="button" className="btn ghost" onClick={() => setScreen('home')}>
              Home
            </button>
          </div>
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
        <span>Roman's Game</span>
        <span className="foot-links">
          <a className="privacy-link" href="./privacy.html">
            Privacy
          </a>
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
        </span>
      </footer>
      {/* Keep clear of Netlify “Powered by” badge */}
      <div className="netlify-safe" aria-hidden />
    </div>
  )
}
