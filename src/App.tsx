import { useTapCount } from './components/useTapCount'
import { OWNER_PATH, OWNER_TAP_WINDOW_MS, OWNER_TAPS } from './game/ownerDoor'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Board } from './components/Board'
import { HowToPlay, HOW_NEW_START } from './components/HowToPlay'
import { PrizeWheel } from './components/PrizeWheel'
import { ResultOverlay } from './components/ResultOverlay'
import { WinScreen, type WinReplay } from './components/WinScreen'
import { type ShortfallAction } from './components/ShortfallSheet'
import { ShortfallSheetHost } from './components/ShortfallSheetHost'
import { CoinPackCard } from './components/CoinPackCard'
import './styles/store-layer.css'
import { ShareBar } from './components/ShareBar'
import { SparkCritter, CRITTER_STASH_GOAL, type CritterReward } from './components/SparkCritter'
import { ThemeBackdrop } from './components/ThemeBackdrop'
import { TapButton } from './components/TapButton'
import { BuddyHunt } from './components/BuddyHunt'
import { PetArt } from './components/PetArt'
import { Stable } from './components/Stable'
import { RemixScreen } from './components/RemixScreen'
import {
  nextRemixSize,
  parseRemixId,
  REMIX_SIZES,
  remixCountdownLabel,
  remixEndsAtMs,
  remixId,
  remixSetNow,
  type RemixSize,
} from './game/remix'
import { buildEndlessInBackground, buildRemixInBackground } from './game/boardBuilder'
import { HomePet } from './components/HomePet'
import {
  activePerk,
  activePet,
  addPetXp,
  applyGift,
  awardStreakCoupon,
  awardTrialClearCoupon,
  buyPet,
  buyBundle,
  type BundleId,
  equip as equipPet,
  expireTrial,
  feedPet,
  grantTreat,
  petCare,
  milestoneAt,
  careInfo,
  type TreatId,
  grantTrial,
  levelInfo,
  normalizeGiftCode,
  petById,
  PETS,
  hasPet,
  petLabel,
  petWinCoins,
  petXp,
  winXp,
  type Gift,
  type PetId,
  type PetState,
} from './game/pets'
import {
  BUDDY_HUNT_PERFECT_WINS,
  applyHuntPrize,
  huntPrize,
  isPerfectWin,
  recordWin,
  showSpinPrize,
  startHunt,
} from './game/buddyHunt'
import { createVoiceGate } from './game/voiceGate'
import { loadParade, paradeDone, paradeLengthMs, paradeWin, saveParade, type ParadeState } from './game/parade'
import { ParadeOverlay, type ParadeBuddy } from './components/ParadeOverlay'
import { makeTreasure, type Treasure } from './game/paradeTreasure'
import {
  canEarnSpin,
  canTreasure,
  hintPrice,
  huntPct,
  ledgerSummary,
  loadLedger,
  payWin,
  rescuePrice,
  rollLedger,
  saveLedger,
  sparksOpen,
  trialMultiplier,
  SPIN_CAPPED_COINS,
  type Ledger,
} from './game/dailyEconomy'
import { dayCoins, dayShort, loadDay, saveDay, startBuddyDay, useDayBoard, type BuddyDay, type DayPerkKind } from './game/buddyDay'
import { BUILD_TAG } from './buildTag'
import { amendMove, createHistory, pushMove, redoMove, restoreHistory, stepsToSave, undoMove } from './game/history'
import {
  applyHint,
  clearBuddy,
  emptyBoard,
  findHint,
  findConflicts,
  findMisplacedBuddy,
  isSolved,
} from './game/logic'
import {
  TRIAL_HEARTS,
  UNDO_COST,
  comboMove,
  comboMult,
  dailyCoins,
  dailyIndex,
  finishDaily,
  formatDelta,
  ghostProgress,
  ghostSplits,
  hasBest,
  liveStreak,
  newCombo,
  notePlay,
  paceDelta,
  recordRun,
  replayCoins,
  NEW_BEST_COINS,
  scoreRunV2,
  scoreShareText,
  startDaily,
  targetsFor,
  torontoDateKey,
  trialTimeLimitMs,
  trialUnlocked,
  type ComboState,
  type MoveKind,
  type RecordsBlob,
  type RunMode,
  type RunResult,
} from './game/replay'
import { PUZZLES, getPuzzle, puzzlesByDifficulty, createFreshPuzzle } from './game/puzzles'
import { pickNextBoard } from './game/nextBoard'
import type { CellState, Challenge, Difficulty, DuelResult, Profile, Puzzle, Screen } from './game/types'
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
  mailtoChallenge,
  parseChallengeFromHash,
  parseDuelFromHash,
  rankLabel,
} from './game/challenges'
import { publicLinkWithHash, publicPlayUrl } from './game/publicUrl'
import {
  banterFor,
  unheardShare,
  heardSummary,
  heardLog,
  eventAllowed,
  sparkProgressBanter,
  tipBanter,
  VOICE_PRIORITY,
  type BoardOutcome,
  type ConflictKind as BanterConflictKind,
} from './game/comments'
import { canTip, missedStarReason, noteMastery, noteShown, TIP_TRIGGERS, type TipId, type TipReason, type TipState } from './game/voiceTips'
import type { ConflictKind as BoardConflictKind } from './game/logic'
import { THEMES, themeForPuzzle } from './game/themes'
import {
  ACHIEVEMENTS,
  BADGES,
  MAX_LIVES,
  MAX_BONUS_HEARTS,
  HEART_PRIZE_FALLBACK_COINS,
  REVIVE_COST,
  BUDDY_TRIAL_FALLBACK_COINS,
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
  cleanPlayerName,
  PLAYER_NAME_MAX,
  loadBuddyMeter,
  loadPets,
  savePets,
  loadRecords,
  loadEndless,
  loadRemixBoards,
  noteEndlessClear,
  rememberGeneratedPuzzle,
  saveRemixBoard,
  type EndlessStats,
  loadTips,
  saveTips,
  recordClear,
  saveRecords,
  saveBuddyMeter,
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
  sfxRecord,
  sfxUndo,
  sfxWhoosh,
  sfxWin,
  resetVoiceQuietClock,
  unlockAudio,
  voiceQuietMs,
  warmVoices,
  cancelVoiceBelow,
  dropWaitingVoice,
  petGiggle,
} from './game/sound'
import { COIN_PACKS, purchaseCoinPack, restorePurchases, isStoreBuild, subscribeStore, type CoinPackId } from './game/iap'
import { loadWebPacks, type WebPackOffer } from './game/webPacks'
import './App.css'

let lastAppHeight = 0

export type LayoutKind = 'upright' | 'wide' | 'phone-sideways'
export type DeviceKind = 'phone' | 'tablet' | 'desktop'

/**
 * Screen class (9.29-a). Phones (touch, short side under 600px) are upright-first: sideways shows a
 * "turn upright" overlay during play. Wide screens (desktop, tablets in landscape) get the three-column
 * play layout. Everything else (tablets in portrait, narrow desktop windows) uses the upright layout.
 */
export function readLayout(): { layout: LayoutKind; device: DeviceKind } {
  if (typeof window === 'undefined') return { layout: 'upright', device: 'desktop' }
  const w = window.innerWidth
  const h = window.innerHeight
  const mq = (q: string) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false)
  const touch = mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'))
  const short = Math.min(w, h)
  const device: DeviceKind = touch ? (short < 600 ? 'phone' : 'tablet') : 'desktop'
  if (device === 'phone') return { layout: w > h ? 'phone-sideways' : 'upright', device }
  const layout: LayoutKind = w >= h * 1.15 && w >= 900 && h >= 480 ? 'wide' : 'upright'
  return { layout, device }
}

function syncAppHeight() {
  if (typeof window === 'undefined') return
  const vv = window.visualViewport
  // A pinch-zoomed visual viewport is not a new screen size: resizing the board to it made the
  // whole play screen jump. Use the layout viewport then, and ignore sub-pixel jitter.
  const zoomed = !!vv && vv.scale > 1.01
  const h = Math.round(zoomed ? window.innerHeight : (vv?.height ?? window.innerHeight))
  if (h <= 0 || Math.abs(h - lastAppHeight) < 2) return
  lastAppHeight = h
  document.documentElement.style.setProperty('--app-height', `${h}px`)
}

function resetPlayViewport() {
  syncAppHeight()
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function freshBadgeIds(before: Wallet, after: Wallet): string[] {
  return BADGES.filter(
    (b) => (before.badgeRanks?.[b.id] ?? 0) < 1 && (after.badgeRanks?.[b.id] ?? 0) >= 1,
  ).map((b) => b.id)
}

function senderEmail(email: string | undefined): string {
  const e = email?.trim() ?? ''
  if (!e || e.endsWith('@device.local')) return ''
  return e
}

const MISSING_BOARD = 'This board isn’t on this device. Ask your friend for a fresh link.'

const catalogBoard = (id: string) => PUZZLES.find((p) => p.id === id)
/** 9.30-i: boards that keep bests, stars and the Trial: the catalog plus Remix boards (stable ids) */
const hasRecords = (id: string) => !!catalogBoard(id) || !!parseRemixId(id)

/** Remix boards already built for a set, by size */
function remixBoardsFromCache(set: number): Partial<Record<RemixSize, Puzzle>> {
  const out: Partial<Record<RemixSize, Puzzle>> = {}
  for (const p of Object.values(loadRemixBoards(set))) {
    const r = parseRemixId(p?.id ?? '')
    if (r && r.set === set && Array.isArray(p.regions) && p.regions.length === r.size * r.size) out[r.size] = p
  }
  return out
}

/** Buddies on the board that don't break a rule (what the ghost pace counts; never peeks at the answer) */
function cleanBuddies(p: Puzzle, board: CellState[]): number {
  if (board.length !== p.size * p.size) return 0
  const conf = findConflicts(p, board).cells
  let n = 0
  board.forEach((c, i) => {
    if (c === 'stone' && !conf.has(i)) n++
  })
  return n
}

function starString(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n))
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${rem.toString().padStart(2, '0')}`
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function burstConfetti(root: HTMLElement, above = false) {
  const layer = document.createElement('div')
  layer.className = above ? 'confetti-layer over-parade' : 'confetti-layer'
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
  const [{ layout }, setLayoutInfo] = useState(() => readLayout())
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const [progress, setProgress] = useState(() => getProgress())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Layout class on <html> (CSS picks upright / wide / sideways-phone from it)
  useEffect(() => {
    const apply = () => {
      const next = readLayout()
      document.documentElement.dataset.layout = next.layout
      document.documentElement.dataset.device = next.device
      setLayoutInfo((cur) => (cur.layout === next.layout && cur.device === next.device ? cur : next))
    }
    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    window.visualViewport?.addEventListener('resize', apply)
    // Installed on a phone: ask to stay upright (Android/Chrome; iOS ignores it, the overlay covers it)
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
      const so = window.screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }
      if (standalone && readLayout().device === 'phone') void so.orientation?.lock?.('portrait')?.catch(() => {})
    } catch {
      /* not supported */
    }
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      window.visualViewport?.removeEventListener('resize', apply)
    }
  }, [])
  const [wallet, setWallet] = useState<Wallet>(() => loadWallet())
  // 9.30-a: buddies (The Stable)
  const [pets, setPets] = useState<PetState>(() => loadPets())
  const [petNow, setPetNow] = useState(() => Date.now())
  const [giftPrefill, setGiftPrefill] = useState<string | undefined>(undefined)
  /** Buddy riding along on the board in progress (fixed at the start of the board) */
  const runPetRef = useRef<PetId | null>(null)
  /** Buddy freebies left on this board (free hints / free rescues) */
  const [petFree, setPetFree] = useState({ hints: 0, rescues: 0 })
  /** 9.30-m: hints and Rescues used on this board (each extra one costs a little more) */
  const [rescuesUsed, setRescuesUsed] = useState(0)
  /** 9.30-m: today's earn counters (wins paid, sparks, spins, hunts). Resets at midnight Toronto. */
  const [econ, setEconState] = useState<Ledger>(() => loadLedger(typeof window === 'undefined' ? null : safeLocalStorage(), torontoDateKey()))
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
  const [hintText, setHintText] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [defeated, setDefeated] = useState(false)
  /** Set the moment a board is won or lost (before any state update lands), cleared for the next
   *  board. Voice lines check it so nothing from the live board speaks after the result. */
  const boardOverRef = useRef<BoardOutcome>(null)
  const [winLine, setWinLine] = useState('')
  const [loseLine, setLoseLine] = useState('')
  const [lives, setLives] = useState(MAX_LIVES)
  /** Hearts this board started with: 3, or 4 when a saved bonus heart was used */
  const [runMaxLives, setRunMaxLives] = useState(MAX_LIVES)
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
  const [challengeMsg, setChallengeMsg] = useState('Can you beat me on this board?')
  const [shareLink, setShareLink] = useState('')
  const [shareText, setShareText] = useState('')
  const [shareChallenge, setShareChallenge] = useState<Challenge | null>(null)
  const [linkBoardError, setLinkBoardError] = useState('')
  const [showWheel, setShowWheel] = useState(false)
  const [buddyMeter, setBuddyMeter] = useState(loadBuddyMeter)
  const [huntJustEarned, setHuntJustEarned] = useState(false)
  // 9.30-k: refresh the "voice lines heard" counter whenever Save & settings opens or is reset
  const [heardTick, setHeardTick] = useState(0)
  // Buddy Parade (9.30-j): a counter of wins; every 5-7 wins the next "Next board" tap shows the parade first
  const paradeRef = useRef<ParadeState>(loadParade(typeof window === 'undefined' ? null : safeLocalStorage()))
  const [parade, setParade] = useState<{
    buddies: ParadeBuddy[]
    ms: number
    go: () => void
    treasure: (Treasure | undefined)[]
    featured: PetId | null
    featuredKind: DayPerkKind
  } | null>(null)
  // Buddy of the day (9.30-l): the featured buddy's perk for 3 boards after a parade
  const dayRef = useRef<BuddyDay>(loadDay(typeof window === 'undefined' ? null : safeLocalStorage()))
  const [dayPerk, setDayPerk] = useState<{ pet: PetId | null; kind: DayPerkKind; board: number } | null>(null)
  const dayPerkRef = useRef(dayPerk)
  dayPerkRef.current = dayPerk
  const [winPerfect, setWinPerfect] = useState(false)
  const [showHunt, setShowHunt] = useState(false)
  /** This attempt had a wrong buddy (even shield-blocked), a hint, a rescue or a revive. */
  const flawedRef = useRef(false)
  const [awaitingComeback, setAwaitingComeback] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [duel, setDuel] = useState<DuelResult | null>(null)
  const [duelLink, setDuelLink] = useState('')
  const shellRef = useRef<HTMLDivElement>(null)
  const tickRef = useRef<number | null>(null)
  const idleRef = useRef<number | null>(null)
  const undoTimesRef = useRef<number[]>([])
  const lastActionRef = useRef(Date.now())
  // ---- Voice tips (9.28-b) ----
  const tipsRef = useRef<TipState>(loadTips())
  const boardTipsRef = useRef<TipId[]>([])
  const lastTipAtRef = useRef(0)
  /** Last real move (the idle roast moves lastActionRef around, so tips keep their own clock). */
  const lastMoveRef = useRef(Date.now())
  /** Longest pause between moves this board (stall tip mastery). */
  const maxGapRef = useRef(0)
  /** Last correct buddy / hint (stuck tip). */
  const lastProgressRef = useRef(Date.now())
  const wrongTimesRef = useRef<number[]>([])
  /** A board waiting for the first-time How to play to finish. */
  const pendingStartRef = useRef<{ p: Puzzle; opts: { mode?: RunMode; daily?: boolean; endless?: boolean } } | null>(null)
  const [howStart, setHowStart] = useState(0)
  const recordedRef = useRef(false)
  /** Latest board plus undo/redo stacks. Updated on every move, not on the next render. */
  const historyRef = useRef(createHistory([] as CellState[]))
  /** Bumped whenever the board is replaced rather than drawn on (Undo, Redo, Reset, new or resumed board). */
  const [boardVersion, setBoardVersion] = useState(0)
  /** The history step the current board stroke recorded; later changes of that stroke amend it. */
  const strokeStepRef = useRef<{ stroke: number; hist: ReturnType<typeof createHistory> } | null>(null)

  // ---- Replay challenge: bests, ghost pace, combo/undo scoring, stars, Trial, Daily ----
  const [records, setRecords] = useState<RecordsBlob>(() => loadRecords(catalogBoard))
  const [mode, setMode] = useState<RunMode>('normal')
  const modeRef = useRef<RunMode>('normal')
  /** Today's date key while this attempt is the scored (first) Daily try */
  const dailyRunRef = useRef<string | null>(null)
  const [dailyTag, setDailyTag] = useState<'' | 'scored' | 'practice'>('')
  const [startSheet, setStartSheet] = useState<Puzzle | null>(null)

  // ---- 9.30-i: Remix boards (a new set of 4 every 3 days at midnight Toronto) + Endless mode ----
  const [clockNow, setClockNow] = useState(() => Date.now())
  const remixSet = remixSetNow(new Date(clockNow))
  const remixMsLeft = remixEndsAtMs(new Date(clockNow)) - clockNow
  const [remixBoards, setRemixBoards] = useState(() => ({ set: remixSet, boards: remixBoardsFromCache(remixSet) }))
  const liveRemix = remixBoards.set === remixSet ? remixBoards.boards : {}
  const [remixBuilding, setRemixBuilding] = useState<RemixSize[]>([])
  const [remixFailed, setRemixFailed] = useState<RemixSize[]>([])
  const remixJobsRef = useRef(new Set<string>())
  const [endless, setEndless] = useState<EndlessStats>(() => loadEndless())
  const [endlessBusy, setEndlessBusy] = useState<Difficulty | null>(null)
  /** Difficulty while this run is an Endless board (Next makes another fresh one) */
  const endlessRef = useRef<Difficulty | null>(null)
  const screenNowRef = useRef<Screen>('home')
  const startPuzzleRef = useRef<(p: Puzzle, resume?: boolean, opts?: { mode?: RunMode; daily?: boolean; endless?: boolean }) => void>(() => {})
  screenNowRef.current = screen
  // The countdown ticks while off the board (every 30 s is plenty for "2d 5h" / "5h 12m")
  useEffect(() => {
    if (screen === 'play') return
    setClockNow(Date.now())
    const t = window.setInterval(() => setClockNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [screen])
  // A new set started (midnight Toronto): switch to its boards
  useEffect(() => {
    if (remixBoards.set === remixSet) return
    setRemixBoards({ set: remixSet, boards: remixBoardsFromCache(remixSet) })
    setRemixBuilding([])
    setRemixFailed([])
  }, [remixSet, remixBoards.set])
  // Opening the Remix screen builds the quick boards (5×5 to 7×7); the 8×8 waits until it's tapped
  useEffect(() => {
    if (screen !== 'remix') return
    for (const size of [5, 6, 7] as const) if (!remixBoardsFromCache(remixSet)[size]) buildRemix(size)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, remixSet])
  const [winReplay, setWinReplay] = useState<WinReplay | null>(null)
  // Player name for share cards (asked once: first share or first finished board)
  const playerName = cleanPlayerName(settings.playerName)
  const [namePrompt, setNamePrompt] = useState<null | { then?: () => void }>(null)
  const [nameDraft, setNameDraft] = useState('')
  const comboRef = useRef<ComboState>(newCombo())
  const undosRef = useRef(0)
  const splitsRef = useRef<number[]>([])

  const byDiff = useMemo(() => puzzlesByDifficulty(), [])
  const draft = loadDraft()
  const draftPuzzle = draft ? getPuzzle(draft.puzzleId) : undefined
  const playUrl = publicPlayUrl()

  useEffect(() => {
    syncAppHeight()
    const onResize = () => syncAppHeight()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('scroll', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('scroll', onResize)
    }
  }, [])

  // Play screen stays still on iPhone: lock the document (no rubber-band, no scroll, no pinch)
  // while a board is up. Only real scrollers inside overlays (win card body, sheets) may pan.
  useEffect(() => {
    if (screen !== 'play') return
    const root = document.documentElement
    root.classList.add('play-locked')
    resetPlayViewport()
    const scrollable = '.win-screen-body, .overlay, .shortfall-overlay, .result-overlay, .scroll-pane'
    const onTouchMove = (e: TouchEvent) => {
      const t = e.target as Element | null
      if (t && t.closest && t.closest(scrollable)) return
      if (e.cancelable) e.preventDefault()
    }
    const noGesture = (e: Event) => e.preventDefault()
    const pinToTop = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('gesturestart', noGesture as EventListener, { passive: false })
    document.addEventListener('gesturechange', noGesture as EventListener, { passive: false })
    window.addEventListener('scroll', pinToTop, { passive: true })
    return () => {
      root.classList.remove('play-locked')
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('gesturestart', noGesture as EventListener)
      document.removeEventListener('gesturechange', noGesture as EventListener)
      window.removeEventListener('scroll', pinToTop)
    }
  }, [screen])

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

  // 9.30-a: trial buddies end after 24h (checked every minute and when the tab comes back)
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setPetNow(now)
      const out = expireTrial(loadPets(), now)
      if (out.expired) {
        persistPets(out.state)
        const p = petById(out.expired)
        if (p) showToast(`${p.name}'s free trial is over. Here's a 25% coupon to keep ${p.name} for good!`)
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 9.30-a: owner gift redeem link (?gift=ROMA-XXXX) opens The Stable with the code filled in
  useEffect(() => {
    if (isStoreBuild()) return
    const params = new URLSearchParams(window.location.search)
    const gift = params.get('gift')
    if (!gift) return
    setGiftPrefill(normalizeGiftCode(gift))
    setScreen('stable')
    params.delete('gift')
    const q = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash)
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
      setLinkBoardError(getPuzzle(duelParsed.puzzleId) ? '' : MISSING_BOARD)
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
      setLinkBoardError(getPuzzle(parsed.puzzleId) ? '' : MISSING_BOARD)
      setScreen('challenge')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // A phone turned sideways during a board: the "turn upright" overlay covers the board and the clock
  // waits (board, hearts, combo and history are untouched).
  // Only while a board is live: the win / lose screens and Buddy Hunt still show sideways
  const rotatePaused = screen === 'play' && layout === 'phone-sideways' && !celebrate && !defeated
  const rotatePausedRef = useRef(false)
  useEffect(() => {
    const was = rotatePausedRef.current
    rotatePausedRef.current = rotatePaused
    if (was && !rotatePaused) {
      // back upright: the pause doesn't count as stalling
      const now = Date.now()
      lastActionRef.current = now
      lastMoveRef.current = now
      lastProgressRef.current = now
    }
  }, [rotatePaused])

  useEffect(() => {
    if (!running || rotatePaused) {
      if (tickRef.current) window.clearInterval(tickRef.current)
      return
    }
    tickRef.current = window.setInterval(() => setElapsedMs((e) => e + 250), 250)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [running, rotatePaused])

  // PC keyboard shortcuts on a live board: Z undo, Y redo, H hint (plus Ctrl/Cmd+Z, Ctrl+Y, Ctrl+Shift+Z)
  const keysRef = useRef<{ undo: () => void; redo: () => void; hint: () => void }>({ undo: () => {}, redo: () => {}, hint: () => {} })
  useEffect(() => {
    if (screen !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.altKey || e.repeat) return
      if (document.querySelector('.start-sheet, .win-screen, .buddy-hunt, .prize-overlay, .shortfall-overlay, .result-overlay, .rotate-prompt.is-on')) return
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      let act: 'undo' | 'redo' | 'hint' | null = null
      if (k === 'z' && !e.shiftKey) act = 'undo'
      else if ((k === 'z' && e.shiftKey && mod) || k === 'y') act = 'redo'
      else if (k === 'h' && !mod) act = 'hint'
      if (!act) return
      e.preventDefault()
      keysRef.current[act]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen])

  // A new board (or a comeback after a loss) is live again: its voice lines may speak
  useEffect(() => {
    if (!celebrate && !defeated) boardOverRef.current = null
  }, [celebrate, defeated])

  // Roman's Trial: the clock counts down; at zero the board is lost
  useEffect(() => {
    if (mode !== 'trial' || !running || !puzzle || celebrate || defeated || boardOverRef.current) return
    if (elapsedMs < trialTimeLimitMs(targetsFor(puzzle))) return
    boardOverRef.current = 'lost'
    cancelVoiceBelow(VOICE_PRIORITY.lose)
    setRunning(false)
    setDefeated(true)
    saveDraft(null)
    sfxLose()
    pushBanter('time-up')
    setLoseLine("Time's up! Roman's Trial wins this round.")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, mode, running, celebrate, defeated])

  // Roman idle roast — no clues, just roasting long pauses
  useEffect(() => {
    if (!running || celebrate || defeated) {
      if (idleRef.current) window.clearInterval(idleRef.current)
      idleRef.current = null
      return
    }
    lastActionRef.current = Date.now()
    idleRef.current = window.setInterval(() => {
      // Phone turned sideways: the game is paused, so the quiet clock is too
      if (rotatePausedRef.current) {
        lastActionRef.current = Date.now()
        return
      }
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

  // Voice tips: stalling (no move for a while) and seeming stuck (no progress) — see voiceTips.ts
  useEffect(() => {
    if (!running || celebrate || defeated) return
    const start = Date.now()
    lastMoveRef.current = Math.max(lastMoveRef.current, start)
    lastProgressRef.current = Math.max(lastProgressRef.current, start)
    const id = window.setInterval(() => {
      if (rotatePausedRef.current) return
      const now = Date.now()
      if (now - lastMoveRef.current >= TIP_TRIGGERS.stallMs && fireTip('stall')) return
      if (now - lastProgressRef.current >= TIP_TRIGGERS.stuckMs && fireTip('stuck')) lastProgressRef.current = now
    }, 3000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, celebrate, defeated])

  // Old-timer aside: if nobody has held the voice channel for a while, he drops a random remark.
  useEffect(() => {
    if (!running || celebrate || defeated) return
    resetVoiceQuietClock()
    let cancelled = false
    let targetQuiet = 40_000 + Math.random() * 50_000
    const arm = (ms: number) => {
      window.setTimeout(() => {
        if (cancelled) return
        if (rotatePausedRef.current) {
          resetVoiceQuietClock()
          arm(2000)
          return
        }
        const quiet = voiceQuietMs()
        if (quiet == null) {
          arm(1500)
          return
        }
        if (quiet < targetQuiet) {
          arm(Math.max(500, Math.min(2000, targetQuiet - quiet)))
          return
        }
        const line = pushBanter('aside')
        const spoke = Boolean(line.speak && line.clip)
        // A cooldown miss waits a few more seconds. A real remark rolls a fresh 40–90s gap.
        targetQuiet = spoke ? 40_000 + Math.random() * 50_000 : quiet + 4000
        arm(spoke ? 1500 : 2000)
      }, ms)
    }
    arm(1500)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, celebrate, defeated])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  /** Toast + one voice at a time (coach / Roman). Buddy giggle is separate via Board. */
  const voiceGateRef = useRef(createVoiceGate())
  const heardInfo = useMemo(() => heardSummary(), [heardTick, screen]) // eslint-disable-line react-hooks/exhaustive-deps
  function pushBanter(
    event: Parameters<typeof banterFor>[0],
    conflict?: BanterConflictKind,
  ) {
    // Wrong spot guard: once the board is won only win lines play, once lost only lose lines
    if (!eventAllowed(event, boardOverRef.current)) return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true } as ReturnType<typeof banterFor>
    // 9.30-j: busy moments (wrong moves, idle, hints, undo) speak less often; a skipped moment draws no line
    if (!voiceGateRef.current.allow(event, Date.now(), unheardShare(event))) return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true } as ReturnType<typeof banterFor>
    const line = banterFor(event, conflict)
    if (line.silent && !line.giggle) return line
    if (line.text) showToast(line.text)
    // place-good: Board already plays buddy giggle — don't speak here
    if (line.giggle || !line.speak || !line.clip) return line
    playBanterClip(line.clip, line.voiceMood, line.alts, line.priority, line.waitMs)
    return line
  }

  function bumpAction() {
    const now = Date.now()
    lastActionRef.current = now
    maxGapRef.current = Math.max(maxGapRef.current, now - lastMoveRef.current)
    lastMoveRef.current = now
  }

  function persistTips(t: TipState) {
    tipsRef.current = t
    saveTips(t)
  }

  function tipMastery(id: TipId) {
    try {
      persistTips(noteMastery(tipsRef.current, id))
    } catch {
      /* tips are extras */
    }
  }

  /**
   * Play a voice tip if it is on, not retired, past its cooldowns and per-board caps, and the voice
   * channel is free (or the tip waits its turn). Silent tips (no recorded line yet) don't count.
   */
  function fireTip(id: TipId, reason?: TipReason, opts: { needQuiet?: boolean; quietMs?: number } = {}): boolean {
    try {
      const now = Date.now()
      const st = settingsRef.current
      const gate = {
        now,
        enabled: st.voiceTips !== false && st.voice !== false && st.sound !== false,
        boardCount: boardTipsRef.current.length,
        boardTips: boardTipsRef.current,
        lastTipAt: lastTipAtRef.current,
      }
      if (!canTip(tipsRef.current, id, gate)) return false
      // A stall/stuck/undo tip queued before the result never plays after it; the three-star tip
      // is the only one for a won board
      const over = boardOverRef.current
      if (over === 'lost' || (over === 'won') !== (id === 'three-star')) return false
      if (opts.needQuiet !== false) {
        const q = voiceQuietMs()
        if (q == null || q < (opts.quietMs ?? TIP_TRIGGERS.quietMs)) return false
      }
      const line = tipBanter(id, reason)
      if (line.silent || !line.clip) return false
      if (line.text) showToast(line.text)
      playBanterClip(line.clip, line.voiceMood, line.alts, line.priority, line.waitMs)
      boardTipsRef.current = [...boardTipsRef.current, id]
      lastTipAtRef.current = now
      persistTips(noteShown(tipsRef.current, id, now))
      return true
    } catch {
      return false
    }
  }

  function saveSettingsPatch(patch: Partial<Settings>) {
    setSettings((cur) => {
      const next = { ...cur, ...patch }
      saveSettings(next)
      return next
    })
  }

  /** Ask for a name once; `then` runs after Save or Skip */
  function askNameOnce(then?: () => void): boolean {
    if (settings.namePrompted || playerName) return false
    setNameDraft('')
    setNamePrompt({ then })
    return true
  }

  function closeNamePrompt(save: boolean) {
    const name = save ? cleanPlayerName(nameDraft) : ''
    saveSettingsPatch({ namePrompted: true, ...(name ? { playerName: name } : {}) })
    const then = namePrompt?.then
    setNamePrompt(null)
    if (then) window.setTimeout(then, 0)
  }

  /** Share text for this board: name, score, level, stars, best time, New best! */
  function levelLabelFor(p: Puzzle): string {
    const n = PUZZLES.findIndex((c) => c.id === p.id)
    return n >= 0 ? `Level ${n + 1} (${p.name})` : `${p.name} (${DIFFICULTY_LABEL[p.difficulty]})`
  }

  function persistRecords(next: RecordsBlob) {
    setRecords(next)
    saveRecords(next)
  }

  function persistWallet(next: Wallet) {
    setWallet(next)
    saveWallet(next)
  }

  /** 9.30-m: today's ledger (a new day starts fresh), read from storage so two tabs can't double-count */
  function ledgerNow(): Ledger {
    return rollLedger(loadLedger(safeLocalStorage(), torontoDateKey()), torontoDateKey())
  }
  function commitLedger(l: Ledger) {
    saveLedger(safeLocalStorage(), l)
    setEconState(l)
  }

  function persistPets(next: PetState) {
    setPets(next)
    savePets(next)
  }

  /** 9.30-d: hidden way to the owner page: 7 quick taps on the home title within 3 s (still needs the passphrase) */
  const ownerDoor = useTapCount(OWNER_TAPS, OWNER_TAP_WINDOW_MS, () => window.location.assign(OWNER_PATH), !isStoreBuild())

  /** 9.30-a: buddy actions from The Stable */
  function onAdoptPet(id: PetId) {
    const now = Date.now()
    const w = loadWallet()
    const r = buyPet(loadPets(), w.coins, id, now)
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistWallet({ ...w, coins: r.coins })
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const p = petById(id)!
    showToast(`${p.name} the ${p.species} joined your Stable!${r.coupon ? ` (${r.coupon.pct}% coupon used)` : ''}`)
  }

  /** 9.30-b: coin bundles (several buddies at a discount; coins only) */
  function onBuyBundle(id: BundleId) {
    const now = Date.now()
    const w = loadWallet()
    const r = buyBundle(loadPets(), w.coins, id, now)
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistWallet({ ...w, coins: r.coins })
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const names = r.got.map((p) => petById(p)!.name)
    showToast(`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} joined your Stable!`)
  }

  /** 9.30-m: the free daily pet */
  function onCarePet(id: PetId) {
    const r = petCare(loadPets(), id, Date.now(), torontoDateKey())
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const name = petById(id)!.name
    showToast(`${name} loved that! +${r.xp} XP`)
    if (r.levelUp) window.setTimeout(() => showToast(`${name} is Level ${r.levelUp}!${milestoneAt(r.levelUp!) ? ` New: ${milestoneAt(r.levelUp!)!.text}` : ''}`), 1800)
    if (r.starUp) window.setTimeout(() => showToast(`${name} earned prestige star ${'★'.repeat(r.starUp!)}`), 1800)
  }

  /** 9.30-m: feed a treat (from your earned stock first, otherwise for coins) */
  function onFeedPet(id: PetId, treat: TreatId) {
    const w = loadWallet()
    const r = feedPet(loadPets(), w.coins, id, treat, Date.now(), torontoDateKey())
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    if (r.spent > 0) persistWallet({ ...w, coins: r.coins })
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const name = petById(id)!.name
    showToast(`${name} enjoyed it! +${r.xp} XP${r.spent ? ` (−${r.spent} coins)` : ' (free treat)'}`)
    if (r.levelUp) window.setTimeout(() => showToast(`${name} is Level ${r.levelUp}!${milestoneAt(r.levelUp!) ? ` New: ${milestoneAt(r.levelUp!)!.text}` : ''}`), 1800)
    if (r.starUp) window.setTimeout(() => showToast(`${name} earned prestige star ${'★'.repeat(r.starUp!)}`), 1800)
  }

  function onEquipPet(id: PetId | null) {
    const next = equipPet(loadPets(), id, Date.now())
    persistPets(next)
    if (id) petGiggle()
    showToast(id ? `Riding with ${petById(id)?.name}` : 'Solo runs: no buddy')
  }

  /** 9.30-b: what's in this gift? (preview card before claiming; the code isn't used) */
  async function onPeekGift(raw: string): Promise<{ ok: boolean; message: string; gift?: Gift; note?: string; code?: string }> {
    const code = normalizeGiftCode(raw)
    if (loadPets().redeemed.includes(code)) return { ok: false, message: 'You already redeemed that code.' }
    try {
      const res = await fetch('/api/gift-redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, peek: true }) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; gift?: Gift; note?: string; reason?: string }
      if (!j.ok || !j.gift) return { ok: false, message: j.reason ?? 'Gifts are unavailable right now.' }
      return { ok: true, message: '', gift: j.gift, note: j.note ?? '', code }
    } catch {
      return { ok: false, message: 'Gifts are unavailable right now. Try again later.' }
    }
  }

  async function onRedeemGift(raw: string): Promise<{ ok: boolean; message: string }> {
    const code = normalizeGiftCode(raw)
    if (loadPets().redeemed.includes(code)) return { ok: false, message: 'You already redeemed that code.' }
    try {
      const res = await fetch('/api/gift-redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; gift?: Gift; note?: string; reason?: string }
      if (!j.ok || !j.gift) return { ok: false, message: j.reason ?? 'Gifts are unavailable right now.' }
      const w = loadWallet()
      const out = applyGift(loadPets(), w.coins, j.gift, code, Date.now(), j.note)
      persistPets(out.state)
      if (out.coins !== w.coins) persistWallet({ ...w, coins: out.coins })
      sfxCoin()
      petGiggle()
      showToast(out.message)
      return { ok: true, message: out.message }
    } catch {
      return { ok: false, message: 'Gifts are unavailable right now. Try again later.' }
    }
  }

  function commitHistory(nextHist: ReturnType<typeof createHistory>) {
    historyRef.current = nextHist
    setHistory(nextHist.past)
    setFuture(nextHist.future)
    setCells(nextHist.present)
  }

  function adoptBoard(board: CellState[]) {
    replaceBoard(createHistory(board))
  }

  /** Commit a board that replaces the one on screen, and tell Board to drop any open gesture. */
  function replaceBoard(nextHist: ReturnType<typeof createHistory>) {
    commitHistory(nextHist)
    setBoardVersion((v) => v + 1)
  }

  /** Board builds every move on this, so it can never work from a board Undo already replaced. */
  const getLiveCells = useCallback(() => historyRef.current.present, [])

  /** Save the board with its undo/redo steps, so Resume shows what is on screen now. */
  function saveBoardDraft(hist: ReturnType<typeof createHistory>, extra?: { elapsedMs: number; hintsUsed: number }) {
    if (!puzzle) return
    saveDraft({
      puzzleId: puzzle.id,
      cells: hist.present,
      elapsedMs: extra?.elapsedMs ?? elapsedMs,
      hintsUsed: extra?.hintsUsed ?? hintsUsed,
      startedAt: new Date().toISOString(),
      flawed: flawedRef.current,
      mode: modeRef.current,
      daily: dailyRunRef.current ?? undefined,
      combo: comboRef.current,
      undos: undosRef.current,
      splits: splitsRef.current,
      ...stepsToSave(hist),
    })
  }

  /** Buddy Parade: if one is owed (and switched on), show it, then run `go`. Otherwise just run `go`. */
  function maybeParade(go: () => void) {
    if (!paradeRef.current.due) return go()
    paradeRef.current = paradeDone(paradeRef.current)
    saveParade(safeLocalStorage(), paradeRef.current)
    if (settingsRef.current.parade === false) return go()
    const now = Date.now()
    const petsNow = loadPets()
    const owned: ParadeBuddy[] = PETS.filter((pp) => hasPet(petsNow, pp.id, now)).map((pp) => ({ id: pp.id, locked: false }))
    // at least 3 marchers, so there is always something to catch: the rest are silhouettes of buddies not owned yet
    const buddies: ParadeBuddy[] = [...owned]
    for (const pp of PETS) {
      if (buddies.length >= 3) break
      if (!buddies.some((x) => x.id === pp.id)) buddies.push({ id: pp.id, locked: true })
    }
    // Buddy of the day: rotates through the buddies you own (a guest silhouette if none)
    const day = startBuddyDay(dayRef.current, owned.map((x) => x.id))
    dayRef.current = day
    saveDay(safeLocalStorage(), day)
    // 9.30-m: treasure rides in 3 parades a day
    const ledP = ledgerNow()
    const treasureOk = canTreasure(ledP)
    if (treasureOk) commitLedger({ ...ledP, treasureParades: ledP.treasureParades + 1 })
    setParade({
      buddies,
      ms: paradeLengthMs(),
      go,
      treasure: treasureOk ? makeTreasure(buddies.length) : [],
      featured: day.pet,
      featuredKind: day.kind,
    })
    sfxAchievement()
    if (shellRef.current) burstConfetti(shellRef.current, true)
    window.setTimeout(() => {
      if (shellRef.current) burstConfetti(shellRef.current, true)
    }, 2600)
  }

  /** A parade treasure was tapped: coins, a free hint, or a spin token into the wallet */
  function catchTreasure(t: Treasure) {
    const cur = loadWallet()
    const next = { ...cur }
    if (t.kind === 'coins') next.coins += t.amount
    else if (t.kind === 'hint') next.freeHints += 1
    else {
      const led = ledgerNow()
      if (canEarnSpin(led)) {
        next.spins += 1
        commitLedger({ ...led, spins: led.spins + 1 })
      } else {
        next.coins += SPIN_CAPPED_COINS
        showToast(`Spin limit for today: +${SPIN_CAPPED_COINS} coins instead`)
      }
    }
    persistWallet(next)
    sfxCoin()
  }

  function startPuzzle(p: Puzzle, resume = false, opts: { mode?: RunMode; daily?: boolean; endless?: boolean } = {}) {
    // First board ever: How to play opens first (returning players start at the new cards)
    if (!resume && !settingsRef.current.howSeen) {
      pendingStartRef.current = { p, opts }
      setStartSheet(null)
      setHowStart(progress.clears.length > 0 ? HOW_NEW_START : 0)
      setScreen('how')
      return
    }
    unlockAudio()
    dropWaitingVoice()
    sfxWhoosh()
    resetPlayViewport()
    setStartSheet(null)
    const resumeDraft = resume ? loadDraft() : null
    const resuming = !!resumeDraft && resumeDraft.puzzleId === p.id
    const onCatalog = hasRecords(p.id)
    let runMode: RunMode = resuming ? resumeDraft!.mode ?? 'normal' : opts.mode ?? 'normal'
    if (runMode === 'trial' && !onCatalog) runMode = 'normal'
    let dailyKey: string | null = resuming ? resumeDraft!.daily ?? null : null
    let practice = false
    let rec = records
    if (!resuming && opts.daily) {
      const today = torontoDateKey()
      const started = startDaily(rec.daily, today, p.id)
      rec = { ...rec, daily: started.daily }
      if (started.firstAttempt) dailyKey = today
      else practice = true
    }
    if (!resuming && onCatalog) rec = notePlay(rec, p.id)
    if (rec !== records) persistRecords(rec)
    modeRef.current = runMode
    setMode(runMode)
    dailyRunRef.current = dailyKey
    endlessRef.current = !resuming && opts.endless ? p.difficulty : null
    setDailyTag(dailyKey ? 'scored' : practice || (opts.daily && !dailyKey) ? 'practice' : '')
    setWinReplay(null)
    boardTipsRef.current = []
    maxGapRef.current = 0
    wrongTimesRef.current = []
    lastMoveRef.current = Date.now()
    lastProgressRef.current = Date.now()
    // 9.30-j: once the first-time tip is done, a Trial / Daily start sometimes gets its own line (same moment)
    if (runMode === 'trial') window.setTimeout(() => fireTip('first-trial', undefined, { needQuiet: false }) || (Math.random() < 0.38 && pushBanter('trial-start')), 1800)
    else if (dailyKey) window.setTimeout(() => fireTip('first-daily', undefined, { needQuiet: false }) || (Math.random() < 0.38 && pushBanter('daily-start')), 1800)
    comboRef.current = resuming ? resumeDraft!.combo ?? newCombo() : newCombo()
    undosRef.current = resuming ? resumeDraft!.undos ?? 0 : 0
    splitsRef.current = resuming ? resumeDraft!.splits ?? [] : []
    // Before the board: what to beat
    const best = onCatalog ? hasBest(rec, p.id, runMode) : undefined
    const intro = [
      runMode === 'trial' ? `Roman's Trial: ${TRIAL_HEARTS} hearts, no undo, beat the clock` : '',
      dailyKey ? 'Daily Challenge: only this first try counts' : practice ? "Daily practice: today's score is already in" : '',
      best ? `Best ${formatMs(best.bestMs!)} · ${best.bestScore ?? 0} pts` : '',
    ].filter(Boolean).join(' · ')
    const saved = loadWallet()
    let startLives = runMode === 'trial' ? TRIAL_HEARTS : MAX_LIVES
    // 9.30-a: the active buddy rides along (hint/heart/rescue perks are off in Roman's Trial)
    const petsNow = loadPets()
    const ridePet = activePet(petsNow, Date.now())
    const ridePerk = activePerk(petsNow, Date.now())
    runPetRef.current = ridePet
    const trialRun = runMode === 'trial'
    // 9.30-l: buddy of the day. A NEW board (not a resume) uses one of its 3 boards; the hint perk is off in Roman's Trial
    let dayNow: { pet: PetId | null; kind: DayPerkKind; board: number } | null = dayPerkRef.current
    if (!resume) {
      const u = useDayBoard(dayRef.current)
      dayRef.current = u.day
      saveDay(safeLocalStorage(), u.day)
      dayNow = u.perk
      setDayPerk(u.perk)
    }
    const dayHint = !trialRun && dayNow?.kind === 'hint' ? 1 : 0
    setPetFree({ hints: (!trialRun && ridePerk ? ridePerk.hints : 0) + dayHint, rescues: !trialRun && ridePerk ? ridePerk.rescues : 0 })
    const petHeart = !trialRun && ridePerk ? ridePerk.hearts : 0
    if (runMode !== 'trial' && (saved.bonusHearts ?? 0) > 0) {
      const left = saved.bonusHearts - 1
      persistWallet({ ...saved, bonusHearts: left })
      startLives = MAX_LIVES + 1 + petHeart
      showToast(
        left > 0
          ? `Bonus heart used — this board starts with ${startLives} hearts (${left} saved)`
          : `Bonus heart used — this board starts with ${startLives} hearts`,
      )
      if (intro && !resuming) window.setTimeout(() => showToast(intro), 2500)
    } else {
      startLives += petHeart
      if (intro && !resuming) showToast(intro)
    }
    const themeId = p.theme ?? themeForPuzzle(p.id, p.difficulty)
    setPuzzle({ ...p, theme: themeId })
    recordedRef.current = false
    setCelebrate(false)
    setDefeated(false)
    setWinLine('')
    setLoseLine('')
    setShowWheel(false)
    setShowHunt(false)
    setWinPerfect(false)
    flawedRef.current = false
    setLastScore(null)
    setHintIndex(null)
    setHintText('')
    setRunMaxLives(startLives)
    setLives(startLives)
    // Quiet start — no theme blob/voice; board stays fully visible

    if (resume) {
      const d = loadDraft()
      if (d && d.puzzleId === p.id) {
        // Bring the undo/redo steps back too. Phones reload a tab left in the background,
        // and Resume used to start with an empty history (Undo greyed out).
        replaceBoard(restoreHistory(d.cells as CellState[], d.past, d.future))
        setElapsedMs(d.elapsedMs)
        setHintsUsed(d.hintsUsed)
        flawedRef.current = d.flawed === true || d.hintsUsed > 0
        setRunning(true)
        setScreen('play')
        return
      }
    }

    const board = emptyBoard(p.size)
    adoptBoard(board)
    setElapsedMs(0)
    setHintsUsed(0)
    setRescuesUsed(0)
    setRunning(true)
    setScreen('play')
    saveDraft({
      puzzleId: p.id,
      cells: board,
      elapsedMs: 0,
      hintsUsed: 0,
      startedAt: new Date().toISOString(),
      mode: runMode,
      daily: dailyKey ?? undefined,
    })
  }

  function onBoardChange(
    next: CellState[],
    meta: {
      kind: CellState
      conflict: boolean
      index: number
      conflictKind?: BoardConflictKind | null
      stroke?: number
      /** a hint or rescue made this change (no combo points) */
      assist?: boolean
    },
  ) {
    bumpAction()
    // One finger-down-to-up (a swipe that paints or erases several X's) is one undo step:
    // the first change records a step, the rest of the same stroke fold into it.
    const sameStroke =
      meta.stroke != null && strokeStepRef.current != null && strokeStepRef.current.stroke === meta.stroke &&
      strokeStepRef.current.hist === historyRef.current
    const hist = sameStroke ? amendMove(historyRef.current, next) : pushMove(historyRef.current, next)
    if (hist === historyRef.current) return
    commitHistory(hist)
    strokeStepRef.current = meta.stroke != null ? { stroke: meta.stroke, hist } : null

    // Skill scoring: quick good moves build a combo (shown in the caption slot, never on the HUD)
    if (puzzle && !recordedRef.current) {
      try {
        const kind: MoveKind = meta.assist
          ? 'other'
          : meta.kind === 'mark'
            ? 'x'
            : meta.kind === 'stone'
              ? meta.conflict
                ? 'bad'
                : 'buddy'
              : 'other'
        const r = comboMove(comboRef.current, kind, meta.index, Date.now())
        comboRef.current = r.combo
        if (r.tierUp) showToast(`Combo ×${comboMult(r.combo.streak)}!`)
        const n = cleanBuddies(puzzle, next)
        const splits = splitsRef.current
        if (n > splits.length) splitsRef.current = [...splits, ...Array.from({ length: n - splits.length }, () => elapsedMs)]
      } catch {
        /* scoring extras only */
      }
    }

    if (meta.kind === 'mark') {
      // X marks: Board already played sfxMark — never banter/voice
    } else if (meta.kind === 'stone' && meta.conflict) {
      const kind: BanterConflictKind = meta.conflictKind ?? 'generic'
      flawedRef.current = true
      {
        const now = Date.now()
        const recent = [...wrongTimesRef.current.filter((t) => now - t < TIP_TRIGGERS.stuckWrongWindowMs), now]
        wrongTimesRef.current = recent
        if (recent.length >= TIP_TRIGGERS.stuckWrong) {
          // after the wrong-move line has had its say
          window.setTimeout(() => {
            if (fireTip('stuck', undefined, { quietMs: 800 })) wrongTimesRef.current = []
          }, 3500)
        }
      }
      let nextLives = lives
      let w = { ...wallet, totalMistakes: wallet.totalMistakes + 1 }
      // One line per move: the losing move gets the lose line only, not a wrong-move line too
      if (w.shields > 0 || lives > 1) pushBanter('place-bad', kind)
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
        boardOverRef.current = 'lost'
        cancelVoiceBelow(VOICE_PRIORITY.lose)
        setDefeated(true)
        setRunning(false)
        saveDraft(null)
        sfxLose()
        const lose = pushBanter('lose')
        setLoseLine(lose.text || 'Out of hearts')
        setAwaitingComeback(true)
      }
    } else if (meta.kind === 'stone') {
      lastProgressRef.current = Date.now()
      // The winning buddy gets the win line only (no old-timer grumble cut off by the cheer)
      if (!(puzzle && isSolved(puzzle, next))) pushBanter('place-good')
      setGiggleIndex(meta.index)
      window.setTimeout(() => setGiggleIndex((g) => (g === meta.index ? null : g)), 900)
    }

    saveBoardDraft(hist)

    if (puzzle && isSolved(puzzle, next) && !recordedRef.current) {
      recordedRef.current = true
      boardOverRef.current = 'won'
      // Drop anything queued from the live board (wrong move, stall, tip, old-timer) before the win line
      cancelVoiceBelow(VOICE_PRIORITY.win)
      setRunning(false)
      setCelebrate(true)
      sfxWin()
      const perfect = hintsUsed === 0
      // Buddy meter: a perfect win (no hints, rescue, wrong buddies or lost hearts) fills a notch
      const flawless = isPerfectWin({ hintsUsed, flawed: flawedRef.current, livesLost: runMaxLives - lives })
      const metered = recordWin(loadBuddyMeter(), flawless)
      saveBuddyMeter(metered.meter)
      setBuddyMeter(metered.meter)
      setWinPerfect(flawless)
      setHuntJustEarned(metered.filledNow)
      paradeRef.current = paradeWin(paradeRef.current)
      saveParade(safeLocalStorage(), paradeRef.current)
      if (metered.filledNow) window.setTimeout(() => showToast('Buddy meter full — Buddy Hunt unlocked!'), 1200)
      const targets = targetsFor(puzzle)
      const runMode = modeRef.current
      const score = scoreRunV2({
        size: puzzle.size,
        targetMs: targets.timeMs,
        elapsedMs,
        hintsUsed,
        perfect,
        comboPoints: comboRef.current.points,
      })
      setLastScore(score)
      // Personal bests, stars, Trial and Daily
      let replay: RunResult | null = null
      let rec = records
      let dailyStreak: number | null = null
      try {
        const fullSplits = [...splitsRef.current]
        while (fullSplits.length < puzzle.size) fullSplits.push(elapsedMs)
        if (hasRecords(puzzle.id)) {
          const out = recordRun(rec, { puzzleId: puzzle.id, mode: runMode, ms: elapsedMs, score, undos: undosRef.current, splits: fullSplits.slice(0, puzzle.size), targets, buddy: runPetRef.current })
          rec = out.blob
          replay = out.result
        }
        if (dailyRunRef.current) {
          const fin = finishDaily(rec.daily, dailyRunRef.current, true, { score, ms: elapsedMs, buddy: runPetRef.current })
          rec = { ...rec, daily: fin.daily }
          if (fin.counted) dailyStreak = fin.streak
          dailyRunRef.current = null
        }
        if (rec !== records) persistRecords(rec)
        if (endlessRef.current) setEndless(noteEndlessClear(puzzle.size))
      } catch {
        /* never block the win */
      }
      const isRecord = !!replay && (replay.newBestTime || replay.newBestScore)
      // 9.30-a (Tony): won a replayed board without beating the old best = ONE combined line (board
      // cleared + slower than your best), not a cheer followed by a tease. The win sound and banner stay.
      const notBest = !!replay && !replay.firstClear && !replay.newBestTime && !replay.newBestScore && runMode === 'normal' && dailyStreak == null
      // One voice line for the win: a record, a Trial clear, the Daily, not-your-best, or the usual cheer
      const winEvent = isRecord
        ? 'record'
        : runMode === 'trial'
          ? 'trial-clear'
          : dailyStreak != null
            ? 'daily-done'
            : notBest
              ? 'not-best'
              : replay?.nearMissMs
                ? 'near-miss'
                : 'win'
      if (isRecord) sfxRecord()
      const win = pushBanter(winEvent)
      setWinLine(win.text || 'Roman says: nice clear!')
      // Slow or sloppy clear (lost a heart, 2+ hints, or over 3 minutes): the old-timer may chime in
      // with a backhanded compliment once Roman's cheer is done (never on top of it)
      // Voice tips: what the player has shown they get, and how to reach 3 stars if they missed it
      let tipped = false
      try {
        if (replay) {
          if (replay.runStars >= 3) tipMastery('three-star')
          else if (!notBest) {
            const reason = missedStarReason({ withinTime: elapsedMs <= targets.timeMs, undos: undosRef.current, scoreOk: score >= targets.score3 })
            tipped = fireTip('three-star', reason, { needQuiet: false })
          }
        }
        if (undosRef.current <= 1) tipMastery('undo-spam')
        if (Math.max(maxGapRef.current, Date.now() - lastMoveRef.current) < TIP_TRIGGERS.steadyGapMs) tipMastery('stall')
        if (runMode === 'trial') tipMastery('first-trial')
        if (dailyStreak != null) tipMastery('first-daily')
      } catch {
        /* tips are extras */
      }
      if (!tipped && !notBest && winEvent === 'win' && (lives < runMaxLives || hintsUsed >= 2 || elapsedMs > 180000)) {
        window.setTimeout(() => pushBanter('win-heckle'), 2600)
      }
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
        const link = encodeDuelLink(result, puzzle)
        setDuel(result)
        setDuelLink(link)
        setShareLink(link)
        setShareText(duelShareText(result))
      }

      // 9.30-m: daily limits. Full pay for the first 5 wins of the day, then it tapers; repeats of the same board pay less
      const led0 = ledgerNow()
      const trialMult = runMode === 'trial' ? trialMultiplier(led0) : 1
      const baseCoins = Math.max(20, Math.floor(score / 8)) * trialMult
      const paid = grantWinCoins(wallet, baseCoins)
      const pay = payWin(led0, paid.gained, { boardId: puzzle.id, newBest: isRecord, daily: dailyStreak != null })
      commitLedger(runMode === 'trial' ? { ...pay.ledger, trialClears: led0.trialClears + 1 } : pay.ledger)
      const extra0 = replay ? replayCoins(replay, runMode) : { coins: 0, parts: [] as string[] }
      const dropBest = isRecord && !pay.bestPays
      const extra = dropBest
        ? { coins: Math.max(0, extra0.coins - NEW_BEST_COINS), parts: extra0.parts.filter((x) => !/new best/.test(x)) }
        : extra0
      const dailyBonus = dailyStreak != null ? dailyCoins(dailyStreak) : 0
      // 9.30-a: buddy perk coins, growth, coupons and a cheer
      const ridePet = runPetRef.current
      const ridePerk = ridePet ? activePerk({ ...loadPets(), active: ridePet }, Date.now()) : null
      // 9.30-l: buddy of the day, double coins: adds the win's coins once more (capped)
      const dayBonus = dayPerkRef.current?.kind === 'coins' ? dayCoins(pay.coins) : 0
      // buddy coins taper with the day like the win itself
      const petCoins = Math.floor((petWinCoins(paid.gained, ridePerk) * pay.pct) / 100) + dayBonus
      let petCheer: WinReplay['pet'] = undefined
      try {
        let ps = loadPets()
        const grown = addPetXp(ps, ridePet, winXp({ perfect: flawless, record: isRecord }), Date.now())
        ps = grown.state
        if (runMode === 'trial') {
          const c = awardTrialClearCoupon(ps, Date.now())
          ps = c.state
          if (c.coupon) window.setTimeout(() => showToast(`Trial clear prize: ${c.coupon!.pct}% off ${petById(c.coupon!.pet)?.name ?? 'a buddy'} in The Stable`), 4200)
        }
        if (dailyStreak != null) {
          ps = grantTreat(ps, 'snack')
          window.setTimeout(() => showToast('Daily prize: a free Snack for your buddy'), 3600)
          const c = awardStreakCoupon(ps, dailyStreak, Date.now())
          ps = c.state
          if (c.coupon) ps = grantTreat(ps, 'feast')
          if (c.coupon) window.setTimeout(() => showToast(`${dailyStreak}-day streak prize: ${c.coupon!.pct}% off ${petById(c.coupon!.pet)?.name ?? 'a buddy'} in The Stable`), 4400)
        }
        persistPets(ps)
        if (ridePet) {
          const p = petById(ridePet)!
          petCheer = {
            id: ridePet,
            name: p.name,
            text: isRecord ? 'New best!' : grown.levelUp ? `Level ${grown.levelUp}!` : grown.starUp ? 'New star!' : runMode === 'trial' ? 'Victory!' : 'Ave!',
            cheer: isRecord || !!grown.levelUp,
          }
          // A little giggle for a record, only when Roman isn't talking
          if (isRecord) window.setTimeout(() => petGiggle({ quietOnly: true }), 3200)
          if (grown.levelUp) {
            const m = milestoneAt(grown.levelUp)
            window.setTimeout(() => showToast(`${p.name} is Level ${grown.levelUp}!${m ? ` New: ${m.text}` : ''}`), 5200)
          }
          if (grown.starUp) window.setTimeout(() => showToast(`${p.name} earned prestige star ${'★'.repeat(grown.starUp!)}`), 5200)
        }
      } catch {
        /* buddies are extras; never block the win */
      }
      {
        const parts = [...extra.parts]
        if (dailyBonus) parts.push(`+${dailyBonus} daily`)
        if (pay.note) parts.push(pay.note)
        if (petCoins - dayBonus > 0 && ridePet) parts.push(`+${petCoins - dayBonus}\u00a0${petById(ridePet)?.name}`)
        if (dayBonus > 0) parts.push(`+${dayBonus}\u00a0${dayPerkRef.current?.pet ? petById(dayPerkRef.current.pet)?.name : 'Guest'} of the day`)
        if (runMode === 'trial' && trialMult === 2) parts.unshift('2× coins')
        else if (runMode === 'trial') parts.unshift('Trial 2× is used up for today')
        const c = comboRef.current
        const bits = [`combo ×${c.bestMult}`, `${undosRef.current} undo${undosRef.current === 1 ? '' : 's'}`]
        if (perfect) bits.unshift('perfect')
        const banner: WinReplay['banner'] = isRecord && replay
          ? { kind: 'record', text: replay.newBestTime ? `New best! ${formatMs(elapsedMs)} (was ${formatMs(replay.prevBestMs ?? 0)})` : `New best score! ${score} pts` }
          : runMode === 'trial'
            ? { kind: 'trial', text: "Roman's Trial cleared!" }
            : dailyStreak != null
              ? { kind: 'daily', text: `Daily done · streak ${dailyStreak}` }
              : replay?.nearMissMs
                ? { kind: 'near', text: `${(replay.nearMissMs / 1000).toFixed(1)} sec off your best` }
                : replay?.firstClear
                  ? { kind: 'first', text: 'First clear. Now beat it!' }
                  : undefined
        setWinReplay({
          showStars: !!replay && runMode === 'normal',
          stars: replay?.starsAfter ?? 0,
          starsBefore: replay?.starsBefore ?? 0,
          banner,
          coinsLine: parts.join(' · ') || undefined,
          detail: bits.join(' · '),
          pet: petCheer,
        })
        if (replay?.trialUnlockedNow) window.setTimeout(() => showToast(`3 stars! Roman's Trial unlocked on ${puzzle.name}`), 1600)
      }
      let w: Wallet = {
        ...paid.wallet,
        coins: paid.wallet.coins - paid.gained + pay.coins + extra.coins + dailyBonus + petCoins,
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
      const unlockedNow = freshBadgeIds(wallet, evaled.wallet)
      if (unlockedNow.length) {
        // Let the win Roman punchline finish before badge unlock voice/toast
        unlockedNow.forEach((badgeId, i) => {
          const badge = BADGES.find((b) => b.id === badgeId)
          window.setTimeout(() => {
            sfxAchievement()
            if (i === 0) pushBanter('achievement')
            showToast(`Badge unlocked: ${badge?.title ?? badgeId}`)
          }, 3400 + i * 2600)
        })
      }
      if (shellRef.current) burstConfetti(shellRef.current)
      // First finished board: ask once what to call the player on share cards
      if (!settings.namePrompted && !playerName) {
        window.setTimeout(() => {
          // Only over the Victory card itself — never on top of Buddy Hunt or the prize wheel
          if (!document.querySelector('.win-screen') || document.querySelector('.buddy-hunt, .prize-overlay')) return
          askNameOnce()
        }, 2200)
      }
    }
  }

  /** Undo/redo spam (4 within 5s) gives the old-timer an opening */
  function noteUndoRedo() {
    const now = Date.now()
    const recent = [...undoTimesRef.current.filter((t) => now - t < 5000), now]
    if (recent.length >= 4) {
      undoTimesRef.current = []
      pushBanter('undo-spam')
    } else {
      undoTimesRef.current = recent
    }
  }

  function undo() {
    if (historyRef.current.past.length === 0 || celebrate || defeated || modeRef.current === 'trial') return
    // Board first: a sound or voice hiccup must never cost the undo itself.
    const hist = undoMove(historyRef.current)
    replaceBoard(hist)
    try {
      // Each undo costs points and breaks the combo
      undosRef.current += 1
      comboRef.current = comboMove(comboRef.current, 'undo', -1, Date.now()).combo
      showToast(`Undo · −${UNDO_COST} pts`)
      // Repeated undos: a voice tip about what undo costs (once the heckle, if any, has finished)
      if (undosRef.current >= TIP_TRIGGERS.undoCount) window.setTimeout(() => fireTip('undo-spam', undefined, { quietMs: 800 }), 1400)
    } catch {
      /* scoring only */
    }
    // Without this the saved board kept the undone X's: Resume (or iOS reloading the tab) put them back.
    saveBoardDraft(hist)
    afterUndoRedo()
  }

  function afterUndoRedo() {
    try {
      sfxUndo()
      noteUndoRedo()
    } catch {
      /* sound only */
    }
  }

  function redo() {
    if (historyRef.current.future.length === 0 || celebrate || defeated || modeRef.current === 'trial') return
    const hist = redoMove(historyRef.current)
    replaceBoard(hist)
    saveBoardDraft(hist)
    afterUndoRedo()
  }

  function onHint() {
    if (!puzzle || celebrate || defeated) return
    bumpAction()
    const board = historyRef.current.present
    const hint = findHint(puzzle, board)
    if (!hint) {
      showToast('No hint available')
      return
    }
    let w = { ...wallet }
    if (petFree.hints > 0) {
      setPetFree((f) => ({ ...f, hints: f.hints - 1 }))
      showToast(`Free hint from ${petById(runPetRef.current)?.name ?? 'your buddy'}`)
    } else if (w.freeHints > 0) {
      w = { ...w, freeHints: w.freeHints - 1 }
    } else if (w.coins >= hintPrice(hintsUsed)) {
      w = { ...w, coins: w.coins - hintPrice(hintsUsed) }
      showToast(`−${hintPrice(hintsUsed)} coins`)
    } else {
      setShortfall({ action: 'hint', need: hintPrice(hintsUsed) })
      return
    }
    persistWallet(w)
    sfxHint()
    pushBanter('hint')
    tipMastery('stuck')
    lastProgressRef.current = Date.now()
    flawedRef.current = true
    setHintIndex(hint.index)
    setHintText(hint.explanation)
    setHintsUsed((n) => n + 1)
    onBoardChange(applyHint(board, hint), {
      kind: hint.kind === 'stone' ? 'stone' : 'mark',
      conflict: false,
      index: hint.index,
      assist: true,
    })
  }

  /** Rare rescue: clear a buddy that does not belong (wrong spot / conflict) */
  function onRescue() {
    if (!puzzle || celebrate || defeated) return
    bumpAction()
    const board = historyRef.current.present
    const hit = findMisplacedBuddy(puzzle, board)
    if (!hit) {
      showToast('No rescue needed — buddies look fine')
      return
    }
    if (petFree.rescues > 0) {
      setPetFree((f) => ({ ...f, rescues: f.rescues - 1 }))
    } else if (wallet.coins < rescuePrice(rescuesUsed)) {
      setShortfall({ action: 'rescue', need: rescuePrice(rescuesUsed) })
      return
    } else {
      persistWallet({ ...wallet, coins: wallet.coins - rescuePrice(rescuesUsed) })
    }
    setRescuesUsed((n) => n + 1)
    flawedRef.current = true
    sfxHint()
    pushBanter('rescue')
    setHintIndex(hit.index)
    setHintText(hit.explanation)
    showToast(hit.explanation)
    onBoardChange(clearBuddy(board, hit.index), {
      kind: 'empty',
      conflict: false,
      index: hit.index,
      assist: true,
    })
  }

  function resetBoard() {
    if (!puzzle) return
    sfxWhoosh()
    comboRef.current = newCombo()
    undosRef.current = 0
    splitsRef.current = []
    // Only the first Daily try scores: a restart turns it into practice
    if (dailyRunRef.current) {
      dailyRunRef.current = null
      setDailyTag('practice')
    }
    const fresh = createHistory(emptyBoard(puzzle.size))
    replaceBoard(fresh)
    saveBoardDraft(fresh, { elapsedMs: 0, hintsUsed: 0 })
    setElapsedMs(0)
    setHintsUsed(0)
    setRescuesUsed(0)
    setCelebrate(false)
    setDefeated(false)
    setWinLine('')
    setLoseLine('')
    setShowWheel(false)
    setShowHunt(false)
    setWinPerfect(false)
    flawedRef.current = false
    setLastScore(null)
    recordedRef.current = false
    setWinReplay(null)
    setRunning(true)
    setLives(runMaxLives)
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
    flawedRef.current = true
    setLives(runMaxLives)
    setDefeated(false)
    setRunning(true)
    showToast('Revived!')
  }

  /** Buddy Hunt: opening it spends the full meter, so a reload can't replay the round. */
  function openBuddyHunt() {
    const current = loadBuddyMeter()
    if (!current.pending) return
    unlockAudio()
    const m = startHunt(current)
    saveBuddyMeter(m)
    setBuddyMeter(m)
    setShowHunt(true)
  }

  /** Round over: pay out right away (saved even if the app closes) and return the prize line. */
  function finishBuddyHunt(found: number): string {
    const before = loadWallet()
    const raw = huntPrize(found, before, MAX_BONUS_HEARTS)
    // 9.30-m: three full hunts a day, then a quarter of the coins
    const ledH = ledgerNow()
    const hp = huntPct(ledH)
    const scaled = hp < 100 ? Math.round((raw.coins * hp) / 100) : raw.coins
    const prize = hp < 100 ? { ...raw, coins: scaled, label: raw.label.replace(`+${raw.coins} coins`, `+${scaled} coins`) } : raw
    commitLedger({ ...ledH, hunts: ledH.hunts + 1 })
    if (found >= 3 && ledH.hunts === 0) {
      persistPets(grantTreat(loadPets(), 'snack'))
      window.setTimeout(() => showToast('Buddy Hunt prize: a free Snack for your buddy'), 1800)
    }
    persistWallet(applyHuntPrize(before, prize))
    pushBanter(found >= 3 ? 'hunt-all' : found > 0 ? 'hunt-some' : 'hunt-none')
    // All three get the Buddy Hunt fanfare instead
    if (prize.coins > 0 && found < 3) window.setTimeout(sfxCoin, 450)
    if (found >= 3 && shellRef.current) burstConfetti(shellRef.current)
    return prize.label
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
    const before = loadWallet()
    let w = applyPrize(before, prize)
    let trialMsg = ''
    if (prize.id === 'buddy_trial') {
      const g = grantTrial(loadPets(), Date.now())
      if (g.pet) {
        persistPets(g.state)
        const p = petById(g.pet)!
        trialMsg = `Free 24h trial: ${p.name} the ${p.species} is riding with you!`
        window.setTimeout(() => petGiggle({ quietOnly: true }), 2400)
      } else {
        w = { ...w, coins: w.coins + BUDDY_TRIAL_FALLBACK_COINS }
        trialMsg = `+${BUDDY_TRIAL_FALLBACK_COINS} coins (you already have every buddy!)`
      }
    }
    const gameOpen = screen === 'play' && !!puzzle && !celebrate && !defeated && lives < runMaxLives
    if (prize.id === 'heart_refill' && gameOpen) {
      // Refill the board in progress now instead of banking a bonus heart
      setLives(runMaxLives)
      w = { ...w, bonusHearts: before.bonusHearts ?? 0, coins: before.coins }
    }
    const evaled = evaluateAchievements(w, {
      perfect: false,
      difficulty: puzzle?.difficulty ?? 'easy',
      justWon: false,
    })
    persistWallet(evaled.wallet)
    pushBanter('prize')
    if (prize.id === 'heart_refill') {
      const saved = evaled.wallet.bonusHearts ?? 0
      if (gameOpen) showToast('Full hearts — hearts refilled!')
      else if (saved > (before.bonusHearts ?? 0))
        showToast(
          saved > 1
            ? `Bonus heart saved (${saved}) — your next board starts with ${MAX_LIVES + 1} hearts`
            : `Bonus heart saved — your next board starts with ${MAX_LIVES + 1} hearts`,
        )
      else showToast(`+${HEART_PRIZE_FALLBACK_COINS} coins — you already have ${MAX_BONUS_HEARTS} bonus hearts saved`)
    } else {
      showToast(trialMsg || prize.label)
    }
    const badges = freshBadgeIds(before, evaled.wallet)
    badges.forEach((badgeId, i) => {
      const badge = BADGES.find((b) => b.id === badgeId)
      window.setTimeout(() => {
        sfxAchievement()
        showToast(`Badge unlocked: ${badge?.title ?? badgeId}`)
      }, 2600 + i * 2600)
    })
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
    // 9.30-m: 8 sparks a day, then the critter rests; one spin a day (a 2nd is paid as coins)
    const led = ledgerNow()
    if (!sparksOpen(led)) return
    const spinOk = canEarnSpin(led)
    commitLedger({ ...led, sparks: led.sparks + 1, spins: led.spins + (have >= CRITTER_STASH_GOAL && spinOk ? 1 : 0) })

    // 5th catch across games: earn ONE spin. Do not auto-open the reel.
    if (have >= CRITTER_STASH_GOAL) {
      let w: Wallet = {
        ...current,
        critterStash: 0,
        coins: current.coins + (reward.type === 'coins' ? reward.amount : 25) + (spinOk ? 0 : SPIN_CAPPED_COINS),
        freeHints: current.freeHints + (reward.type === 'hint' ? 1 : 0) + 1,
        shields: current.shields + 1,
        spins: current.spins + (spinOk ? 1 : 0),
      }
      w = unlockIf(w, 'stash')
      w = unlockIf(w, 'critter')
      persistWallet(w)
      freshBadgeIds(current, w).forEach((badgeId, i) => {
        const badge = BADGES.find((b) => b.id === badgeId)
        window.setTimeout(() => {
          sfxAchievement()
          showToast(`Badge unlocked: ${badge?.title ?? badgeId}`)
        }, 2600 + i * 2600)
      })
      setLives(runMaxLives)
      pushBanter('critter-stash')
      showToast(spinOk ? 'Sparkle mode unlocked! +1 spin — open Rewards to spin' : `Sparkle mode unlocked! Spin limit for today, so +${SPIN_CAPPED_COINS} coins instead`)
      return
    }

    let w: Wallet = { ...current, critterStash: have }
    w = unlockIf(w, 'critter')
    if (reward.type === 'coins') w.coins += reward.amount
    else if (reward.type === 'hint') w.freeHints += 1
    else if (reward.type === 'heart') setLives((n) => Math.min(runMaxLives, n + 1))
    persistWallet(w)
    freshBadgeIds(current, w).forEach((badgeId, i) => {
      const badge = BADGES.find((b) => b.id === badgeId)
      window.setTimeout(() => {
        sfxAchievement()
        showToast(`Badge unlocked: ${badge?.title ?? badgeId}`)
      }, 2600 + i * 2600)
    })

    const line = sparkProgressBanter(have, CRITTER_STASH_GOAL)
    if (line.text) showToast(line.text)
    if (line.speak && line.clip) playBanterClip(line.clip, line.voiceMood, line.alts, line.priority, line.waitMs)
  }

  function handleCreateChallenge() {
    const target = puzzle ?? PUZZLES[0]
    const clear = getProgress().clears.find((c) => c.puzzleId === target.id)
    const c = createChallenge({
      puzzleId: target.id,
      puzzleName: target.name,
      difficulty: DIFFICULTY_LABEL[target.difficulty],
      fromEmail: senderEmail(profile?.email),
      fromName: playerName || profile?.displayName || 'A friend',
      message: challengeMsg,
      toEmail: challengeEmail || undefined,
      scoreMs: clear?.bestMs,
      scorePts: clear?.bestScore,
      buddy: clear ? records.levels[target.id]?.buddy ?? null : undefined,
      badgePower: totalBadgePower(wallet),
      bonusPct: totalCoinBonusPercent(wallet),
    })
    addChallenge(c)
    setChallenges(loadChallenges())
    setShareChallenge(c)
    const link = encodeChallengeLink(c, target)
    setShareLink(link)
    const lv = records.levels[target.id]
    setShareText(
      clear
        ? scoreShareText({
            name: playerName,
            score: lv?.bestScore ?? clear.bestScore,
            levelLabel: levelLabelFor(target),
            stars: lv?.stars,
            timeMs: lv?.bestMs ?? clear.bestMs,
            buddy: lv ? petLabel(lv.buddy) : undefined,
          })
        : challengeShareText(c),
    )
    void navigator.clipboard?.writeText(link)
    showToast(
      clear
        ? `Challenge ready · ${target.name} · ${formatShareTime(clear.bestMs)} · ${badgeTitleForShare(wallet)}`
        : 'Challenge link ready — share below',
    )
  }

  /** Share this win as a scored challenge so a friend can beat your time */
  function shareWinAsChallenge(nameOverride?: string) {
    if (!puzzle || lastScore == null) return
    // First share: ask for a name (then share with it)
    if (nameOverride === undefined && askNameOnce(() => shareWinAsChallenge(cleanPlayerName(loadSettings().playerName)))) return
    const who = nameOverride ?? playerName
    const c = createChallenge({
      puzzleId: puzzle.id,
      puzzleName: puzzle.name,
      difficulty: DIFFICULTY_LABEL[puzzle.difficulty],
      fromEmail: senderEmail(profile?.email),
      fromName: who || profile?.displayName || 'A friend',
      scoreMs: elapsedMs,
      scorePts: lastScore,
      buddy: runPetRef.current,
      badgePower: totalBadgePower(wallet),
      bonusPct: totalCoinBonusPercent(wallet),
    })
    addChallenge(c)
    setChallenges(loadChallenges())
    setShareChallenge(c)
    const link = encodeChallengeLink(c, puzzle)
    setShareLink(link)
    const lv = records.levels[puzzle.id]
    setShareText(
      scoreShareText({
        name: who,
        score: lastScore,
        levelLabel: levelLabelFor(puzzle),
        stars: modeRef.current === 'normal' && lv ? lv.stars : undefined,
        timeMs: elapsedMs,
        newBest: winReplay?.banner?.kind === 'record',
        buddy: petLabel(runPetRef.current),
      }),
    )
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

  function challengeMailHref(url: string): string | undefined {
    const to = challengeEmail.trim()
    if (!shareChallenge && !to) return undefined
    const board = puzzle ?? PUZZLES[0]
    const base =
      shareChallenge ??
      createChallenge({
        puzzleId: board.id,
        puzzleName: board.name,
        difficulty: DIFFICULTY_LABEL[board.difficulty],
        fromEmail: senderEmail(profile?.email),
        fromName: playerName || profile?.displayName || 'A friend',
        message: challengeMsg,
        toEmail: to || undefined,
      })
    return mailtoChallenge(
      { ...base, toEmail: to || base.toEmail, message: challengeMsg || base.message },
      url,
    )
  }

  const done = new Set(progress.clears.map((c) => c.puzzleId))

  const hideChrome = screen === 'play' || screen === 'how'

  // Daily Challenge: same board for everyone on a Toronto date
  const todayKey = torontoDateKey()
  const dailyBoard = PUZZLES[dailyIndex(todayKey, PUZZLES.length)]
  const dailyToday = records.daily.days[todayKey]
  const dailyStreakNow = liveStreak(records.daily, todayKey)
  const dailyDateLabel = new Date(`${todayKey}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  function buildRemix(size: RemixSize, openAfter = false) {
    const set = remixSet
    const key = `${set}-${size}`
    if (remixJobsRef.current.has(key)) return
    remixJobsRef.current.add(key)
    setRemixBuilding((b) => [...b.filter((x) => x !== size), size])
    setRemixFailed((f) => f.filter((x) => x !== size))
    void buildRemixInBackground(set, size).then((p) => {
      remixJobsRef.current.delete(key)
      setRemixBuilding((b) => b.filter((x) => x !== size))
      if (!p) {
        setRemixFailed((f) => [...f.filter((x) => x !== size), size])
        return
      }
      saveRemixBoard(set, p)
      setRemixBoards((r) => (r.set === set ? { set, boards: { ...r.boards, [size]: p } } : r))
      if (openAfter && screenNowRef.current === 'remix') setStartSheet(p)
    })
  }

  function openRemix(size: RemixSize) {
    const p = liveRemix[size]
    if (p) setStartSheet(p)
    else buildRemix(size, true)
  }

  function startEndless(difficulty: Difficulty) {
    if (endlessBusy) return
    setEndlessBusy(difficulty)
    showToast('Making a fresh board…')
    void buildEndlessInBackground(difficulty).then((p) => {
      setEndlessBusy(null)
      const board = p ?? createFreshPuzzle(difficulty)
      rememberGeneratedPuzzle(board)
      startPuzzleRef.current(board, false, { endless: true })
    })
  }

  startPuzzleRef.current = startPuzzle

  const remixClearedCount = REMIX_SIZES.filter((sz) => records.levels[remixId(remixSet, sz)]?.bestMs != null).length
  const remixCard = (
    <section className="daily-card remix-entry" aria-label="Remix boards">
      <div className="daily-text">
        <strong>Remix boards</strong>
        <span>4 new boards every 3 days · same for everyone{remixClearedCount ? ` · ${remixClearedCount}/4 cleared` : ''}</span>
        <span className="daily-status">New boards in {remixCountdownLabel(remixMsLeft)} · plus Endless mode</span>
      </div>
      <button type="button" className="btn ghost daily-btn" data-open-remix onClick={() => setScreen('remix')}>
        Remix
      </button>
    </section>
  )

  const sheetTargets = startSheet ? targetsFor(startSheet) : null
  const sheetRec = startSheet ? records.levels[startSheet.id] : undefined
  const startSheetEl = startSheet && sheetTargets && createPortal(
            <div className="start-sheet" role="dialog" aria-modal="true" aria-label={`${startSheet.name}: start`}>
              <div className="start-sheet-scrim" onClick={() => setStartSheet(null)} />
              <div className="start-sheet-card">
                <h3>
                  {startSheet.name} <span className="start-sheet-stars">{starString(sheetRec?.stars ?? 0)}</span>
                </h3>
                <p className="start-sheet-meta">{DIFFICULTY_LABEL[startSheet.difficulty]} · {startSheet.size}×{startSheet.size}</p>
                <div className="start-sheet-bests">
                  <div>
                    <span>Best time</span>
                    <strong>{sheetRec?.bestMs != null ? formatMs(sheetRec.bestMs) : '—'}</strong>
                    {sheetRec?.bestMs != null ? <RunTag buddy={sheetRec.buddy ?? null} /> : null}
                  </div>
                  <div><span>Top score</span><strong>{sheetRec?.bestScore != null ? sheetRec.bestScore : '—'}</strong></div>
                </div>
                <ul className="start-sheet-goals">
                  <li className={(sheetRec?.stars ?? 0) >= 1 ? 'done' : ''}>★ Finish the board</li>
                  <li className={(sheetRec?.stars ?? 0) >= 2 ? 'done' : ''}>★★ Under {formatMs(sheetTargets.timeMs)}</li>
                  <li className={(sheetRec?.stars ?? 0) >= 3 ? 'done' : ''}>★★★ Under {formatMs(sheetTargets.timeMs)}, {sheetTargets.score3}+ pts, no undos</li>
                </ul>
                <p className="start-sheet-tip">Quick good moves build a combo. Each undo costs {UNDO_COST} pts.</p>
                <button type="button" className="btn primary" onClick={() => startPuzzle(startSheet)}>
                  {sheetRec?.bestMs != null ? 'Play · beat your best' : 'Play'}
                </button>
                {trialUnlocked(records, startSheet.id) ? (
                  <button type="button" className="btn trial-btn" onClick={() => startPuzzle(startSheet, false, { mode: 'trial' })}>
                    ⚔ Roman's Trial
                    <small>
                      {TRIAL_HEARTS} hearts · no undo · {formatMs(trialTimeLimitMs(sheetTargets))} clock · 2× coins
                      {sheetRec?.trial?.bestMs != null ? ` · best ${formatMs(sheetRec.trial.bestMs)}` : ''}
                    </small>
                  </button>
                ) : (
                  <p className="start-sheet-locked">⚔ Roman's Trial unlocks at 3 stars</p>
                )}
                <button type="button" className="btn ghost" onClick={() => setStartSheet(null)}>
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )

  const dailyCard = (
    <section className="daily-card" aria-label="Daily Challenge">
      <div className="daily-text">
        <strong>Daily Challenge · {dailyDateLabel}</strong>
        <span>
          {dailyBoard.name} · {dailyBoard.size}×{dailyBoard.size}
          {dailyStreakNow > 0 ? ` · 🔥 ${dailyStreakNow}-day streak` : ''}
        </span>
        <span className="daily-status">
          {dailyToday?.status === 'won'
            ? `Done today: ${formatMs(dailyToday.ms ?? 0)} · ${dailyToday.score ?? 0} pts. New board tomorrow.`
            : dailyToday
              ? 'First try used. Practice runs don’t score.'
              : 'Only your first try counts. Clear it to grow your streak.'}
        </span>
      </div>
      <button type="button" className={`btn ${dailyToday ? 'ghost' : 'primary'} daily-btn`} onClick={() => startPuzzle(dailyBoard, false, { daily: true })}>
        {dailyToday ? 'Practice' : 'Play daily'}
      </button>
    </section>
  )

  // Live ghost pace against your best (hidden until there is a best for this mode)
  const playBest = puzzle && hasRecords(puzzle.id) ? hasBest(records, puzzle.id, mode) : undefined
  let pace: { delta: number; ghost: number; mine: number } | null = null
  if (screen === 'play' && puzzle && playBest && !celebrate && !defeated) {
    const ghost = ghostSplits(playBest.bestMs!, puzzle.size, playBest.splits)
    const n = cleanBuddies(puzzle, cells)
    pace = { delta: paceDelta(splitsRef.current, ghost, n, elapsedMs), ghost: ghostProgress(ghost, elapsedMs), mine: n / puzzle.size }
  }
  const trialLeftMs = puzzle && mode === 'trial' ? Math.max(0, trialTimeLimitMs(targetsFor(puzzle)) - elapsedMs) : 0

  keysRef.current = { undo, redo, hint: onHint }

  return (
    <div
      className={`shell fixed-shell ${isStoreBuild() ? 'shell-native' : ''} ${screen === 'play' ? 'shell-play' : ''} ${screen === 'play' && celebrate && !showWheel ? 'shell-celebrate' : ''} ${hideChrome ? 'shell-immersive' : ''} shell-${screen}`}
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
            <button type="button" className={`nav-stable ${screen === 'stable' ? 'on' : ''}`} onClick={() => setScreen('stable')}>
              Stable
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

      {/* On a live board the toast text shows in the play caption slot instead (never over the board) */}
      {toast && (screen !== 'play' || celebrate || defeated) && <div className="toast">{toast}</div>}

      {namePrompt &&
        createPortal(
          <div className="start-sheet name-prompt" role="dialog" aria-modal="true" aria-label="Your name">
            <div className="start-sheet-scrim" />
            <form
              className="start-sheet-card"
              onSubmit={(e) => {
                e.preventDefault()
                closeNamePrompt(true)
              }}
            >
              <h3>What should we call you?</h3>
              <p className="start-sheet-tip">Your name goes on the scores you share, like “{cleanPlayerName(nameDraft) || 'Sam'} scored 1,840 on Level 1”. It stays on this device. You can change it later in Save &amp; settings.</p>
              <input
                className="name-input"
                type="text"
                value={nameDraft}
                maxLength={PLAYER_NAME_MAX + 8}
                placeholder="Your name"
                autoComplete="nickname"
                aria-label="Your name"
                onChange={(e) => setNameDraft(e.target.value.slice(0, PLAYER_NAME_MAX + 8))}
              />
              <button type="submit" className="btn primary" disabled={!cleanPlayerName(nameDraft)}>
                Save
              </button>
              <button type="button" className="btn ghost" onClick={() => closeNamePrompt(false)}>
                Skip (share as “I scored…”)
              </button>
            </form>
          </div>,
          document.body,
        )}

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
          <section className="hero no-callout">
            <p className="eyebrow">Logic puzzle</p>
            <h1 className="logo-hero no-callout" {...ownerDoor}>
              Roman
            </h1>
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
          <section className="home-pet-row" aria-label="Your buddy">
            <HomePet
              id={activePet(pets, petNow)}
              xp={(() => {
                const a = activePet(pets, petNow)
                return a ? petXp(pets, a) : 0
              })()}
              mood={(() => {
                const a = activePet(pets, petNow)
                return a && pets.owned[a] ? careInfo(pets, a, petNow, todayKey).kind : undefined
              })()}
              canPet={(() => {
                const a = activePet(pets, petNow)
                return !!a && !!pets.owned[a] && careInfo(pets, a, petNow, todayKey).canPet
              })()}
              onTap={() => petGiggle()}
              onStable={() => setScreen('stable')}
            />
          </section>
          {dailyCard}
          {remixCard}
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
          key={`how-${howStart}`}
          startAt={howStart}
          doneLabel={pendingStartRef.current ? "Let's play" : 'Choose a level'}
          onDone={() => {
            settingsRef.current = { ...settingsRef.current, howSeen: true }
            saveSettingsPatch({ howSeen: true })
            const pend = pendingStartRef.current
            pendingStartRef.current = null
            setHowStart(0)
            if (pend) startPuzzle(pend.p, false, pend.opts)
            else setScreen('levels')
          }}
          onBack={() => {
            settingsRef.current = { ...settingsRef.current, howSeen: true }
            saveSettingsPatch({ howSeen: true })
            pendingStartRef.current = null
            setHowStart(0)
            setScreen('home')
          }}
        />
      )}

      {screen === 'levels' && (
        <main className="panel levels scroll-pane">
          <h2>Levels</h2>
          <p className="sub">Beat your best time and score on any board. ★ finish · ★★ beat the target time · ★★★ target time, a high score and no undos. 3 stars unlocks Roman's Trial.</p>
          {dailyCard}
          {remixCard}
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
                  data-endless-level={diff}
                  disabled={endlessBusy != null}
                  onClick={() => startEndless(diff)}
                >
                  {endlessBusy === diff ? 'Making…' : 'Endless'}
                </button>
              </div>
              <div className="level-grid">
                {byDiff[diff].map((p) => {
                  const rec = records.levels[p.id]
                  const stars = rec?.stars ?? 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`level-card ${rec?.bestMs != null ? 'cleared' : ''}`}
                      data-level={p.id}
                      onClick={() => setStartSheet(p)}
                    >
                      <span className="lv-name">
                        {p.name}
                        <span className={`lv-stars s${stars}`} aria-label={`${stars} of 3 stars`}>{starString(stars)}</span>
                      </span>
                      <span className="lv-meta">
                        {p.size}×{p.size} · {THEMES[themeForPuzzle(p.id, p.difficulty)].label}
                        {rec?.bestMs != null ? ` · best ${formatMs(rec.bestMs)}` : ''}
                        {trialUnlocked(records, p.id) ? ' · ⚔ Trial' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {startSheetEl}
        </main>
      )}

      {screen === 'play' && puzzle && (
        <main className={`play play-fixed ${runPetRef.current ? 'has-hud-pet' : ''} ${THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].className}`}>
          <ThemeBackdrop themeId={puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)} />
          <div className="play-hud">
            <button type="button" className="hud-back" onClick={() => setScreen(parseRemixId(puzzle.id) || endlessRef.current ? 'remix' : 'levels')} aria-label="Back">
              ←
            </button>
            <div className="hud-title">
              <strong>{puzzle.name}</strong>
              <span>
                {mode === 'trial'
                  ? "⚔ Roman's Trial · 2× coins"
                  : dailyTag === 'scored'
                    ? 'Daily Challenge · first try'
                    : dailyTag === 'practice'
                      ? 'Daily practice'
                      : `${DIFFICULTY_LABEL[puzzle.difficulty]} · ${THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].label}`}
              </span>
            </div>
            <div className={`hud-stats ${pace ? 'has-pace' : ''}`}>
              <span className="lives" aria-label={`${lives} lives`}>
                {Array.from({ length: runMaxLives }, (_, i) => (
                  <i
                    key={i}
                    className={['heart', i < lives ? 'on' : '', i >= MAX_LIVES ? 'bonus' : '', heartPop === i ? 'pop' : '']
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
              </span>
              <span
                className={`hud-time ${pace ? (pace.delta <= 0 ? 'pace-ahead' : 'pace-behind') : ''} ${mode === 'trial' ? 'hud-countdown' : ''} ${mode === 'trial' && trialLeftMs <= 10000 ? 'is-low' : ''}`}
                data-pace={pace ? Math.round(pace.delta) : undefined}
              >
                {mode === 'trial' ? `⏳${formatMs(trialLeftMs)}` : formatMs(elapsedMs)}
                {pace ? <em className="hud-pace">{formatDelta(pace.delta)}</em> : null}
              </span>
              {dayPerk && !celebrate ? (
                <span className="hud-day" data-testid="hud-day" title={`Buddy of the day: ${dayPerk.pet ? petById(dayPerk.pet)?.name : 'Guest'} · board ${dayPerk.board} of 3`}>
                  ⭐ {dayShort(dayPerk.kind)} {dayPerk.board}/3
                </span>
              ) : null}
              <span className="hud-stash" title="Catch 5 sparks across games for a prize">
                ✨{(wallet.critterStash ?? 0)}/{CRITTER_STASH_GOAL}
              </span>
              {activeChallenge?.scoreMs != null && activeChallenge.scorePts != null ? (
                <span className="hud-rival" title={`${activeChallenge.fromName}'s score to beat`}>
                  ⚔ {activeChallenge.fromName} {formatShareTime(activeChallenge.scoreMs)}
                </span>
              ) : null}
            </div>
            {pace ? (
              <div className={`ghost-bar ${pace.delta <= 0 ? 'ahead' : 'behind'}`} aria-hidden="true">
                <i className="ghost-fill" style={{ width: `${Math.round(pace.ghost * 100)}%` }} />
                <i className="me-fill" style={{ width: `${Math.round(pace.mine * 100)}%` }} />
              </div>
            ) : null}
            {runPetRef.current ? (
              // 9.30-a: phones: the buddy perches by the HUD (absolute: the board never moves)
              <span className={`hud-pet ${celebrate ? 'is-cheer' : ''}`} data-hud-pet={runPetRef.current} aria-label={`${petById(runPetRef.current)?.name} is riding with you`}>
                <PetArt id={runPetRef.current} size={34} />
              </span>
            ) : null}
            {(() => {
              // Wide screens only (CSS): stars so far, goals and bests for this board
              if (!hasRecords(puzzle.id)) return null
              const tg = targetsFor(puzzle)
              const lv = records.levels[puzzle.id]
              const best = mode === 'trial' ? lv?.trial : lv
              const have = lv?.stars ?? 0
              return (
                <div className="hud-goal" aria-label="Goals for this board">
                  <p className="hud-goal-stars">
                    <span className="hud-goal-have">{starString(have)}</span>
                    <small>{have >= 3 ? 'All 3 stars' : `${have} of 3 stars`}</small>
                  </p>
                  <ul>
                    <li className={have >= 1 ? 'done' : ''}>★ Finish</li>
                    <li className={have >= 2 ? 'done' : ''}>★★ Under {formatMs(tg.timeMs)}</li>
                    <li className={have >= 3 ? 'done' : ''}>★★★ {tg.score3}+ pts, no undo</li>
                  </ul>
                  <p className="hud-goal-best">
                    Best {best?.bestMs != null ? formatMs(best.bestMs) : '—'} · {best?.bestScore != null ? `${best.bestScore} pts` : '—'}
                  </p>
                </div>
              )
            })()}
          </div>

          {/* Character lines, notices and hint text: a fixed two-line slot between the HUD and the
              board. Always takes its space (never reflows the board) and never overlaps it. */}
          {(() => {
            // Once the board is won or lost the global toast carries notices; don't echo them here too
            const liveToast = celebrate || defeated ? '' : toast
            return (
              <p className={`play-caption ${liveToast || hintText ? '' : 'is-empty'} ${liveToast ? 'is-voice' : ''}`} aria-live="polite">
                {liveToast || hintText}
              </p>
            )
          })()}

          <div className="board-stage">
            <Board
              puzzle={puzzle}
              cells={cells}
              onChange={onBoardChange}
              getCells={getLiveCells}
              version={boardVersion}
              hintIndex={hintIndex}
              giggleIndex={giggleIndex}
              celebrate={celebrate}
              defeated={defeated}
              disabled={celebrate || defeated}
              themeId={puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)}
            />
          </div>


          <div className="play-side">
          <div className="toolbar play-toolbar">
            <TapButton className="btn tool" onTap={undo} disabled={!history.length || celebrate || defeated || mode === 'trial'}>
              {mode === 'trial' ? 'No undo' : 'Undo'}
              <kbd className="kbd" aria-hidden="true">Z</kbd>
            </TapButton>
            <TapButton className="btn tool" onTap={redo} disabled={!future.length || celebrate || defeated || mode === 'trial'}>
              Redo
              <kbd className="kbd" aria-hidden="true">Y</kbd>
            </TapButton>
            <button type="button" className="btn tool" onClick={onHint} disabled={celebrate || defeated}>
              <span className="tool-label">Hint</span>
              <span className="tool-cost">
                {petFree.hints + wallet.freeHints > 0 ? `${petFree.hints + wallet.freeHints} free` : String(hintPrice(hintsUsed))}
              </span>
              <kbd className="kbd" aria-hidden="true">H</kbd>
            </button>
            <button
              type="button"
              className="btn tool"
              onClick={onRescue}
              disabled={celebrate || defeated}
              title={`Clear a misplaced buddy · ${rescuePrice(rescuesUsed)} coins`}
            >
              <span className="tool-label">Rescue</span>
              <span className="tool-cost">{petFree.rescues > 0 ? `${petFree.rescues} free` : rescuePrice(rescuesUsed)}</span>
            </button>
            <button type="button" className="btn tool" onClick={resetBoard}>
              Reset
            </button>
          </div>
          {/* Wide screens: the buddy riding along on this board (9.30-a) */}
          {(() => {
            const rp = runPetRef.current
            const def = rp ? petById(rp) : undefined
            if (!rp || !def) {
              return (
                <div className="buddy-spot is-solo" data-buddy-spot="solo">
                  <span className="buddy-spot-ring" aria-hidden="true">
                    <span className="buddy-spot-face" />
                  </span>
                  <strong>Solo run</strong>
                  <small>No buddy this board. Pick one in The Stable.</small>
                </div>
              )
            }
            const lv = levelInfo(petXp(pets, rp)).level
            return (
              <div className={`buddy-spot has-pet ${celebrate ? 'is-cheer' : ''}`} data-buddy-spot={rp}>
                <span className="buddy-spot-ring" aria-hidden="true">
                  <PetArt id={rp} size={70} />
                </span>
                <strong>{def.name}</strong>
                <small>
                  Lv {lv} · {activePerk({ ...pets, active: rp }, petNow)?.label ?? def.species}
                </small>
              </div>
            )
          })()}
          </div>
          <p className="build-tag" data-build={BUILD_TAG}>{BUILD_TAG}</p>

          <div className={`rotate-prompt ${rotatePaused ? 'is-on' : ''}`} role="dialog" aria-modal="true" aria-hidden={!rotatePaused} aria-label="Turn your phone upright">
            <div className="rotate-card">
              <span className="rotate-phone" aria-hidden="true">
                <span className="rotate-phone-screen" />
              </span>
              <h3>Turn your phone upright</h3>
              <p>Roman says: this board likes to stand tall. So do I.</p>
              <small>Paused — your board, hearts and time are saved.</small>
            </div>
          </div>

          <SparkCritter
            active={!celebrate && !defeated && !showWheel && !rotatePaused && sparksOpen(rollLedger(econ, torontoDateKey()))}
            stashCount={wallet.critterStash ?? 0}
            onCatch={handleCritterCatch}
          />

          {celebrate && showHunt && puzzle && (
            <BuddyHunt
              themeId={puzzle.theme ?? 'classic'}
              onFinish={finishBuddyHunt}
              onMiss={() => pushBanter('hunt-miss')}
              onClose={() => setShowHunt(false)}
              debug={import.meta.env.DEV}
            />
          )}
          {celebrate && !showWheel && !showHunt && (
            <WinScreen
              puzzleName={puzzle.name}
              difficultyLabel={DIFFICULTY_LABEL[puzzle.difficulty]}
              themeLabel={THEMES[puzzle.theme ?? themeForPuzzle(puzzle.id, puzzle.difficulty)].label}
              timeLabel={formatMs(elapsedMs)}
              score={lastScore ?? 0}
              hintsUsed={hintsUsed}
              livesLeft={lives}
              maxLives={runMaxLives}
              sparkCount={wallet.critterStash ?? 0}
              romanSaying={winLine || 'Roman says: Veni, vidi, vici!'}
              spins={wallet.spins}
              perfect={hintsUsed === 0}
              replay={winReplay ?? undefined}
              onNext={() => maybeParade(() => {
                // 9.30-i: Remix → the next uncleared board of the live set; Endless → another fresh board
                const rm = parseRemixId(puzzle.id)
                if (rm) {
                  const nxt = rm.set === remixSet ? nextRemixSize(rm.size, (s) => records.levels[remixId(rm.set, s)]?.bestMs != null) : null
                  const nb = nxt ? liveRemix[nxt] : undefined
                  if (nb) startPuzzle(nb)
                  else {
                    setScreen('remix')
                    if (nxt) buildRemix(nxt, true)
                  }
                  return
                }
                if (endlessRef.current) {
                  startEndless(endlessRef.current)
                  return
                }
                startPuzzle(pickNextBoard(puzzle, PUZZLES, getProgress().clears))
              })}
              onReplay={resetBoard}
              onLevels={() => setScreen('levels')}
              onHome={() => setScreen('home')}
              onSpin={showSpinPrize(wallet.spins, buddyMeter.pending, huntJustEarned) ? openPrizeWheel : undefined}
              buddyMeter={{
                notches: buddyMeter.notches,
                goal: BUDDY_HUNT_PERFECT_WINS,
                pending: buddyMeter.pending,
                perfect: winPerfect,
              }}
              onBuddyHunt={openBuddyHunt}
              onShare={() => shareWinAsChallenge()}
              onDuel={duel && activeChallenge?.puzzleId === puzzle.id ? openDuelShare : undefined}
            />
          )}

          {parade && (
            <ParadeOverlay
              buddies={parade.buddies}
              treasure={parade.treasure}
              featured={parade.featured}
              featuredKind={parade.featuredKind}
              onCatch={catchTreasure}
              durationMs={parade.ms}
              reduce={settings.reduceMotion}
              onDone={() => {
                const go = parade.go
                setParade(null)
                go()
              }}
            />
          )}

          {defeated && (
            mode === 'trial' ? (
              <ResultOverlay
                kind="lose"
                kicker={lives > 0 ? "Time's up" : 'Out of hearts'}
                title="Trial failed"
                romanLine={loseLine}
                primaryLabel="Try again"
                onPrimary={resetBoard}
                secondaryLabel="Levels"
                onSecondary={() => setScreen('levels')}
              />
            ) : (
              <ResultOverlay
                kind="lose"
                title="Rematch?"
                romanLine={loseLine}
                primaryLabel={`Revive · ${REVIVE_COST}`}
                onPrimary={revive}
                secondaryLabel="Try again"
                onSecondary={resetBoard}
              />
            )
          )}
        </main>
      )}

      {screen === 'remix' && (
        <>
          <RemixScreen
            set={remixSet}
            msLeft={remixMsLeft}
            boards={liveRemix}
            building={remixBuilding}
            failed={remixFailed}
            levelInfo={(id) => {
              const lv = records.levels[id]
              return lv ? { stars: lv.stars ?? 0, bestMs: lv.bestMs } : undefined
            }}
            formatMs={formatMs}
            starString={starString}
            onOpenBoard={openRemix}
            endless={endless}
            endlessBusy={endlessBusy}
            onEndless={startEndless}
          />
          {startSheetEl}
        </>
      )}

      {screen === 'stable' && (
        <Stable
          pets={pets}
          coins={wallet.coins}
          now={petNow}
          onBuy={onAdoptPet}
          onBuyBundle={onBuyBundle}
          onCare={onCarePet}
          onFeed={onFeedPet}
          today={todayKey}
          onEquip={onEquipPet}
          onPeek={onPeekGift}
          onRedeem={onRedeemGift}
          onShop={() => setScreen('rewards')}
          onBack={() => setScreen('home')}
          giftCode={giftPrefill}
          giftsOnline={!isStoreBuild()}
        />
      )}

      {screen === 'rewards' && (
        <main className="panel scroll-pane">
          <h2>Rewards</h2>
          <p className="sub">
            Unlock badges by playing, then spend coins to rank them up forever — each rank boosts coins on every win.
          </p>
          <button type="button" className="stable-entry" onClick={() => setScreen('stable')}>
            <span className="stable-entry-art" aria-hidden="true">
              <PetArt id="lupa" size={40} />
              <PetArt id="aquila" size={40} />
              <PetArt id="leo" size={40} />
            </span>
            <span>
              <strong>The Stable</strong>
              <small>Adopt a buddy with coins. Each one has a perk.</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <div className="stat-strip wallet-strip">
            <div><strong>{wallet.coins}</strong><span>coins</span></div>
            <div><strong>{wallet.freeHints}</strong><span>free hints</span></div>
            <div><strong>{wallet.shields}</strong><span>shields</span></div>
            <div><strong>{wallet.spins}</strong><span>spins</span></div>
            <div><strong>{wallet.bonusHearts ?? 0}</strong><span>bonus hearts</span></div>
            <div><strong>{totalBadgePower(wallet)}</strong><span>power</span></div>
            <div><strong>+{formatBonusPercent(totalCoinBonusPercent(wallet))}</strong><span>win bonus</span></div>
          </div>
          <div className="econ-card" data-testid="econ-card">
            {(() => {
              const t = ledgerSummary(rollLedger(econ, todayKey))
              return (
                <>
                  <span>
                    Today: full-pay wins <b>{t.winsFull}/{t.winsFullMax}</b> · sparks <b>{t.sparks}/{t.sparksMax}</b> · wheel spins earned <b>{t.spins}/{t.spinsMax}</b>
                  </span>
                  <small>{t.winsToday >= t.winsFullMax ? 'Busy day: wins pay a bit less now, and it all resets tomorrow (stars, records and buddy XP always count).' : 'Wins pay in full until 5 a day, then a bit less. It resets every midnight (Toronto).'}</small>
                </>
              )
            })()}
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={wallet.spins <= 0}
            onClick={openPrizeWheel}
          >
            {wallet.spins > 0 ? `Use a spin (${wallet.spins})` : 'Catch 5 sparks for a spin (1 a day)'}
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
            <label className="name-setting">
              Your name on shared scores
              <input
                type="text"
                value={settings.playerName ?? ''}
                maxLength={PLAYER_NAME_MAX}
                placeholder="Blank = “I scored…”"
                aria-label="Your name on shared scores"
                onChange={(e) => saveSettingsPatch({ playerName: e.target.value.slice(0, PLAYER_NAME_MAX), namePrompted: true })}
                onBlur={(e) => saveSettingsPatch({ playerName: cleanPlayerName(e.target.value) })}
              />
            </label>
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
                checked={settings.voiceTips !== false}
                onChange={(e) => saveSettingsPatch({ voiceTips: e.target.checked })}
              />
              Voice tips
            </label>
            <div className="heard-card" data-testid="heard-card">
              <div className="heard-head">
                Voice lines heard: <strong data-testid="heard-count">{heardInfo.heard} of {heardInfo.total}</strong>
              </div>
              <div className="heard-bar" aria-hidden>
                <span style={{ width: `${heardInfo.total ? Math.round((heardInfo.heard / heardInfo.total) * 100) : 0}%` }} />
              </div>
              <ul className="heard-voices">
                {heardInfo.voices.map((v) => (
                  <li key={v.name}>
                    {v.name}: {v.heard} of {v.total}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn ghost heard-reset"
                onClick={() => {
                  if (window.confirm('Reset the voice lines heard counter? Every line counts as new again.')) {
                    heardLog.reset()
                    setHeardTick((n) => n + 1)
                  }
                }}
              >
                Reset heard lines
              </button>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.parade !== false}
                onChange={(e) => saveSettingsPatch({ parade: e.target.checked })}
              />
              Buddy Parade (every 5-7 wins)
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
            emailHref={challengeMailHref(shareLink || playUrl)}
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
                  {incoming.buddy !== undefined ? <RunTag buddy={incoming.buddy} /> : null}
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
                  if (!p) {
                    setLinkBoardError(MISSING_BOARD)
                    showToast(MISSING_BOARD)
                    return
                  }
                  setLinkBoardError('')
                  setActiveChallenge(incoming)
                  startPuzzle(p)
                }}
              >
                Accept — beat their score
              </button>
              {linkBoardError ? <p className="link-board-error">{linkBoardError}</p> : null}
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
              <ShareBar
                url={shareLink}
                text={shareText || challengeMsg}
                emailHref={challengeMailHref(shareLink)}
                onCopied={() => showToast('Copied')}
              />
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
                if (!p) {
                  setLinkBoardError(MISSING_BOARD)
                  showToast(MISSING_BOARD)
                  return
                }
                setLinkBoardError('')
                startPuzzle(p)
              }}
            >
              Play this board
            </button>
            {linkBoardError ? <p className="link-board-error">{linkBoardError}</p> : null}
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
        <span>
          Roman's Game <span className="build-tag build-tag-foot">{BUILD_TAG}</span>
        </span>
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

/** 9.30-a: records and challenges show the buddy used, or a Solo badge */
function RunTag({ buddy }: { buddy: string | null }) {
  const p = petById(buddy)
  return p ? (
    <span className="run-tag has-pet" data-run-buddy={p.id} title={`with ${p.name} the ${p.species}`}>
      <PetArt id={p.id} size={18} /> {p.name}
    </span>
  ) : (
    <span className="run-tag is-solo" data-run-buddy="solo">
      Solo
    </span>
  )
}
