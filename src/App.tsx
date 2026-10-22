import { useTapCount } from './components/useTapCount'
import { loadAnon, openEvents, sendPing, PRIVACY_NOTE, ANON_KEY, gaEvent, setGaEnabled } from './game/analytics'
import { OWNER_PATH, OWNER_TAP_WINDOW_MS, OWNER_TAPS } from './game/ownerDoor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Board } from './components/Board'
import { HowToPlay } from './components/HowToPlay'
import { BugReport } from './components/BugReport'
import { PrizeWheel } from './components/PrizeWheel'
import { ResultOverlay } from './components/ResultOverlay'
import { WinScreen, type WinReplay } from './components/WinScreen'
import { type ShortfallAction } from './components/ShortfallSheet'
import { ShortfallSheetHost } from './components/ShortfallSheetHost'
import { OfflineBuyButton } from './components/CoinPackCard'
import { HelpMark } from './components/HelpMark'
import { LegalLine } from './components/LegalLine'
import { formatCad, formatStarterLadder, savingsCents, SHOP_OFFERS, shopOfferById } from './game/shopOffers'
import { coinStackDiscs, formatPackCoins } from './game/coinPackDisplay'
import './styles/store-layer.css'
import { ShareBar } from './components/ShareBar'
import { QuietToast } from './components/QuietToast'
import { SyncNote } from './components/SyncNote'
import { PlayNudge } from './components/PlayNudge'
import { InboxButton, InboxScreen } from './components/InboxScreen'
import { AccountSocial, PlayerChip } from './components/AccountSocial'
import { SparkCritter, CRITTER_STASH_GOAL, type CritterReward } from './components/SparkCritter'
import { BuddyFlyby, type FlybyReward } from './components/BuddyFlyby'
import { TreatDefense } from './components/TreatDefense'
import { UnseenPopup, type UnseenPop } from './components/UnseenPopup'
import { KeyboardNameSheet, useKeyboardNameEntry } from './components/KeyboardNameSheet'
/* PR #53 batch 2 (Tony 2026-10-19): the Unseen as guide character + silent pet pop-outs */
import { UnseenGuide, PetPopout, type GuideItem, type PetPopoutInfo } from './components/UnseenGuide'
import { HomeUnseenReminder } from './components/UnseenReminder'
import { CloudScoresButton, useCloud } from './cloud/CloudScores'
import { Leaderboard } from './cloud/Leaderboard'
import { NAME_MAX, getSupabase, initCloud, loadPublicScores, renamePlayer, saveScore, scoreSaveLabel, signOut as cloudSignOut } from './cloud/cloud'
import { noteWalletCoins, type CoinMeta } from './social/coins'
import { armRound, isFriend, noteRoundScore, sendChallenge, sendLive, setPlaying, startSocial, type InboxItem } from './social/hub'
import { setQuietRound } from './game/quietQueue'
import { cloudModeForWin } from './game/scoreMode'
import { leaderboardTease, loadBoardSeen, saveBoardSeen } from './game/leaderboardTease'
import { isProfane } from './cloud/profanity'
import { UnseenCardTile } from './components/UnseenCard'
import { noteCardWin, localCard, CARD_PIECES } from './game/unseenCard'
import { guideCandidates, guideVoiceClip, petPopoutPick, type GuideTarget } from './game/unseenGuide'
import { ThemeBackdrop } from './components/ThemeBackdrop'
import { TapButton } from './components/TapButton'
import { BuddyHunt } from './components/BuddyHunt'
import { PetArt } from './components/PetArt'
import { Stable } from './components/Stable'
import { RemixScreen } from './components/RemixScreen'
import { StatsPopup } from './components/StatsPopup'
import {
  nextRemixSize,
  parseRemixId,
  REMIX_SIZES,
  remixCountdownLabel,
  remixEndsAtMs,
  remixId,
  remixSetNow,
  REMIX_DAYS,
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
  parseLocalGiftCode,
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
  claimFreePet,
  couponFor,
  earnFieldTreats,
  claimFieldTreats,
  swapTreatsToCoins,
  SNACK_COIN_RATE,
  jackpotFieldTreats,
  lockedForSale,
  MAX_FIELD_TREATS,
  moodKind,
  moodNow,
  priceWith,
  TREATS,
  stealFieldTreats,} from './game/pets'
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
import { loadParade, paradeDone, paradeHint, paradeLengthMs, paradeReady, paradeWin, saveParade, type ParadeState } from './game/parade'
import { ParadeOverlay, type ParadeBuddy } from './components/ParadeOverlay'
import { makeCappedTreasure, makeTreasure, type Treasure } from './game/paradeTreasure'
import {
  canEarnSpin,
  treasureBudget,
  treasureLeftPct,
  hintPrice,
  huntPct,
  ledgerSummary,
  noteParadeGain,
  paradeRewardsLine,
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
  dailyBoardForKey,
  dailyCoins,
  dailyIndex,
  dailyNumber,
  dailyShareText,
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
  resetBestTime,
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
  boardKindNote,
  challengeShareText,
  createChallenge,
  createDuelResult,
  duelShareText,
  duelWinner,
  encodeChallengeLink,
  encodeDuelLink,
  packBoardLayout,
  registerSharedBoard,
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
  getPlayerName,
  isUnsetAccountName,
  rememberPlayerName,
  PLAYER_NAME_MAX,
  PLAYER_NAME_EVENT,
  loadBuddyMeter,
  loadPets,
  savePets,
  loadRecords,
  loadEndless,
  loadRemixBoards,
  noteEndlessClear,
  rememberGeneratedPuzzle,
  rememberSharedPuzzle,
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
  type Settings,
} from './game/storage'
import {
  playBanterClip,
  playVoice,
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
import { isComputerPlayer } from './game/lineCaption'
import { purchaseCoinPack, restorePurchases, isStoreBuild, subscribeStore, type CoinPackId } from './game/iap'
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

/**
 * 9.32-f: styles for the App-wired menu additions (streak chip + remix/endless button stack).
 * Kept here because the 9.32-f task scope is App.tsx only.
 */
const MENU_CSS = `
.remix-entry-btns { display: grid; gap: 0.4rem; flex: 0 0 auto; }
.daily-streakbtn {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(255, 209, 102, 0.55);
  background: rgba(255, 159, 67, 0.14);
  color: #ffd166;
  border-radius: 999px;
  padding: 0.28rem 0.7rem;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}
.daily-streakbtn:active { transform: scale(0.96); }
`

function anyHungryPet(pets: PetState, now: number): boolean {
  return (Object.keys(pets.owned) as PetId[]).some((id) => moodKind(moodNow(pets.owned[id], now)) === 'hungry')
}

/** A treat, a buddy, or a badge upgrade they can pay for from Home. A 15-coin hint does not count. */
function canSpendCoins(coins: number, pets: PetState, wallet: Wallet, now: number): boolean {
  const today = torontoDateKey(new Date(now))
  const snack = TREATS.find((t) => t.id === 'snack')?.cost ?? 30
  const canTreat =
    coins >= snack &&
    (Object.keys(pets.owned) as PetId[]).some((id) => {
      const info = careInfo(pets, id, now, today)
      return !info.maxed && info.feedsLeft > 0
    })
  const buddy = lockedForSale(pets, now)[0]
  const canBuddy = !!buddy && coins >= priceWith(buddy.price, couponFor(pets, buddy.id, now))
  const power = totalBadgePower(wallet)
  const canBadge = BADGES.some((b) => {
    const rank = badgeRank(wallet, b.id)
    return rank >= 1 && coins >= upgradeBadgeCost(b.id, rank, power)
  })
  return canTreat || canBuddy || canBadge
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [navOpen, setNavOpen] = useState(false)
  const [convertAsk, setConvertAsk] = useState(false)
  const [{ layout }, setLayoutInfo] = useState(() => readLayout())
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const cloud = useCloud()
  const [progress, setProgress] = useState(() => getProgress())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  // Level select difficulty tab — persisted so it survives reloads
  const [levelTab, setLevelTab] = useState<Difficulty>(() => {
    const saved = (() => {
      try { return localStorage.getItem('rg-level-tab') } catch { return null }
    })()
    return saved === 'easy' || saved === 'medium' || saved === 'hard' || saved === 'expert' ? saved : 'easy'
  })
  const pickLevelTab = (d: Difficulty) => {
    setLevelTab(d)
    try { localStorage.setItem('rg-level-tab', d) } catch { /* private mode */ }
  }
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // 9.30-r: anonymous app_open / return_visit ping (silent if offline; off when the player switches it off or in the store apps)
  // 9.32: player accounts + score saving (lazy, never blocks the game)
  useEffect(() => {
    void initCloud()
    startSocial()
  }, [])
  useEffect(() => {
    setGaEnabled(!isStoreBuild() && settingsRef.current.analytics !== false)
    if (isStoreBuild() || settingsRef.current.analytics === false) return
    const ls = safeLocalStorage()
    const today = torontoDateKey()
    const o = openEvents(loadAnon(ls), today)
    try {
      ls?.setItem(ANON_KEY, JSON.stringify(o.next))
    } catch {
      /* ignore */
    }
    for (const ev of o.events) sendPing({ id: o.next.id, ev })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Layout class on <html> (CSS picks upright / wide / sideways-phone from it)
  useEffect(() => {
    const apply = () => {
      const next = readLayout()
      document.documentElement.dataset.layout = next.layout
      document.documentElement.dataset.device = next.device
      document.documentElement.dataset.voiceDevice = isComputerPlayer() ? 'computer' : 'phone'
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
  /** Set when a board is won or lost. Home reads it once, then a new board clears it. */
  const afterGameRef = useRef(false)
  const [winLine, setWinLine] = useState('')
  const [loseLine, setLoseLine] = useState('')
  const [lives, setLives] = useState(MAX_LIVES)
  /** Hearts this board started with: 3, or 4 when a saved bonus heart was used */
  const [runMaxLives, setRunMaxLives] = useState(MAX_LIVES)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  // 10.06: Unseen heckler pop-up — visual only, shown ONLY for Unseen
  // voice lines (old_* / tip_*_old_* clips), never for Roman or the Coach
  const [unseenPop, setUnseenPop] = useState<UnseenPop | null>(null)
  const unseenKey = useRef(0)
  /** The Unseen clip ids: `old_*`, plus tips like `tip_trial_old_life`. Roman is `roman_*`/`tip_*_roman_*`, Coach is `coach_*`/`tip_*_coach_*`. */
  function isUnseenClip(clip: string | undefined): boolean {
    if (!clip) return false
    return clip.startsWith('old_') || (clip.startsWith('tip_') && clip.includes('_old_'))
  }
  /** A board the player is still solving. Win, lose, and menus are not active play. */
  function liveBoard(): boolean {
    return screen === 'play' && running && !celebrate && !defeated
  }
  function maybeUnseenPop(line: { text?: string; clip?: string; speak?: boolean; silent?: boolean; voiceMood?: Parameters<typeof playBanterClip>[1]; alts?: readonly string[]; priority?: number; waitMs?: number }) {
    // Allowed moments only: callers already passed the voice gate (between turns, not mid-gesture).
    if (!line.speak || line.silent || !line.text || !line.clip || !isUnseenClip(line.clip)) return
    playBanterClip(line.clip, line.voiceMood ?? 'neutral', line.alts, line.priority, line.waitMs)
    // The line still plays. The corner pop-up stays off until the board is finished.
    if (liveBoard()) return
    unseenKey.current += 1
    setUnseenPop({ text: line.text, key: unseenKey.current, clip: line.clip })
  }
  const teaseTimer = useRef(0)
  const teaseGen = useRef(0)
  /** After a scored win, once the cheer has had its say. Never during a live board. Text only. */
  function scheduleLeaderboardTease(score: number, timeSeconds: number, mode: string) {
    const you = playerName.trim()
    if (cloud.status !== 'signed-in' || !you) return
    window.clearTimeout(teaseTimer.current)
    const gen = ++teaseGen.current
    teaseTimer.current = window.setTimeout(() => {
      if (boardOverRef.current !== 'won') return
      void loadPublicScores().then((rows) => {
        if (gen !== teaseGen.current || boardOverRef.current !== 'won' || !rows) return
        const seen = loadBoardSeen(you)
        const tease = leaderboardTease({
          you,
          score,
          timeSeconds,
          mode,
          rows,
          previousRank: seen?.rank ?? null,
          lastSituation: seen?.situation ?? null,
        })
        if (!tease.text || !tease.situation || boardOverRef.current !== 'won') return
        if (tease.rank != null) saveBoardSeen(you, tease.rank, tease.situation)
        const clip = `old_tease_${tease.situation}`
        playVoice(clip, { priority: 2, waitMs: 500 })
        unseenKey.current += 1
        setUnseenPop({ text: tease.text, key: unseenKey.current, clip })
      })
    }, 7500)
  }
  // The Unseen as guide. Each line uses an existing recording. A guide with no clip stays hidden.
  // Appearing never touches the timer.
  const [guide, setGuide] = useState<GuideItem | null>(null)
  const [petPop, setPetPop] = useState<PetPopoutInfo | null>(null)
  const guideKey = useRef(0)
  const petPopKey = useRef(0)
  // Frequency caps (per session): max 1 warning, max 1 opportunity, progress
  // tags once each; never interrupt the same board twice (boardSeqRef below).
  const guideWarnShownRef = useRef(false)
  const guideOppShownRef = useRef(false)
  const guideProgressFiredRef = useRef<Set<string>>(new Set())
  const petPopFiredRef = useRef<Set<PetId>>(new Set())
  const boardSeqRef = useRef(0)
  const guideBoardRef = useRef(-1)
  /** Don't stack notifications: at least 45 s between guide/pop-out appearances. */
  const guideLastAtRef = useRef(0)
  // PR #53 batch 2: deep-link target for the guide / pet pop-out — opens the
  // Stable with a specific pet's detail page selected.
  const [stableFocus, setStableFocus] = useState<{ id: PetId; key: number } | null>(null)
  const stableFocusKey = useRef(0)
  function goGuideTarget(t: GuideTarget) {
    if (t.pet) {
      stableFocusKey.current += 1
      setStableFocus({ id: t.pet, key: stableFocusKey.current })
    }
    setScreen(t.screen)
  }
  const [shortfall, setShortfall] = useState<null | { action: ShortfallAction; need: number; detail?: string }>(null)
  const [incoming, setIncoming] = useState<Challenge | null>(null)
  const [, setChallenges] = useState(() => loadChallenges())
  const [nameField, setNameField] = useState('')
  const [editingName, setEditingName] = useState(false)
  const nameFocus = useRef(false)
  const [, setStorePrices] = useState<Record<string, string>>({})
  const [webPacks, setWebPacks] = useState<WebPackOffer[] | null>(null)
  const [starterOwned, setStarterOwned] = useState(() => {
    try {
      return localStorage.getItem('roman.shop.starter') === '1'
    } catch {
      return false
    }
  })
  const [helpFocus, setHelpFocus] = useState('')
  const [webShop, setWebShop] = useState<'loading' | 'ready' | 'unavailable'>('loading')
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
  const paradeCountedRef = useRef(false)
  const paradeRef = useRef<ParadeState>(loadParade(typeof window === 'undefined' ? null : safeLocalStorage()))
  const [parade, setParade] = useState<{
    buddies: ParadeBuddy[]
    ms: number
    go: () => void
    treasure: (Treasure | undefined)[]
    featured: PetId | null
    featuredKind: DayPerkKind
    capped?: boolean
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
  /** Stable id for the win currently on screen, so that result is saved once. */
  const winSaveKeyRef = useRef<string | null>(null)
  /** Latest board plus undo/redo stacks. Updated on every move, not on the next render. */
  const historyRef = useRef(createHistory([] as CellState[]))
  /** Bumped whenever the board is replaced rather than drawn on (Undo, Redo, Reset, new or resumed board). */
  const [boardVersion, setBoardVersion] = useState(0)
  /** The history step the current board stroke recorded; later changes of that stroke amend it. */
  const strokeStepRef = useRef<{ stroke: number; hist: ReturnType<typeof createHistory> } | null>(null)

  // ---- Replay challenge: bests, ghost pace, combo/undo scoring, stars, Trial, Daily ----
  const [records, setRecords] = useState<RecordsBlob>(() => loadRecords(catalogBoard))
  const [cardGain, setCardGain] = useState<{ from: number; to: number } | null>(null)
  /** 9.32-f: the stats popup over the daily card (streak tap) */
  const [showStats, setShowStats] = useState(false)
  /** 9.32-f: the last daily win — drives the Wordle-style daily share text */
  const [lastDailyWin, setLastDailyWin] = useState<{ key: string; streak: number } | null>(null)
  const [mode, setMode] = useState<RunMode>('normal')
  const modeRef = useRef<RunMode>('normal')
  /** Today's date key while this attempt is the scored (first) Daily try */
  const dailyRunRef = useRef<string | null>(null)
  const [dailyTag, setDailyTag] = useState<'' | 'scored' | 'practice'>('')
  const practiceRef = useRef(false)
  practiceRef.current = dailyTag === 'practice'
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
  // One name everywhere: account (public name, then chosen name), then this device, then the old profile.
  const playerName = getPlayerName({
    publicName: cloud.publicName,
    name: cloud.name,
    playerName: settings.playerName,
    displayName: profile?.displayName,
  })
  const signedIn = cloud.status === 'signed-in'
  const [namePrompt, setNamePrompt] = useState<null | { then?: () => void }>(null)
  const [nameDraft, setNameDraft] = useState('')
  const touchName = useKeyboardNameEntry()
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
      if (sessionId.startsWith('cs_live_')) {
        showToast('Live checkout is not turned on yet.')
        return
      }
      if (mod.wasCheckoutRedeemed(sessionId)) {
        showToast('Those coins are already in your wallet.')
        clean()
        return
      }
      const sb = await getSupabase()
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined
      if (!token) {
        showToast('Sign in so this purchase can be saved to your account.')
        return
      }
      const result = await mod.claimWebCredit(sessionId, token)
      if (cancelled) return
      if (!result.ok) {
        showToast(result.reason)
        return
      }
      clean()
      mod.rememberCheckoutRedeemed(sessionId)
      if (result.duplicate) {
        showToast('That purchase is already in your account.')
        return
      }
      applyShopGrant(result.offerId, result.coins, result.treats, result.pets)
      sfxCoin()
      showToast(`Added ${result.label}`)
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
    function openFromHash() {
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
    }
    openFromHash()
    window.addEventListener('rg-open-hash', openFromHash)
    return () => window.removeEventListener('rg-open-hash', openFromHash)
  }, [])

  // A phone turned sideways during a board: the "turn upright" overlay covers the board and the clock
  // waits (board, hearts, combo and history are untouched).
  // Only while a board is live: the win / lose screens and Buddy Hunt still show sideways
  const rotatePaused = screen === 'play' && layout === 'phone-sideways' && !celebrate && !defeated
  const rotatePausedRef = useRef(false)
  useEffect(() => {
    const was = rotatePausedRef.current
    rotatePausedRef.current = rotatePaused
    if (!was && rotatePaused) playVoice('narrator_rotate', { priority: 3, waitMs: 500 })
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
    // 9.30-n: count the REAL time between ticks (a busy phone delays ticks; adding a fixed 250 ms
    // per tick made clocks run slow and saved times far too low). One tick never counts more than
    // 1 s, so a tab sent to the background pauses the clock instead of adding minutes.
    let last = performance.now()
    tickRef.current = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(1000, Math.max(0, now - last))
      last = now
      setElapsedMs((e) => e + dt)
    }, 250)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [running, rotatePaused])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

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
    afterGameRef.current = true
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

  // The Unseen aside: if nobody has held the voice channel for a while, he drops a random remark.
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
    if (isUnseenClip(line.clip)) maybeUnseenPop(line)
    else playBanterClip(line.clip, line.voiceMood, line.alts, line.priority, line.waitMs)
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
      if (isUnseenClip(line.clip)) maybeUnseenPop(line)
      else playBanterClip(line.clip, line.voiceMood, line.alts, line.priority, line.waitMs)
      boardTipsRef.current = [...boardTipsRef.current, id]
      lastTipAtRef.current = now
      persistTips(noteShown(tipsRef.current, id, now))
      return true
    } catch {
      return false
    }
  }

  /** 9.30-r: anonymous level_clear ping */
  function analyticsClear(size: number, ms: number) {
    if (isStoreBuild() || settingsRef.current.analytics === false) return
    sendPing({ id: loadAnon(safeLocalStorage()).id, ev: 'level_clear', size, ms: Math.round(ms) })
  }

  function saveSettingsPatch(patch: Partial<Settings>) {
    if (patch.analytics !== undefined) setGaEnabled(patch.analytics !== false)
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
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    const name = save ? cleanPlayerName(nameDraft) : ''
    if (name) {
      rememberPlayerName(name)
      setSettings(loadSettings())
      setProfile(loadProfile())
      if (cloud.status === 'signed-in') void renamePlayer(name)
    } else {
      saveSettingsPatch({ namePrompted: true })
    }
    const then = namePrompt?.then
    setNamePrompt(null)
    if (then) window.setTimeout(then, 0)
  }

  useEffect(() => {
    const sync = () => {
      setSettings(loadSettings())
      setProfile(loadProfile())
    }
    window.addEventListener(PLAYER_NAME_EVENT, sync)
    return () => window.removeEventListener(PLAYER_NAME_EVENT, sync)
  }, [])

  // A chosen account name is the one name. A default like "Roman's Game official" gives way
  // to the name already on this device, and that name is saved onto the account.
  const adoptingName = useRef('')
  useEffect(() => {
    if (cloud.status !== 'signed-in') return
    const account = cleanPlayerName(cloud.publicName) || cleanPlayerName(cloud.name)
    const local = cleanPlayerName(loadSettings().playerName) || cleanPlayerName(loadProfile()?.displayName)
    if (account && isUnsetAccountName(account) && local && local.toLowerCase() !== account.toLowerCase()) {
      if (adoptingName.current === local) return
      adoptingName.current = local
      void renamePlayer(local)
      return
    }
    adoptingName.current = ''
    if (!account || isUnsetAccountName(account)) return
    const settingsNow = loadSettings()
    const profileNow = loadProfile()
    if (settingsNow.playerName === account && (!profileNow || profileNow.displayName === account)) return
    rememberPlayerName(account)
  }, [cloud.status, cloud.publicName, cloud.name])

  useEffect(() => {
    if (nameFocus.current) return
    setNameField(playerName)
  }, [playerName])

  async function commitName(raw: string) {
    const name = cleanPlayerName(raw).slice(0, NAME_MAX)
    if (!name) return
    if (isProfane(name)) {
      showToast("Let's pick a different name. Keep it friendly!")
      return
    }
    rememberPlayerName(name)
    setSettings(loadSettings())
    setProfile(loadProfile())
    if (cloud.status !== 'signed-in') {
      showToast(`Name saved: ${name}`)
      return
    }
    const r = await renamePlayer(name)
    if (!r.ok) showToast(r.error || "Couldn't update your name")
    else showToast(`Name saved: ${r.publicName || name}`)
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

  function persistWallet(next: Wallet, meta?: CoinMeta) {
    const prev = loadWallet()
    setWallet(next)
    saveWallet(next)
    noteWalletCoins(prev, next, meta)
  }

  useEffect(() => {
    const playing = screen === 'play' && !celebrate && !defeated
    setPlaying(playing)
    setQuietRound(playing)
  }, [screen, celebrate, defeated])

  useEffect(() => {
    const onReject = (event: Event) => {
      const detail = (event as CustomEvent<{ balance?: number | null; cost?: number; undo?: { badgeRanks?: Wallet['badgeRanks']; pets?: PetState | null }; note?: string }>).detail
      const current = loadWallet()
      const coins = typeof detail?.balance === 'number' ? detail.balance : current.coins + (Number(detail?.cost) || 0)
      const next: Wallet = { ...current, coins, ...(detail?.undo?.badgeRanks ? { badgeRanks: detail.undo.badgeRanks } : {}) }
      setWallet(next)
      saveWallet(next)
      if (detail?.undo?.pets) persistPets(detail.undo.pets)
      showToast(detail?.note || 'We put the coins back and locked that item.')
    }
    const onBalance = (event: Event) => {
      const balance = (event as CustomEvent<{ balance?: number }>).detail?.balance
      if (typeof balance !== 'number') return
      const current = loadWallet()
      if (current.coins === balance) return
      const next = { ...current, coins: balance }
      setWallet(next)
      saveWallet(next)
    }
    window.addEventListener('rg-coin-reject', onReject)
    window.addEventListener('rg-balance', onBalance)
    return () => {
      window.removeEventListener('rg-coin-reject', onReject)
      window.removeEventListener('rg-balance', onBalance)
    }
  }, [])

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

  /** Safe-stash snacks only. Field treats and feasts stay. Coins never leave the game. */
  function confirmConvertTreats() {
    const n = pets.treats.snack ?? 0
    const r = swapTreatsToCoins(pets, wallet.coins, n)
    setConvertAsk(false)
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistPets(r.state)
    persistWallet({ ...wallet, coins: r.coins })
    showToast(`${r.swapped} snacks became ${r.gained} coins.`)
  }

  /** 9.30-d: hidden way to the owner page: 7 quick taps on the home title within 3 s (still needs the passphrase) */
  const ownerDoor = useTapCount(OWNER_TAPS, OWNER_TAP_WINDOW_MS, () => window.location.assign(OWNER_PATH), !isStoreBuild())

  /** 9.30-a: buddy actions from The Stable */
  function onAdoptPet(id: PetId) {
    const now = Date.now()
    const w = loadWallet()
    const beforePets = loadPets()
    const r = buyPet(beforePets, w.coins, id, now)
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistWallet({ ...w, coins: r.coins }, { itemType: 'pet', itemId: id, undoPets: beforePets })
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const p = petById(id)!
    showToast(`${p.name} the ${p.species} joined your Stable!${r.coupon ? ` (${r.coupon.pct}% coupon used)` : ''}`)
  }

  /** 10.06: claim the one free welcome buddy */
  function onClaimFreePet(id: PetId) {
    const now = Date.now()
    const r = claimFreePet(loadPets(), id, now)
    if (!r.ok) {
      showToast(r.reason)
      return
    }
    persistPets(r.state)
    sfxCoin()
    petGiggle()
    const p = petById(id)!
    showToast(`🎉 ${p.name} the ${p.species} joined your Stable — FREE!`)
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
    // 10.06: local gift codes (backend-free) decode directly
    const local = parseLocalGiftCode(code)
    if (local) return { ok: true, message: '', gift: local.gift, note: local.note, code }
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
    // 10.06: local gift codes (backend-free) decode and apply directly
    const local = parseLocalGiftCode(code)
    if (local) {
      const w = loadWallet()
      const out = applyGift(loadPets(), w.coins, local.gift, code, Date.now(), local.note)
      persistPets(out.state)
      if (out.coins !== w.coins) persistWallet({ ...w, coins: out.coins })
      sfxCoin()
      petGiggle()
      showToast(out.message)
      return { ok: true, message: out.message }
    }
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
    if (!paradeReady(paradeRef.current)) return go()
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
    const budget = treasureBudget(ledP)
    const treasureOk = budget > 0
    paradeCountedRef.current = !treasureOk // a capped parade never uses up another treasure parade
    setParade({
      buddies,
      ms: paradeLengthMs(),
      go,
      treasure: treasureOk ? makeTreasure(buddies.length, Math.random, budget, canEarnSpin(ledP)) : makeCappedTreasure(buddies.length),
      capped: !treasureOk,
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
  function catchTreasure(t: Treasure): Treasure {
    const cur = loadWallet()
    const next = { ...cur }
    let real: Treasure = t
    let led = ledgerNow()
    if (t.kind === 'coins') next.coins += t.amount
    else if (t.kind === 'hint') next.freeHints += 1
    else if (canEarnSpin(led)) {
      next.spins += 1
      led = { ...led, spins: led.spins + 1 }
    } else {
      next.coins += SPIN_CAPPED_COINS
      real = { kind: 'coins', amount: SPIN_CAPPED_COINS }
      showToast(`Spin limit for today: +${SPIN_CAPPED_COINS} coins instead`)
    }
    // 9.30-p: the parade counts against the 3-a-day limit once something is really caught, and the Rewards card lists it
    const potWorth = real.fallback ? 0 : real.kind === 'coins' ? real.amount : real.kind === 'hint' ? 15 : 38 // the small +2 tap prize is not taken from the pot
    led = noteParadeGain(led, { coins: real.kind === 'coins' ? real.amount : 0, hints: real.kind === 'hint' ? 1 : 0, spins: real.kind === 'spin' ? 1 : 0, pot: potWorth }, !paradeCountedRef.current)
    paradeCountedRef.current = true
    commitLedger(led)
    persistWallet(next)
    try {
      sfxCoin()
    } catch {
      /* iOS audio not unlocked: the coins are already paid */
    }
    return real
  }

  function startPuzzle(p: Puzzle, resume = false, opts: { mode?: RunMode; daily?: boolean; endless?: boolean } = {}) {
    // 2026-10-19: No auto-tutorial. Play goes straight to the game.
    // A new board is live play: drop a scoreboard tease so it never sits over the grid.
    window.clearTimeout(teaseTimer.current)
    teaseGen.current += 1
    afterGameRef.current = false
    setUnseenPop(null)
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
    if (!resuming) gaEvent('game_start', { board_id: p.id })
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
    winSaveKeyRef.current = null
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
        boardSeqRef.current += 1 // PR #53 batch 2: a fresh board started (guide frequency caps)
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
    boardSeqRef.current += 1 // PR #53 batch 2: a fresh board started (guide frequency caps)
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
    afterGameRef.current = true
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
      // The winning buddy gets the win line only (no Unseen grumble cut off by the cheer)
      if (!(puzzle && isSolved(puzzle, next))) pushBanter('place-good')
      setGiggleIndex(meta.index)
      window.setTimeout(() => setGiggleIndex((g) => (g === meta.index ? null : g)), 900)
    }

    saveBoardDraft(hist)

    if (puzzle && isSolved(puzzle, next) && !recordedRef.current) {
      recordedRef.current = true
      boardOverRef.current = 'won'
      afterGameRef.current = true
      // Drop anything queued from the live board (wrong move, stall, tip, Unseen) before the win line
      cancelVoiceBelow(VOICE_PRIORITY.win)
      setRunning(false)
      setCelebrate(true)
      sfxWin()
      // 10.06: every win earns 5 field treats for the pile (999 = jackpot)
      earnWithJackpot(5)
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
      // 9.32: save the finished game to the player's account (queued offline / until signed in)
      try {
        const cloudMode = cloudModeForWin({
          practice: practiceRef.current,
          daily: !!dailyRunRef.current,
          endless: !!endlessRef.current,
          trial: runMode === 'trial',
          remix: !!parseRemixId(String(puzzle.id)),
        })
        if (cloudMode) {
          if (!winSaveKeyRef.current) {
            winSaveKeyRef.current = `win:${puzzle.id}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
          }
          const timeSeconds = elapsedMs / 1000
          saveScore({
            score,
            level: puzzle.size,
            moves: hist.past.length,
            time_seconds: timeSeconds,
            mode: cloudMode,
            puzzle_id: String(puzzle.id),
            daily_date: cloudMode === 'daily' ? dailyRunRef.current ?? undefined : undefined,
            dedupeKey: winSaveKeyRef.current,
          })
          scheduleLeaderboardTease(score, timeSeconds, cloudMode)
        }
      } catch {
        /* never block the win */
      }
      void noteRoundScore(score, elapsedMs)
      // Personal bests, stars, Trial and Daily
      let replay: RunResult | null = null
      let rec = records
      let dailyStreak: number | null = null
      const cardDaily = dailyRunRef.current
      try {
        const fullSplits = [...splitsRef.current]
        while (fullSplits.length < puzzle.size) fullSplits.push(elapsedMs)
        if (hasRecords(puzzle.id)) {
          const out = recordRun(rec, { puzzleId: puzzle.id, mode: runMode, ms: elapsedMs, score, undos: undosRef.current, splits: fullSplits.slice(0, puzzle.size), targets, buddy: runPetRef.current, size: puzzle.size, assisted: hintsUsed > 0 || rescuesUsed > 0 })
          rec = out.blob
          replay = out.result
        }
        if (dailyRunRef.current) {
          const fin = finishDaily(rec.daily, dailyRunRef.current, true, { score, ms: elapsedMs, buddy: runPetRef.current })
          rec = { ...rec, daily: fin.daily }
          if (fin.counted) dailyStreak = fin.streak
          if (fin.counted) gaEvent('daily_puzzle_complete', { board_id: puzzle.id })
          dailyRunRef.current = null
        }
        // 9.32-f: remember this daily win so the WinScreen share uses the Wordle-style daily text
        setLastDailyWin(cardDaily ? { key: cardDaily, streak: dailyStreak ?? liveStreak(rec.daily, cardDaily) } : null)
        try {
          const gain = noteCardWin(records, String(puzzle.id), cardDaily)
          setCardGain(gain.after > gain.before ? { from: gain.before, to: gain.after } : null)
        } catch {
          setCardGain(null)
        }
        if (rec !== records) persistRecords(rec)
        if (endlessRef.current) setEndless(noteEndlessClear(puzzle.size))
        analyticsClear(puzzle.size, elapsedMs)
        gaEvent('game_win', { board_id: puzzle.id })
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
      setWinLine(win.text && win.clip ? win.text : '')
      // Slow or sloppy clear (lost a heart, 2+ hints, or over 3 minutes): the Unseen may chime in
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
        const myName = playerName || 'You'
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
          const levelUp = grown.levelUp
          const buddyClip = isRecord
            ? 'buddy_win_best'
            : levelUp
              ? levelUp >= 2 && levelUp <= 30
                ? `buddy_win_level_${levelUp}`
                : null
              : grown.starUp
                ? 'buddy_win_star'
                : runMode === 'trial'
                  ? 'buddy_win_victory'
                  : 'buddy_win_ave'
          petCheer = {
            id: ridePet,
            name: p.name,
            text: isRecord ? 'New best!' : levelUp ? `Level ${levelUp}!` : grown.starUp ? 'New star!' : runMode === 'trial' ? 'Victory!' : 'Ave!',
            cheer: isRecord || !!levelUp,
          }
          if (buddyClip) playVoice(buddyClip, { priority: 2, waitMs: 500 })
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
        if (replay?.tooFast) bits.push('that time looked too fast to be real, so it was not saved as a best')
        else if (hintsUsed > 0 || rescuesUsed > 0) bits.push('help used: a clean run can replace this time')
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

  /** Undo/redo spam (4 within 5s) gives the Unseen an opening */
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
    winSaveKeyRef.current = null
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
    afterGameRef.current = false
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

  /** 10.06: buddy flyby catch — perk-flavored reward from the active buddy */
  function handleFlybyCatch(reward: FlybyReward, petId: PetId) {
    const p = petById(petId)
    const name = p?.name ?? 'Your buddy'
    const current = loadWallet()
    if (reward.type === 'coins' || reward.type === 'bigcoins') {
      const w = { ...current, coins: current.coins + reward.amount }
      persistWallet(w)
      showToast(`${name} dropped +${reward.amount} coins! 🪙`)
    } else if (reward.type === 'hint') {
      setPetFree((pf) => ({ ...pf, hints: pf.hints + 1 }))
      showToast(`${name} spotted the right square! +1 free hint 🔍`)
    } else if (reward.type === 'heart') {
      setLives((n) => Math.min(runMaxLives, n + 1))
      showToast(`${name} lent you a heart! ❤️`)
    } else if (reward.type === 'rescue') {
      setPetFree((pf) => ({ ...pf, rescues: pf.rescues + 1 }))
      showToast(`${name} swooped in! +1 free rescue 🦉`)
    }
    pushBanter('critter')
  }

  /** 10.06: treat defense — wild pets vs the field treat pile. Only field treats are ever at risk; safe stash and coins are untouched. */
  function handleDefenseApproach() {
    sfxWhoosh()
    showToast('👀 A wild buddy is eyeing your treat pile!')
  }
  function handleDefenseCaught(earned: number) {
    if (earnWithJackpot(earned, true)) return
    petGiggle()
    const line = pushBanter('win-heckle')
    if (!line.text) showToast(`🛡️ Your buddies chased it off! +${earned} field treats`)
  }
  function handleDefenseScared(earned: number) {
    if (earnWithJackpot(earned, true)) return
    const line = pushBanter('win-heckle')
    if (!line.text) showToast(`💨 You scared it off! +${earned} field treats`)
  }
  /** Earn field treats, checking for the 999 jackpot after. Returns true if jackpot hit. */
  function earnWithJackpot(n: number, isDefense = false): boolean {
    // defense streak bonus: consecutive successful defenses earn +1 extra per streak level
    let bonus = 0
    let streak = pets.defenseStreak ?? 0
    if (isDefense) {
      streak += 1
      bonus = Math.min(streak - 1, 10) // +0 first, +1 second, ... capped at +10
    }
    const after = earnFieldTreats({ ...pets, defenseStreak: streak }, n + bonus)
    if ((after.fieldTreats ?? 0) >= MAX_FIELD_TREATS) {
      const j = jackpotFieldTreats(after)
      persistPets({ ...j.state, defenseStreak: 0 })
      sfxCoin()
      showToast(`🎉 JACKPOT! 999 treats defended! ${j.saved} auto-saved + ${j.bonus} bonus treats!`)
      pushBanter('prize')
      return true
    }
    persistPets(after)
    return false
  }
  function handleDefenseStolen(stolen: number) {
    const r = stealFieldTreats(pets, stolen)
    // steal breaks the defense streak
    persistPets({ ...r.state, defenseStreak: 0 })
    if (r.stolen <= 0) return
    const line = pushBanter('hunt-miss')
    if (!line.text) showToast(`🦝 A wild buddy stole ${r.stolen} treats from the pile!`)
  }
  /** Claim the field pile into the safe snack stash (untouchable from then on). No cap. */
  function handleClaimTreats() {
    const r = claimFieldTreats(pets)
    if (r.claimed <= 0) {
      showToast('The field pile is empty — your buddies will catch treats from wild pets.')
      return
    }
    persistPets(r.state)
    sfxCoin()
    showToast(`🍖 Claimed ${r.claimed} treats to the safe stash!`)
  }
  function makeScoreChallenge(message?: string): { url: string; text: string } {
    const target = puzzle ?? PUZZLES[0]
    const clear = getProgress().clears.find((c) => c.puzzleId === target.id)
    const note = message?.trim() || challengeMsg
    const c = createChallenge({
      puzzleId: target.id,
      puzzleName: target.name,
      difficulty: DIFFICULTY_LABEL[target.difficulty],
      fromEmail: senderEmail(profile?.email),
      fromName: playerName || 'A friend',
      message: note,
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
    const share = clear
      ? scoreShareText({
          name: playerName,
          score: lv?.bestScore ?? clear.bestScore,
          levelLabel: levelLabelFor(target),
          stars: lv?.stars,
          timeMs: lv?.bestMs ?? clear.bestMs,
          buddy: lv ? petLabel(lv.buddy) : undefined,
        })
      : challengeShareText(c)
    setShareText(share)
    return { url: link, text: share }
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
      fromName: who || playerName || 'A friend',
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
    // 9.32-f: daily wins get the Wordle-style daily text; everything else keeps its text
    const isDailyWin = lastDailyWin != null && String(puzzle.id) === `daily-${lastDailyWin.key}`
    if (isDailyWin) {
      setShareText(dailyShareText({ n: dailyNumber(lastDailyWin.key), ms: elapsedMs, streak: lastDailyWin.streak }))
    } else {
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
    }
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
    persistWallet(result.wallet, { itemType: 'badge', itemId: `${badgeId}:${badgeRank(result.wallet, badgeId)}` })
    sfxCoin()
    const rank = badgeRank(result.wallet, badgeId)
    const def = BADGES.find((b) => b.id === badgeId)
    showToast(`${def?.title ?? badgeId} → Rank ${rank} · +${formatBonusPercent(totalCoinBonusPercent(result.wallet))} coins`)
  }

  function applyShopGrant(offerId: string, coins: number, treats: number, petIds: readonly string[]) {
    const now = Date.now()
    const w = loadWallet()
    if (coins > 0) persistWallet({ ...w, coins: w.coins + coins }, { itemId: offerId })
    let ps = loadPets()
    if (treats > 0) ps = grantTreat(ps, 'snack', treats)
    for (const id of petIds) {
      if (id === 'premium-choice') {
        try {
          localStorage.setItem('roman.bundle.premium', '1')
        } catch {
          /* ignore */
        }
        showToast('Pick your premium buddy in the Stable.')
        continue
      }
      const pet: PetId | undefined =
        id === 'random-common'
          ? PETS.find((p) => p.tier === 'common' && !ps.owned[p.id])?.id
          : id === 'lupa' || id === 'aquila' || id === 'leo' || id === 'invictus' || id === 'nox'
            ? id
            : undefined
      if (!pet || ps.owned[pet]) continue
      ps = { ...ps, owned: { ...ps.owned, [pet]: { at: now, xp: 0, gift: true } }, active: ps.active ?? pet }
    }
    persistPets(ps)
    if (shopOfferById(offerId)?.once) {
      try {
        localStorage.setItem('roman.shop.starter', '1')
      } catch {
        /* ignore */
      }
      setStarterOwned(true)
    }
  }

  async function onBuyCoins(packId: CoinPackId | string) {
    unlockAudio()
    if (!isStoreBuild() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      showToast('Connect to buy')
      return
    }
    if (!isStoreBuild()) {
      const sb = await getSupabase()
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined
      const { startWebCheckout } = await import('./game/webCheckout')
      const started = await startWebCheckout(packId, token)
      if (!started.ok) showToast(started.reason)
      return
    }
    if (packId !== 'coins_100' && packId !== 'coins_500' && packId !== 'coins_1200' && packId !== 'coins_3000') return
    const result = await purchaseCoinPack(packId)
    if (!result.ok) {
      showToast(result.reason)
      return
    }
    if (result.credited) setWallet(loadWallet())
    else persistWallet({ ...wallet, coins: wallet.coins + result.coins }, { itemId: 'shop' })
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
        fromName: playerName || 'A friend',
        message: challengeMsg,
        toEmail: to || undefined,
      })
    return mailtoChallenge(
      { ...base, toEmail: to || base.toEmail, message: challengeMsg || base.message },
      url,
    )
  }

  const done = new Set(progress.clears.map((c) => c.puzzleId))

  const hideChrome = screen === 'play'

  function openHelp(id: string) {
    setHelpFocus(id.startsWith('help-') ? id : `help-${id}`)
    setNavOpen(false)
    setScreen('how')
  }

  function goNextBoard() {
    if (!puzzle) return
    maybeParade(() => {
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
    })
  }

  // Daily Challenge: same board for everyone on a Toronto date
  const todayKey = torontoDateKey()
  // 9.32-f: generator board first (same for everyone), old hashed pick as the fallback.
  // Memoized on the date key so a re-render never swaps the board mid-day.
  const dailyBoard = useMemo(
    () => dailyBoardForKey(todayKey) ?? PUZZLES[dailyIndex(todayKey, PUZZLES.length)],
    [todayKey],
  )
  const dailyToday = records.daily.days[todayKey]
  const dailyStreakNow = liveStreak(records.daily, todayKey)

  // PR #53 batch 2 (Tony 2026-10-19): Unseen guide + pet pop-out triggers.
  // Evaluates ~2s after relevant state settles; the highest-priority candidate
  // wins. Caps: 1 warning/session, 1 opportunity/session, progress tags once
  // each, never interrupt the same board twice. Appearing never pauses the
  // timer — the existing navigation behavior covers the tap-through case.
  useEffect(() => {
    if (guide || petPop) return
    if (celebrate || defeated || showWheel || shortfall || parade || showHunt) return
    // No guide or pet pop-up on a live board. Home and the other menus can still show one.
    if (screen === 'play' && running && !celebrate && !defeated) return
    if (screen === 'play' && guideBoardRef.current === boardSeqRef.current) return
    const t = window.setTimeout(() => {
      if (screen === 'play' && running && !celebrate && !defeated) return
      if (Date.now() - guideLastAtRef.current < 45_000) return
      const snapshot = {
        now: petNow,
        today: todayKey,
        pets,
        wallet,
        pieces: localCard(records).pieces,
        piecesTotal: CARD_PIECES,
        streak: dailyStreakNow,
      }
      const pick = guideCandidates(snapshot).find((c) => {
        if (!guideVoiceClip(c.tag)) return false
        return c.category === 'warning'
          ? !guideWarnShownRef.current
          : c.category === 'opportunity'
            ? !guideOppShownRef.current
            : !guideProgressFiredRef.current.has(c.tag)
      })
      if (pick) {
        if (pick.category === 'warning') guideWarnShownRef.current = true
        else if (pick.category === 'opportunity') guideOppShownRef.current = true
        else guideProgressFiredRef.current.add(pick.tag)
        guideBoardRef.current = boardSeqRef.current
        guideLastAtRef.current = Date.now()
        guideKey.current += 1
        const clip = guideVoiceClip(pick.tag)
        setGuide({ kind: pick.kind, text: pick.text, target: pick.target, key: guideKey.current, clip: clip ?? undefined })
        if (clip) playVoice(clip, { priority: 2, waitMs: 500 })
        return
      }
      // No guide: silent pet pop-out (lowest-mood pet needing care), once per
      // pet per session, never mid-board.
      if (screen === 'play') return
      const needy = petPopoutPick(snapshot)
      if (needy && !petPopFiredRef.current.has(needy.id)) {
        petPopFiredRef.current.add(needy.id)
        guideBoardRef.current = boardSeqRef.current
        guideLastAtRef.current = Date.now()
        petPopKey.current += 1
        setPetPop({ id: needy.id, kind: needy.kind, mood: needy.mood, key: petPopKey.current })
      }
    }, 2000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, running, pets, petNow, wallet.coins, records, celebrate, defeated, showWheel, shortfall, parade, showHunt, guide, petPop])
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

  /** 9.32-f: menu "Mix it up" — a fresh Endless board at a random size */
  function mixItUp() {
    const diffs = ['easy', 'medium', 'hard', 'expert'] as const
    startEndless(diffs[Math.floor(Math.random() * diffs.length)])
  }

  /** 9.32-f: shared level-card rendering — used by the difficulty tabs AND the Classic boards set */
  const levelCardFor = (p: Puzzle) => {
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
  }

  startPuzzleRef.current = startPuzzle

  const remixClearedCount = REMIX_SIZES.filter((sz) => records.levels[remixId(remixSet, sz)]?.bestMs != null).length
  const remixCard = (() => {
    // NEW badge for the first 24h of each 3-day set so players notice fresh boards
    const freshMs = (REMIX_DAYS - 1) * 24 * 3600 * 1000
    const isFresh = remixMsLeft > freshMs
    return (
      <section className="daily-card remix-entry" aria-label="Remix boards">
        <div className="daily-text">
          <strong>
            Remix boards
            {isFresh ? <span className="new-badge" aria-label="New boards">NEW</span> : null}
          </strong>
          <span>New boards every 3 days · same for everyone{remixClearedCount ? ` · ${remixClearedCount}/4 cleared` : ''}</span>
          <span className="daily-status">Next set in {remixCountdownLabel(remixMsLeft)} · plus Endless mode</span>
        </div>
        <div className="remix-entry-btns">
          <button type="button" className={`btn ${isFresh ? 'primary' : 'ghost'} daily-btn`} data-open-remix onClick={() => setScreen('remix')}>
            Remix
          </button>
          <button type="button" className="btn ghost daily-btn" onClick={mixItUp} disabled={endlessBusy != null} title="A fresh Endless board at a random size">
            {endlessBusy ? 'Making…' : '🎲 Mix it up'}
          </button>
        </div>
      </section>
    )
  })()

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
                {sheetRec?.bestMs != null ? (
                  <button
                    type="button"
                    className="btn tool"
                    data-testid="reset-best"
                    onClick={() => {
                      if (window.confirm(`Reset your best time on ${startSheet.name}? Your stars and top score stay.`)) {
                        persistRecords(resetBestTime(records, startSheet.id))
                        showToast('Best time reset. Set a new one!')
                      }
                    }}
                  >
                    Reset best time
                  </button>
                ) : null}
                <button type="button" className="btn ghost" onClick={() => setStartSheet(null)}>
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )

  // 9.32-f: stats-popup data — total daily wins + best daily time (from the daily-day records)
  const dailyWins = Object.values(records.daily.days).filter((d) => d.status === 'won').length
  const bestDailyMs = Object.values(records.daily.days).reduce<number | null>(
    (best, d) => (d.status === 'won' && d.ms != null ? (best == null ? d.ms : Math.min(best, d.ms)) : best),
    null,
  )

  const dailyCard = (
    <section className="daily-card" aria-label="Daily Challenge">
      <div className="daily-text">
        <strong>Daily Challenge · {dailyDateLabel}</strong>
        <span>
          {dailyBoard.name} · {dailyBoard.size}×{dailyBoard.size}
        </span>
        {/* 9.32-f: prominent streak — tap opens the stats popup (fixed overlay, no layout shift) */}
        <button
          type="button"
          className="daily-streakbtn"
          onClick={() => setShowStats(true)}
          aria-label={`Open daily stats. ${dailyStreakNow}-day streak, best streak ${records.daily.bestStreak}.`}
        >
          🔥 {dailyStreakNow}-day streak · best {records.daily.bestStreak}
        </button>
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
      {showStats ? (
        <StatsPopup
          streak={dailyStreakNow}
          bestStreak={records.daily.bestStreak}
          wins={dailyWins}
          bestDailyMs={bestDailyMs}
          formatMs={formatMs}
          onClose={() => setShowStats(false)}
        />
      ) : null}
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
      className={`shell fixed-shell ${isStoreBuild() ? 'shell-native' : ''} ${screen === 'play' ? 'shell-play' : ''} ${screen === 'play' && celebrate && !showWheel ? 'shell-celebrate' : ''} ${screen === 'play' && (celebrate || defeated) ? 'shell-ended' : ''} ${hideChrome ? 'shell-immersive' : ''} shell-${screen}`}
      ref={shellRef}
      onPointerDown={unlockAudio}
    >
      <div className="atmosphere" aria-hidden />
      <style>{MENU_CSS}</style>
      {!hideChrome && (
        <header className="topbar topbar-slim">
          <button
            type="button"
            className="brand"
            data-testid="brand-site"
            onClick={() => {
              setNavOpen(false)
              setScreen('home')
            }}
          >
            <span className="brand-mark" />
            <span className="brand-name brand-name-full">Roman's Game</span>
            <span className="brand-name brand-name-short" data-testid="brand-roman">Roman</span>
          </button>
          <nav className="nav-quick" aria-label="Shortcuts">
            <button
              type="button"
              data-testid="quick-home"
              className={screen === 'home' ? 'on' : ''}
              aria-label="Home"
              title="Home"
              onClick={() => { setNavOpen(false); setScreen('home') }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 3.4 3.2 11h2.3v8.6h5v-5.2h2.9v5.2h5V11h2.4L12 3.4z" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="quick-play"
              className={screen === 'levels' ? 'on' : ''}
              aria-label="Play"
              title="Play"
              onClick={() => { setNavOpen(false); setScreen('levels') }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M8 5.2v13.6l12-6.8L8 5.2z" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="quick-how"
              className={`quick-how${screen === 'how' ? ' on' : ''}`}
              aria-label="How to play"
              title="How to play"
              onClick={() => { setNavOpen(false); setHelpFocus(''); setScreen('how') }}
            >
              ?
            </button>
            <button
              type="button"
              data-testid="quick-shop"
              className={screen === 'rewards' ? 'on' : ''}
              aria-label="Shop"
              title="Shop"
              onClick={() => { setNavOpen(false); setScreen('rewards') }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M7 7.2V6.4a5 5 0 0 1 10 0v.8h2.6V20H4.4V7.2H7zm2 0h6V6.4a3 3 0 0 0-6 0v.8z" />
              </svg>
            </button>
          </nav>
          <button
            type="button"
            className="nav-menu"
            aria-expanded={navOpen}
            aria-controls="app-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            Menu
          </button>
          {navOpen ? (
            <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
          ) : null}
          <nav id="app-nav" className={`nav${navOpen ? ' is-open' : ''}`}>
            <button type="button" data-testid="nav-home" className={`nav-in-quick${screen === 'home' ? ' on' : ''}`} onClick={() => { setNavOpen(false); setScreen('home') }}>
              Home
            </button>
            <button type="button" className={`nav-in-quick${screen === 'levels' ? ' on' : ''}`} onClick={() => { setNavOpen(false); setScreen('levels') }}>
              Play
            </button>
            <button type="button" data-testid="nav-how" className={`nav-in-quick${screen === 'how' ? ' on' : ''}`} title="How to play" onClick={() => { setNavOpen(false); setHelpFocus(''); setScreen('how') }}>
              How to play
            </button>
            <button type="button" className={screen === 'rewards' ? 'on' : ''} onClick={() => { setNavOpen(false); setScreen('rewards') }}>
              Rewards
            </button>
            <button type="button" className={`nav-stable ${screen === 'stable' ? 'on' : ''}`} onClick={() => { setNavOpen(false); setScreen('stable') }}>
              Stable
            </button>
            <button type="button" className={screen === 'challenge' ? 'on' : ''} onClick={() => { setNavOpen(false); setScreen('challenge') }}>
              Share
            </button>
            <button type="button" className={screen === 'leaderboard' ? 'on' : ''} data-testid="nav-board" onClick={() => { setNavOpen(false); setScreen('leaderboard') }}>
              Board
            </button>
            <button type="button" className={screen === 'profile' ? 'on' : ''} onClick={() => { setNavOpen(false); setScreen('profile') }}>
              {playerName ? <span className="player-name-mark nav-player" data-testid="nav-player" title={playerName}>{playerName}</span> : 'Account'}
            </button>
          </nav>
          <div className="hud-pills">
            <a
              className="site-link"
              href="https://romansgame.com"
              target="_blank"
              rel="noopener"
              title="Visit romansgame.com"
              aria-label="Visit romansgame.com"
              data-testid="site-logo"
            >
              <img src="/images/site-logo.png" alt="" width="512" height="512" draggable={false} />
            </a>
            <button
              type="button"
              className="score-pill coin"
              title="Coins — tap to get more"
              onClick={() => setScreen('rewards')}
            >
              {wallet.coins}
              <span>¢</span>
            </button>
          </div>
        </header>
      )}

      {screen !== 'play' && screen !== 'profile' && playerName && (
        <p className="signed-in-bar" data-testid="signed-in-as">
          {signedIn ? 'Signed in as ' : 'Playing as '}
          <strong className="player-name-mark">{playerName}</strong>
        </p>
      )}

      {/* On a live board the toast text shows in the play caption slot instead (never over the board) */}
      {toast && (screen !== 'play' || celebrate || defeated) && <div className="toast">{toast}</div>}
      <QuietToast />

      {namePrompt && <NamePromptSheet touch={touchName} nameDraft={nameDraft} setNameDraft={setNameDraft} onClose={closeNamePrompt} signedIn={signedIn} />}

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
              Roman's Game
            </h1>
            <p className="lede">
              Drop animated buddies — one per row, column, and region. They hate cuddling (even corners).
            </p>
            <HomeUnseenReminder
              facts={{
                now: Date.now(),
                today: torontoDateKey(),
                cloudKnown: cloud.status === 'signed-in' || cloud.status === 'signed-out',
                signedIn,
                afterGame: afterGameRef.current,
                sessionSignIns: 0,
                hungryPet: anyHungryPet(pets, Date.now()),
                canSpend: canSpendCoins(wallet.coins, pets, wallet, Date.now()),
                dailyPlayed: records.daily.days[torontoDateKey()]?.status === 'won',
                streakAtRisk: liveStreak(records.daily, torontoDateKey()) > 0 && records.daily.lastWon !== torontoDateKey(),
                remixSet,
              }}
              onConsumed={() => {
                afterGameRef.current = false
              }}
            />
            <div className="cta-row">
              {draftPuzzle ? (
                <button type="button" className="btn primary home-play" onClick={() => startPuzzle(draftPuzzle, true)}>
                  Resume {draftPuzzle.name}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary home-play"
                  onClick={() => {
                    // 9.30-n: once every level is cleared, Play opens the Levels list (it used to make endless random boards)
                    const uncleared = PUZZLES.find((p) => !done.has(p.id))
                    if (uncleared) startPuzzle(uncleared)
                    else setScreen('levels')
                  }}
                >
                  Play
                </button>
              )}
              <button type="button" className="btn ghost btn-sm" onClick={() => setScreen('how')}>
                How to play
              </button>
              <button type="button" className="btn ghost btn-sm" data-testid="home-board" onClick={() => setScreen('leaderboard')}>
                Leaderboard
              </button>
              <InboxButton onOpen={() => setScreen('inbox')} />
              <PlayerChip onOpen={() => setScreen('profile')} />
              <button type="button" className="btn ghost btn-sm" onClick={() => setScreen('bug')}>
                🐛 Report a bug
              </button>
              <UnseenCardTile records={records} />
            </div>
            <PlayNudge home />
            <SyncNote />
          </section>
          {/* 10.06: treat defense — the vulnerable field pile. Claim only on the board screen. */}
          <section className="treat-pile-widget" aria-label="Field treat pile">
            <span aria-hidden="true">🍖</span>
            <span>
              <strong>{pets.fieldTreats ?? 0}</strong> field treats
              {Object.keys(pets.owned).length === 0 ? (
                <small>⚠️ no defenders — your treats are in danger! <button type="button" className="linklike" onClick={() => setScreen('stable')}>Claim your FREE pet</button> to protect them</small>
              ) : (
                <small>wild buddies want them — play a board to claim them safe</small>
              )}
            </span>
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
          <footer className="home-site-foot">
            <a href="https://romansgame.com" target="_blank" rel="noopener" data-testid="home-site-link">
              Visit romansgame.com
            </a>
            <LegalLine />
          </footer>
        </main>
      )}

      {screen === 'how' && (
        <HowToPlay
          key={`how-${howStart}-${helpFocus}`}
          startAt={howStart}
          focusId={helpFocus}
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

      {screen === 'bug' && (
        <BugReport currentScreen={screen} onBack={() => setScreen('home')} />
      )}

      {screen === 'inbox' && (
        <InboxScreen
          onBack={() => setScreen('home')}
          onPlay={(item: InboxItem) => {
            if (item.kind === 'live') {
              const matchId = String(item.payload.match || '')
              const layout = String(item.payload.layout || '')
              const board = layout ? registerSharedBoard(`live-${matchId || item.id}`, String(item.payload.puzzleName || item.payload.name || 'Live'), layout) : null
              if (matchId) void getSupabase().then((sb) => sb?.rpc('join_live', { match_id: matchId }))
              armRound({ kind: 'live', theirName: item.fromName, theirScore: 0, matchId })
              if (board) startPuzzle(board)
              else setScreen('home')
              return
            }
            const link = String(item.payload.link || '')
            const hash = link.includes('#') ? link.slice(link.indexOf('#')) : ''
            armRound({ kind: 'challenge', theirName: item.fromName, theirScore: Number(item.payload.score) || 0 })
            if (hash) {
              window.location.hash = hash
              window.dispatchEvent(new Event('rg-open-hash'))
            } else setScreen('home')
          }}
        />
      )}

      {screen === 'leaderboard' && (
        <Leaderboard
          you={playerName}
          signedIn={signedIn}
          onHelp={() => openHelp('help-board')}
          badges={BADGES.filter((b) => badgeRank(wallet, b.id) >= 1).map((b) => b.icon)}
          showcase={{ pieces: localCard(records).pieces, earned: localCard(records).pieces >= CARD_PIECES }}
          onChallenge={(rival) => {
            const made = makeScoreChallenge(`${playerName || 'I'} challenge ${rival}. Beat my score.`)
            if (isFriend(rival)) {
              void sendChallenge(rival, { link: made.url }, `${playerName || 'A friend'} challenged you`)
              showToast(`Challenge sent to ${rival}`)
              return
            }
            setScreen('challenge')
            showToast(`Challenge ready. Share it with ${rival}.`)
          }}
          onLive={(rival) => {
            const target = puzzle ?? PUZZLES[0]
            void sendLive(rival, packBoardLayout(target), target.name)
            showToast(`Invite sent to ${rival}`)
          }}
        />
      )}

      {screen === 'levels' && (
        <main className="panel levels scroll-pane">
          <h2>Levels</h2>
          <p className="sub">Beat your best time and score on any board. ★ finish · ★★ beat the target time · ★★★ target time, a high score and no undos. 3 stars unlocks Roman's Trial.</p>
          {dailyCard}
          {remixCard}
          <div className="level-tabs" role="tablist" aria-label="Difficulty">
            {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => (
              <button
                key={diff}
                type="button"
                role="tab"
                aria-selected={levelTab === diff}
                className={`level-tab ${levelTab === diff ? 'on' : ''}`}
                onClick={() => pickLevelTab(diff)}
              >
                {DIFFICULTY_LABEL[diff]}
                <span className="level-tab-size">
                  {diff === 'easy' ? '5×5' : diff === 'medium' ? '6×6' : diff === 'hard' ? '7×7' : '8×8'}
                </span>
              </button>
            ))}
          </div>
          <section key={levelTab} className="diff-block" role="tabpanel" aria-label="Classic boards">
            <div className="diff-head">
              <h3>
                Classic boards
                <span className="diff-size">
                  {' '}
                  · {levelTab === 'easy' ? '5×5' : levelTab === 'medium' ? '6×6' : levelTab === 'hard' ? '7×7' : '8×8'}
                </span>
              </h3>
              <button
                type="button"
                className="btn ghost random-btn"
                data-random-level={levelTab}
                title="One fresh random board. Then Next goes to the next level, as usual."
                onClick={() => {
                  showToast('Shuffling one fresh board…')
                  // Defer so the toast paints before the (heavy on expert) generate
                  window.setTimeout(() => startPuzzle(createFreshPuzzle(levelTab)), 30)
                }}
              >
                Random
              </button>
            </div>
            <div className="level-grid">
              {byDiff[levelTab].map((p) => levelCardFor(p))}
            </div>
          </section>
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
              {playerName ? (
                <em className="hud-you" data-testid="hud-player">
                  {signedIn ? 'Signed in as ' : ''}
                  <strong className="player-name-mark">{playerName}</strong>
                </em>
              ) : null}
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
              {endlessRef.current ? (
                <span className="hud-mode" data-testid="hud-endless" title="Endless mode: the board list never ends. Leave any time with Back.">♾ Endless</span>
              ) : parseRemixId(puzzle.id) ? (
                <span className="hud-mode" data-testid="hud-remix" title="Remix board">{boardKindNote(puzzle.id)}</span>
              ) : null}
              {dayPerk && !celebrate ? (
                <span className="hud-day" data-testid="hud-day" title={`Buddy of the day: ${dayPerk.pet ? petById(dayPerk.pet)?.name : 'Guest'} · board ${dayPerk.board} of 3`}>
                  ⭐ {dayShort(dayPerk.kind)} {dayPerk.board}/3
                </span>
              ) : null}
              <span className="hud-stash" title="Catch 5 sparks across games for a prize">
                ✨{(wallet.critterStash ?? 0)}/{CRITTER_STASH_GOAL}
              </span>
              <button
                type="button"
                className={`hud-treats${(pets.fieldTreats ?? 0) >= 900 ? ' is-full' : ''}`}
                title={(pets.fieldTreats ?? 0) >= 900 ? 'Field pile almost FULL — 999 triggers the jackpot!' : 'Field treats — tap to claim them safe'}
                onClick={handleClaimTreats}
              >
                🍖{pets.fieldTreats ?? 0}
              </button>
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
          {(celebrate || defeated) && !showHunt && !showWheel ? (
            <aside className="play-dock" data-testid="play-dock">
              <p>
                {celebrate ? 'Victory' : 'Out of hearts'} · {formatMs(elapsedMs)} · {lastScore ?? 0} pts · {lives} hearts
              </p>
              <button type="button" className="btn primary" onClick={goNextBoard}>Next board</button>
              <button type="button" className="btn ghost" onClick={resetBoard}>Play again</button>
              <button type="button" className="btn ghost" onClick={() => setScreen('leaderboard')}>Leaderboard</button>
            </aside>
          ) : null}
          </div>
          <p className="build-tag" data-build={BUILD_TAG}>{BUILD_TAG}</p>

          <div className={`rotate-prompt ${rotatePaused ? 'is-on' : ''}`} role="dialog" aria-modal="true" aria-hidden={!rotatePaused} aria-label="Turn your phone upright">
            <div className="rotate-card">
              <span className="rotate-phone" aria-hidden="true">
                <span className="rotate-phone-screen" />
              </span>
              <h3>Turn your phone upright</h3>
              <p>Turn the phone upright. The board is paused.</p>
              <small>Paused — your board, hearts and time are saved.</small>
            </div>
          </div>

          <SparkCritter
            active={!celebrate && !defeated && !showWheel && !rotatePaused && sparksOpen(rollLedger(econ, torontoDateKey()))}
            stashCount={wallet.critterStash ?? 0}
            onCatch={handleCritterCatch}
          />
          <BuddyFlyby
            active={!celebrate && !defeated && !showWheel && !rotatePaused}
            petId={activePet(pets, petNow)}
            onCatch={handleFlybyCatch}
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
              romanSaying={winLine}
              spins={wallet.spins}
              perfect={hintsUsed === 0}
              replay={winReplay ?? undefined}
              cardGain={cardGain ?? undefined}
              nextLabel={endlessRef.current ? 'Next Endless board' : parseRemixId(puzzle.id) ? 'Next Remix board' : 'Next board'}
              paradeHint={settings.parade === false ? undefined : paradeHint(paradeRef.current).text}
              modeNote={endlessRef.current ? `Endless mode · ${endless.cleared} cleared. Levels and Home are under More.` : parseRemixId(puzzle.id) ? boardKindNote(puzzle.id) : undefined}
              onNext={goNextBoard}
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
              suggestedName={playerName}
              playerName={playerName}
              signedIn={signedIn}
            />
          )}

          {parade && (
            <ParadeOverlay
              buddies={parade.buddies}
              treasure={parade.treasure}
              featured={parade.featured}
              featuredKind={parade.featuredKind}
              capped={parade.capped}
              readPotPct={() => treasureLeftPct(ledgerNow())}
              onCatch={catchTreasure}
              readWallet={() => { const w = loadWallet(); return { coins: w.coins, hints: w.freeHints, spins: w.spins } }}
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
          onClaimFree={onClaimFreePet}
          onBuyBundle={onBuyBundle}
          onCare={onCarePet}
          onFeed={onFeedPet}
          today={todayKey}
          onEquip={onEquipPet}
          onPeek={onPeekGift}
          onRedeem={onRedeemGift}
          onShop={() => setScreen('rewards')}
          onBack={() => setScreen('home')}
          focusPet={stableFocus}
          giftCode={giftPrefill}
          giftsOnline={!isStoreBuild()}
          isSignedIn={signedIn || !!profile}
          playerName={playerName}
          signedIn={signedIn}
          onHelp={() => openHelp('help-buddies')}
        />
      )}

      {screen === 'rewards' && (
        <main className="panel scroll-pane shop-screen">
          <section className="shop-block" data-testid="shop" aria-label="Shop">
            <h2>Shop <HelpMark id="shop" onOpen={openHelp} /></h2>
            <p className="coin-explain">Coins are earned by playing or bought here. They are not real money.</p>
            <p className="shop-proposed" data-testid="shop-proposed">Prices are in Canadian dollars.</p>
            <section className="pay-real" aria-label="Real money" data-testid="real-money">
              <h3><span className="pay-mark" aria-hidden="true">💳</span> Real money</h3>
              <div className="coin-shop">
                {SHOP_OFFERS.filter((offer) => offer.pets.length === 0).map((offer) => {
                  const discs = coinStackDiscs(offer.coins)
                  const save = savingsCents(offer)
                  return (
                    <article key={offer.id} className="product-card product-card-money product-card-web" data-pack={offer.id}>
                      <span className="coin-stack" data-discs={discs} aria-hidden="true">
                        {Array.from({ length: discs }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <h3>{offer.label}</h3>
                      <p className="product-coins">{formatPackCoins(offer.coins)}</p>
                      <ul className="offer-contents">
                        {offer.contents.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="product-card-foot">
                        <span className="product-price" data-testid={offer.id === 'starter' ? 'starter-price' : undefined}>
                          <span className="pay-mark" aria-hidden="true">💳</span>{' '}
                          {offer.id === 'starter' ? formatStarterLadder('cad') : formatCad(offer.cadCents)}
                          {save > 0 ? <small>Save {formatCad(save)}</small> : null}
                        </span>
                        <OfflineBuyButton onClick={() => void onBuyCoins(offer.id)}>
                          <span data-testid={offer.id === 'starter' ? 'starter-buy' : undefined}>Buy</span>
                        </OfflineBuyButton>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="bundle-shop">
                {SHOP_OFFERS.filter((offer) => offer.pets.length > 0).map((offer) => {
                  const save = savingsCents(offer)
                  const owned = offer.once && starterOwned
                  return (
                    <article key={offer.id} className="product-card product-card-money starter-pack" data-testid={`${offer.id}-pack`}>
                      {offer.id === 'starter' ? (
                        <div className="starter-art">
                          <PetArt id="lupa" size={52} title="Lupa" />
                          <PetArt id="aquila" size={52} title="Aquila" />
                        </div>
                      ) : null}
                      <h3>
                        {offer.label}
                        {offer.badge ? <span className="offer-badge">{offer.badge}</span> : null}
                      </h3>
                      <ul className="offer-contents">
                        {offer.contents.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <div className="product-card-foot">
                        <span className="product-price" data-testid={offer.id === 'starter' ? 'starter-price' : undefined}>
                          <span className="pay-mark" aria-hidden="true">💳</span> {formatCad(offer.cadCents)}
                          {save > 0 ? <small>Save {formatCad(save)} vs buying separately</small> : null}
                        </span>
                        {owned ? (
                          <button type="button" className="btn ghost product-buy" disabled data-testid="starter-buy">
                            Already yours
                          </button>
                        ) : (
                          <OfflineBuyButton onClick={() => void onBuyCoins(offer.id)}>
                            <span data-testid={offer.id === 'starter' ? 'starter-buy' : undefined}>Buy</span>
                          </OfflineBuyButton>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              <LegalLine />
            </section>
            <section className="pay-coins" aria-label="Spend coins" data-testid="spend-coins">
              <h3><span className="pay-mark" aria-hidden="true">🪙</span> Spend coins</h3>
              <div className="balance-row">
                <span data-testid="balance-coins"><span className="pay-mark" aria-hidden="true">🪙</span> {wallet.coins} coins</span>
                <span data-testid="balance-treats"><span aria-hidden="true">🍖</span> {pets.treats.snack + pets.treats.feast} treats</span>
              </div>
              <p className="product-value">
                Safe snacks become coins at {SNACK_COIN_RATE} each. Field treats and feasts stay. No cash-out.
              </p>
              {convertAsk ? (
                <div className="convert-confirm" data-testid="convert-confirm">
                  <p>
                    Convert {pets.treats.snack} snacks into {(pets.treats.snack ?? 0) * SNACK_COIN_RATE} coins? They stay in the game.
                  </p>
                  <button type="button" className="btn primary btn-sm" data-testid="convert-yes" onClick={confirmConvertTreats}>
                    Convert
                  </button>
                  <button type="button" className="btn ghost btn-sm" onClick={() => setConvertAsk(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  data-testid="convert-treats"
                  disabled={(pets.treats.snack ?? 0) <= 0}
                  onClick={() => setConvertAsk(true)}
                >
                  <span className="pay-mark" aria-hidden="true">🪙</span> Convert snacks
                </button>
              )}
              <button type="button" className="btn ghost btn-sm" onClick={() => setScreen('stable')}>
                <span className="pay-mark" aria-hidden="true">🪙</span> Animals in the Stable
              </button>
            </section>
            {isStoreBuild() ? (
              <button type="button" className="btn ghost" onClick={() => void onRestorePurchases()}>
                Restore unfinished purchases
              </button>
            ) : null}
          </section>

          <h2>Rewards <HelpMark id="rewards" onOpen={openHelp} /></h2>
          <p className="rewards-lead">Badges, streaks, and prizes you pick up by playing.</p>
          <h3 className="ach-title">Badges</h3>
          <div className="reward-row" aria-label="Badges">
            {ACHIEVEMENTS.map((a) => {
              const rank = badgeRank(wallet, a.id)
              const unlocked = rank >= 1
              const cost = unlocked ? upgradeBadgeCost(a.id, rank, totalBadgePower(wallet)) : 0
              return (
                <div key={a.id} className={`reward-card badge-card ${unlocked ? 'on' : 'is-locked'}`}>
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
                      <span className="pay-mark" aria-hidden="true">🪙</span> Upgrade · {cost}
                    </button>
                  ) : (
                    <span className="badge-locked-hint">Earn by playing</span>
                  )}
                </div>
              )
            })}
          </div>
          <h3 className="ach-title">Streaks</h3>
          <div className="reward-row" aria-label="Streaks">
            <div className="reward-card"><span className="ach-icon">🔥</span><strong>{dailyStreakNow}-day</strong><span>streak</span></div>
            <div className="reward-card"><span className="ach-icon">🏆</span><strong>{records.daily.bestStreak}</strong><span>best streak</span></div>
            <div className="reward-card" data-testid="parade-rewards-today"><span className="ach-icon">🎉</span><strong>{paradeRewardsLine(rollLedger(econ, todayKey)).text}</strong><span>parade today</span></div>
          </div>
          <h3 className="ach-title">Daily prizes</h3>
          <div className="reward-row" aria-label="Daily prizes" data-testid="econ-card">
            {(() => {
              const t = ledgerSummary(rollLedger(econ, todayKey))
              return (
                <>
                  <div className="reward-card"><strong>{t.winsFull}/{t.winsFullMax}</strong><span>full-pay wins</span></div>
                  <div className="reward-card"><strong>{t.sparks}/{t.sparksMax}</strong><span>sparks</span></div>
                  <button type="button" className="reward-card reward-action" disabled={wallet.spins <= 0} onClick={openPrizeWheel}>
                    <strong>{wallet.spins > 0 ? `Spin (${wallet.spins})` : 'No spin yet'}</strong>
                    <span>Catch 5 sparks</span>
                  </button>
                </>
              )
            })()}
          </div>
          <h3 className="ach-title">To collect</h3>
          <div className="reward-row" aria-label="Things to collect">
            <button type="button" className="reward-card reward-action" onClick={() => setScreen('stable')}>
              <span className="ach-icon">🐾</span><strong>Animals</strong><span>{wallet.coins} coins</span>
            </button>
            <div className="reward-card"><span className="ach-icon">🍖</span><strong>{pets.treats.snack + pets.treats.feast}</strong><span>treats</span></div>
            <div className="reward-card"><span className="ach-icon">✨</span><strong>{wallet.critterStash ?? 0}/5</strong><span>sparks</span></div>
            <div className="reward-card"><span className="ach-icon">🛡️</span><strong>{wallet.shields}</strong><span>shields</span></div>
            <div className="reward-card"><span className="ach-icon">🃏</span><strong>{localCard(records).pieces}/{CARD_PIECES}</strong><span>Unseen card</span></div>
          </div>
        </main>
      )}

      {screen === 'profile' && (
        <main className="panel profile scroll-pane">
          <h2>Account & settings <HelpMark id="account" onOpen={openHelp} /></h2>
          <div className="profile-card account-line" data-testid="account-card">
            <p className="profile-name" data-testid="account-signed-in">
              {signedIn ? (
                <>
                  Signed in as <strong className="player-name-mark">{playerName}</strong>
                  {cloud.email ? <> ({cloud.email})</> : null}
                </>
              ) : playerName ? (
                <>Playing as <strong className="player-name-mark">{playerName}</strong></>
              ) : (
                'Not signed in'
              )}
            </p>
            {signedIn ? <p className="account-sync" data-testid="score-sync">{scoreSaveLabel(cloud).replace(/^☁\s*/, '')}</p> : null}
            <div className="account-actions">
              <button type="button" className="btn ghost btn-sm" data-testid="edit-name" onClick={() => setEditingName((open) => !open)}>
                Edit name
              </button>
              {signedIn ? (
                <button type="button" className="btn ghost btn-sm" onClick={() => void cloudSignOut()}>
                  Sign out
                </button>
              ) : (
                <CloudScoresButton suggestedName={playerName} />
              )}
              <a className="btn ghost btn-sm" href="https://romansgame.com" target="_blank" rel="noopener" data-testid="account-website">
                Website
              </a>
              <button type="button" className="btn ghost btn-sm" data-testid="account-help" onClick={() => openHelp('help-account')}>
                Help / How to play
              </button>
            </div>
            <LegalLine />
            {editingName ? (
              <label className="name-setting">
                Name
                <input
                  type="text"
                  value={nameField}
                  maxLength={NAME_MAX}
                  placeholder="Your name"
                  aria-label="Your name"
                  onFocus={() => {
                    nameFocus.current = true
                  }}
                  onChange={(e) => setNameField(e.target.value.slice(0, NAME_MAX))}
                  onBlur={(e) => {
                    nameFocus.current = false
                    const next = cleanPlayerName(e.target.value)
                    setNameField(next)
                    if (next && next !== playerName) void commitName(next)
                  }}
                />
              </label>
            ) : null}
          </div>
          <AccountSocial />
          <section className="leaderboard">
            <h3>Leaderboard</h3>
            <p className="sub">Today's Daily, this week, and all-time. Your name is highlighted on the board.</p>
            <button type="button" className="btn ghost" onClick={() => setScreen('leaderboard')}>
              Open the leaderboard
            </button>
          </section>
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
            <div className="privacy-note" data-testid="privacy-note">
              <strong>What we count</strong>
              <p>{PRIVACY_NOTE}</p>
              <label className="toggle">
                <input type="checkbox" data-testid="analytics-toggle" checked={settings.analytics !== false} onChange={(e) => saveSettingsPatch({ analytics: e.target.checked })} />
                Share anonymous play counts
              </label>
            </div>
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
          <section className="follow-section" aria-label="Follow Roman's Game">
            <h3>Follow Roman&rsquo;s Game</h3>
            <p>New puzzles, remix boards, and challenges — fresh on our page.</p>
            <a
              className="btn primary fb-btn"
              href="https://facebook.com/romansgame"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7h2.5z"
                />
              </svg>
              Follow on Facebook
            </a>
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
          <h2>Share <HelpMark id="share" onOpen={openHelp} /></h2>
          {playerName ? (
            <p className="share-player" data-testid="share-player">
              Sharing as <strong className="player-name-mark">{playerName}</strong>
            </p>
          ) : (
            <p className="sub">Add your name in Account and it goes on every challenge.</p>
          )}
          <p className="sub">Share a score, or invite someone to play.</p>
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
                    // 9.30-n: an older Remix link with no board inside is rebuilt from its set + size (the same board for everyone)
                    const rm = parseRemixId(incoming.puzzleId)
                    if (rm) {
                      showToast('Rebuilding that Remix board…')
                      void buildRemixInBackground(rm.set, rm.size).then((b) => {
                        if (!b) {
                          setLinkBoardError(MISSING_BOARD)
                          return
                        }
                        rememberSharedPuzzle(b)
                        setLinkBoardError('')
                        setActiveChallenge(incoming)
                        startPuzzleRef.current(b)
                      })
                      return
                    }
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
          <ShareBar
            url={shareLink || playUrl}
            text={shareText || challengeMsg}
            inviteUrl={playUrl}
            inviteText={playerName ? `${playerName} invited you to play Roman's Game.` : "Come play Roman's Game with me."}
            emailHref={challengeMailHref(shareLink || playUrl)}
            onCopied={() => showToast('Copied')}
            onShareScore={() => makeScoreChallenge()}
          >
          <label>
            Board to challenge
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
            Friend's email
            <input type="email" aria-label="Friend's email" placeholder="name@email.com" value={challengeEmail} onChange={(e) => setChallengeEmail(e.target.value)} />
          </label>
          <label>
            Note on the score link
            <input type="text" aria-label="Note on the score link" value={challengeMsg} onChange={(e) => setChallengeMsg(e.target.value)} maxLength={120} />
          </label>
          {shareLink ? <code className="share-link-preview">{shareLink}</code> : null}
          </ShareBar>
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
            inviteUrl={playUrl}
            inviteText={playerName ? `${playerName} invited you to play Roman's Game.` : "Come play Roman's Game with me."}
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

      {/* Footer removed 2026-10-19: sound, version, feedback, privacy, legal all moved to About section */}
      {/* Keep clear of Netlify “Powered by” badge */}
      <div className="netlify-safe" aria-hidden />
      {/* 10.06: Unseen heckler pop-up — visual only, never blocks input */}
      <UnseenPopup pop={unseenPop} />
      {/* PR #53 batch 2 (Tony 2026-10-19): the Unseen as guide character + silent pet pop-outs */}
      <UnseenGuide
        guide={guide}
        onGo={goGuideTarget}
        onDismiss={() => setGuide(null)}
        onDone={() => setGuide(null)}
      />
      <PetPopout
        pop={petPop}
        onGo={() => { if (petPop) goGuideTarget({ screen: 'stable', pet: petPop.id }) }}
        onDismiss={() => setPetPop(null)}
        onDone={() => setPetPop(null)}
      />
      {/* 10.06: treat defense — wild pets vs the field treat pile (home + play) */}
      <TreatDefense
        active={screen === 'play' && !celebrate && !defeated && !showWheel && !rotatePaused}
        defenders={(Object.keys(pets.owned) as PetId[]).slice(0, 3)}
        allOwned={Object.keys(pets.owned) as PetId[]}
        levels={Object.fromEntries((Object.keys(pets.owned) as PetId[]).map((id) => [id, levelInfo(petXp(pets, id)).level]))}
        fieldTreats={pets.fieldTreats ?? 0}
        mode="play"
        onApproach={handleDefenseApproach}
        onCaught={handleDefenseCaught}
        onScared={handleDefenseScared}
        onStolen={handleDefenseStolen}
      />
    </div>
  )
}

/** First-share name. On a phone the card is pinned above the keyboard; desktop stays centered. */
function NamePromptSheet({
  touch,
  nameDraft,
  setNameDraft,
  onClose,
  signedIn,
}: {
  touch: boolean
  nameDraft: string
  setNameDraft: (value: string) => void
  onClose: (save: boolean) => void
  signedIn?: boolean
}) {
  const form = (
    <form
      className="start-sheet-card"
      onSubmit={(e) => {
        e.preventDefault()
        onClose(true)
      }}
    >
      <div className="kb-name-copy">
        <h3>What should we call you?</h3>
        <p className="start-sheet-tip">
          Your name goes on the scores you share, like “{cleanPlayerName(nameDraft) || 'Sam'} scored 1,840 on Level 1”. {signedIn ? 'It updates your account too.' : 'It stays on this device.'} You can change it later in Account &amp; settings.
        </p>
      </div>
      <input
        className="name-input"
        type="text"
        value={nameDraft}
        maxLength={PLAYER_NAME_MAX}
        placeholder="Your name"
        autoComplete="nickname"
        enterKeyHint="done"
        aria-label="Your name"
        data-testid="share-name-input"
        onChange={(e) => setNameDraft(e.target.value.slice(0, PLAYER_NAME_MAX))}
      />
      <button type="submit" className="btn primary" disabled={!cleanPlayerName(nameDraft)}>
        Save
      </button>
      <button type="button" className="btn ghost" onClick={() => onClose(false)}>
        Skip (share as “I scored…”)
      </button>
    </form>
  )
  if (touch) return <KeyboardNameSheet label="Your name">{form}</KeyboardNameSheet>
  return createPortal(
    <div className="start-sheet name-prompt" role="dialog" aria-modal="true" aria-label="Your name">
      <div className="start-sheet-scrim" />
      {form}
    </div>,
    document.body,
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
