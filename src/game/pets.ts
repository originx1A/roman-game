/*
 * Buddies + The Stable (build 9.30-a).
 *
 * "Buddies" here are the player's Roman-themed pets (not the pieces on the board). They are
 * permanent once owned, one is active at a time (or Solo), each has one small perk that grows a
 * little with level, and they level up by winning boards with them. Coins only: there are no
 * random paid loot boxes. Coupons, 24h trial buddies and gift codes are the only discounts.
 *
 * Everything in here is pure (state in, state out) so it is unit-tested; App saves the state.
 */
import { dailyCoins, NEW_BEST_COINS, PERFECT_BONUS, scoreRunV2, STAR_COINS, targetsFor } from './replay'

export type PetId = 'lupa' | 'aquila' | 'leo' | 'invictus' | 'nox'
export type PetTier = 'common' | 'rare' | 'epic' | 'legendary' | 'limited'
export type PerkKind = 'coins' | 'hint' | 'heart' | 'coinPct' | 'rescue'

export interface PetDef {
  id: PetId
  name: string
  species: string
  tier: PetTier
  price: number
  perk: PerkKind
  /** One line about the buddy for the card */
  blurb: string
  /** Limited (holiday) buddies: sold only between these month-days (Toronto), kept forever */
  limited?: { from: string; to: string; label: string }
}

export const PETS: readonly PetDef[] = [
  { id: 'lupa', name: 'Lupa', species: 'Wolf Pup', tier: 'common', price: 3600, perk: 'coins', blurb: 'Raised on the seven hills. Sniffs out loose coins.' },
  { id: 'aquila', name: 'Aquila', species: 'Eagle', tier: 'rare', price: 6000, perk: 'hint', blurb: 'The legion eagle. Sees the right square from up high.' },
  { id: 'leo', name: 'Leo', species: 'Lion Cub', tier: 'epic', price: 9500, perk: 'heart', blurb: 'Brave little lion. Lends you an extra heart.' },
  { id: 'invictus', name: 'Invictus', species: 'War Horse', tier: 'legendary', price: 25000, perk: 'coinPct', blurb: "Caesar's own charger. Every win pays more." },
  {
    id: 'nox',
    name: 'Nox',
    species: 'Halloween Owl',
    tier: 'limited',
    price: 5000,
    perk: 'rescue',
    blurb: 'Hoots once a year. Swoops in to rescue a bad buddy.',
    limited: { from: '10-15', to: '11-02', label: 'Halloween' },
  },
]

export const TIER_LABEL: Record<PetTier, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', limited: 'Limited' }

export function petById(id: unknown): PetDef | undefined {
  return PETS.find((p) => p.id === id)
}

// ---------- levels (9.30-m: 30 levels + prestige stars) ----------
export const MAX_PET_LEVEL = 30
export const MAX_STARS = 5
/** XP to go from level L to L+1. Levels 1-9 are the old curve (saves keep their level); after that each level costs a bit more. */
export function xpToNext(level: number): number {
  return level < 10 ? 30 + 15 * (level - 1) : 100 + 12 * (level - 10)
}
/** XP for each prestige star after level 30 */
export function starNeed(star: number): number {
  return 1000 + 300 * Math.max(0, star)
}
export interface LevelInfo {
  level: number
  into: number
  need: number
  max: boolean
  /** prestige stars earned after level 30 (0-5) */
  stars: number
  /** XP into the next star / the XP it needs (0 until level 30; 0 need at 5 stars) */
  starInto: number
  starNeedXp: number
}
export function levelInfo(xp: number): LevelInfo {
  let level = 1
  let left = Math.max(0, Math.floor(xp || 0))
  while (level < MAX_PET_LEVEL && left >= xpToNext(level)) {
    left -= xpToNext(level)
    level += 1
  }
  const max = level >= MAX_PET_LEVEL
  let stars = 0
  let starInto = 0
  if (max) {
    starInto = left
    while (stars < MAX_STARS && starInto >= starNeed(stars)) {
      starInto -= starNeed(stars)
      stars += 1
    }
    if (stars >= MAX_STARS) starInto = 0
  }
  return {
    level,
    into: max ? 0 : left,
    need: max ? 0 : xpToNext(level),
    max,
    stars,
    starInto: max ? starInto : 0,
    starNeedXp: max && stars < MAX_STARS ? starNeed(stars) : 0,
  }
}
/** Total XP to reach a level (for the sim and the docs) */
export function xpForLevel(level: number): number {
  let t = 0
  for (let l = 1; l < Math.min(MAX_PET_LEVEL, level); l++) t += xpToNext(l)
  return t
}
/** XP for a win with the buddy active */
export function winXp(o: { perfect: boolean; record: boolean }): number {
  return 10 + (o.perfect ? 5 : 0) + (o.record ? 5 : 0)
}

// ---------- milestones ----------
export interface Milestone {
  level: number
  /** what it unlocks, in plain words */
  text: string
  /** short badge name shown on the card */
  badge?: string
}
export const MILESTONES: readonly Milestone[] = [
  { level: 5, text: 'Friend badge', badge: 'Friend' },
  { level: 10, text: 'Laurel hat + Rising Star badge', badge: 'Rising Star' },
  { level: 15, text: 'Sway animation + a stronger perk', badge: 'Trusted' },
  { level: 20, text: 'Legion helmet + Veteran badge', badge: 'Veteran' },
  { level: 25, text: 'Flip animation + a stronger perk', badge: 'Hero' },
  { level: 30, text: 'Golden crown + Champion badge, prestige stars open', badge: 'Champion' },
]
export function nextMilestone(level: number): Milestone | null {
  return MILESTONES.find((m) => m.level > level) ?? null
}
export function milestonesReached(level: number): Milestone[] {
  return MILESTONES.filter((m) => m.level <= level)
}
/** The milestone a level-up just crossed (if any) */
export function milestoneAt(level: number): Milestone | null {
  return MILESTONES.find((m) => m.level === level) ?? null
}
/** Cosmetics a level has earned: hat (10 laurel, 20 helmet, 30 crown), idle animation (15), tap animation (25) */
export function cosmeticsFor(level: number, stars = 0): { hat: 'none' | 'laurel' | 'helmet' | 'crown'; idle: boolean; flip: boolean; stars: number } {
  return { hat: level >= 30 ? 'crown' : level >= 20 ? 'helmet' : level >= 10 ? 'laurel' : 'none', idle: level >= 15, flip: level >= 25, stars }
}

// ---------- mood (never punishing: it has a floor, and a sad buddy still gives its full base perk) ----------
export const MOOD_START = 50
export const MOOD_FLOOR = 20
export const MOOD_MAX = 100
export const MOOD_DECAY_PER_HOUR = 2
export const HAPPY_AT = 60
/** a win with your buddy cheers it up a little */
export const WIN_MOOD = 6
/** a happy buddy adds this many coins to each win (tapered on busy days like all win coins) */
export const HAPPY_COINS = 4
export type MoodKind = 'happy' | 'okay' | 'hungry'
export function moodNow(o: { mood?: number; moodAt?: number } | undefined, now: number): number {
  if (!o) return MOOD_START
  const m = typeof o.mood === 'number' ? o.mood : MOOD_START
  const at = typeof o.moodAt === 'number' && o.moodAt > 0 ? o.moodAt : now
  const hours = Math.max(0, now - at) / 3_600_000
  return Math.max(MOOD_FLOOR, Math.min(MOOD_MAX, Math.round(m - hours * MOOD_DECAY_PER_HOUR)))
}
export function moodKind(mood: number): MoodKind {
  return mood >= HAPPY_AT ? 'happy' : mood >= 35 ? 'okay' : 'hungry'
}

// ---------- perks ----------
export interface Perk {
  /** flat coins added to each win */
  coins: number
  /** % added to the win coin payout */
  coinPct: number
  /** free hints each board */
  hints: number
  /** extra hearts each board */
  hearts: number
  /** free Rescues each board */
  rescues: number
  /** plain words for the card */
  label: string
  /** what the next milestone adds (plain words), if any */
  next?: string
}

/** Most a perk's coins can ever add to one win (flat) and in percent, with stars and a happy mood. Tested against the economy. */
export const PERK_COINS_CAP = 32
export const PERK_PCT_CAP = 22

export function perkFor(id: PetId, level: number, stars = 0): Perk {
  const L = Math.min(MAX_PET_LEVEL, Math.max(1, Math.floor(level)))
  const st = Math.min(MAX_STARS, Math.max(0, Math.floor(stars)))
  const base: Perk = { coins: 0, coinPct: 0, hints: 0, hearts: 0, rescues: 0, label: '' }
  const starTxt = st ? ` (+${st} from stars)` : ''
  switch (id) {
    case 'lupa': {
      const coins = 5 + Math.min(L, 10) + (L >= 15 ? 3 : 0) + (L >= 25 ? 3 : 0) + st
      return { ...base, coins, label: `+${coins} coins every win${st ? starTxt : ''}`, next: L < 10 ? `+1 coin per level (to +15 at Lv10)` : L < 15 ? 'Level 15: +3 coins' : L < 25 ? 'Level 25: +3 coins' : undefined }
    }
    case 'aquila': {
      const hints = L >= 15 ? 3 : L >= 6 ? 2 : 1
      const coins = (L >= 25 ? 4 : 0) + st
      const txt = `${hints} free hint${hints > 1 ? 's' : ''} every board`
      return { ...base, hints, coins, label: coins ? `${txt}, +${coins} coins a win` : txt, next: L < 6 ? 'Level 6: 2 free hints' : L < 15 ? 'Level 15: 3 free hints' : L < 25 ? 'Level 25: also +4 coins a win' : undefined }
    }
    case 'leo': {
      const hearts = L >= 25 ? 2 : 1
      const coins = (L >= 5 ? Math.min(L, 10) - 2 : 0) + (L >= 15 ? 3 : 0) + st
      const txt = `+${hearts} heart${hearts > 1 ? 's' : ''} every board`
      return { ...base, hearts, coins, label: coins ? `${txt}, +${coins} coins a win` : txt, next: L < 5 ? 'Level 5: also +3 coins a win' : L < 10 ? '+1 coin per level (to +8 at Lv10)' : L < 15 ? 'Level 15: +3 coins' : L < 25 ? 'Level 25: a 2nd bonus heart' : undefined }
    }
    case 'invictus': {
      const coinPct = 9 + Math.min(L, 10) + (L >= 15 ? 1 : 0) + (L >= 25 ? 1 : 0)
      const coins = st
      return { ...base, coinPct, coins, label: `+${coinPct}% coins every win${st ? `, +${st} coins from stars` : ''}`, next: L < 10 ? `+1% per level (to +19% at Lv10)` : L < 15 ? 'Level 15: +1%' : L < 25 ? 'Level 25: +1%' : undefined }
    }
    case 'nox': {
      const rescues = L >= 25 ? 3 : L >= 6 ? 2 : 1
      const coins = (L >= 15 ? 4 : 0) + st
      const txt = `${rescues} free Rescue${rescues > 1 ? 's' : ''} every board`
      return { ...base, rescues, coins, label: coins ? `${txt}, +${coins} coins a win` : txt, next: L < 6 ? 'Level 6: 2 free Rescues' : L < 15 ? 'Level 15: also +4 coins a win' : L < 25 ? 'Level 25: 3 free Rescues' : undefined }
    }
  }
}

/** Win coins with the active buddy's coin perks (applied after badge bonuses) */
export function petWinCoins(paid: number, perk: Perk | null): number {
  if (!perk) return 0
  return Math.min(PERK_COINS_CAP, perk.coins) + Math.floor((paid * Math.min(PERK_PCT_CAP, perk.coinPct)) / 100)
}

// ---------- dates / limited buddies ----------
/** MM-DD in Toronto */
export function torontoMonthDay(now: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('month')}-${get('day')}`
}
/** Can this buddy be bought right now? (Limited ones only inside their window; wraps New Year.) */
export function onSale(p: PetDef, now: number): boolean {
  if (!p.limited) return true
  const md = torontoMonthDay(now)
  const { from, to } = p.limited
  return from <= to ? md >= from && md <= to : md >= from || md <= to
}

// ---------- state ----------
export interface OwnedPet {
  at: number
  xp: number
  /** Owner gift code. Shown as 'Gift from Roman' (GIFT_TAG); a flag, so older gifts show the new tag too */
  gift?: boolean
  /** 9.30-m care: mood 0-100 at `moodAt` (it drifts down slowly with time, never below the floor) */
  mood?: number
  moodAt?: number
  /** Toronto date of the last free daily pet, and of the last treats */
  careDay?: string
  feedDay?: string
  /** treats eaten on feedDay (max 3 a day) */
  fedToday?: number
}
export type CouponSource = 'streak' | 'trial-clear' | 'trial-end' | 'gift'
export interface Coupon {
  id: string
  pct: number
  /** null = any buddy */
  pet: PetId | null
  source: CouponSource
  expires: number
}
export interface PetState {
  v: 1
  owned: Partial<Record<PetId, OwnedPet>>
  active: PetId | null
  /** Free 24h trial buddy */
  trial: { id: PetId; until: number; xp: number } | null
  coupons: Coupon[]
  /** Gift codes already redeemed on this device */
  redeemed: string[]
  /** Last daily streak that paid a coupon */
  streakCouponAt: number
  /** 9.30-m: free Snacks and Feasts earned by playing (Daily, Buddy Hunt, streaks) */
  treats: { snack: number; feast: number }
}

export const PETS_KEY = 'roman.pets.v1'
export const DAY_MS = 86_400_000
export const TRIAL_MS = DAY_MS
export const COUPON_DAYS = 7
export const MAX_COUPONS = 4
export const MAX_FEEDS_PER_DAY = 3
export const STREAK_COUPON_PCT = 20
export const TRIAL_CLEAR_COUPON_PCT = 30
export const TRIAL_END_COUPON_PCT = 25

export function emptyPets(): PetState {
  return { v: 1, owned: {}, active: null, trial: null, coupons: [], redeemed: [], streakCouponAt: 0, treats: { snack: 0, feast: 0 } }
}

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d)

/** Saved state from any older build (or junk) → a valid state. Missing = no buddies (Solo). */
export function sanitizePets(raw: unknown): PetState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = emptyPets()
  const owned = (r.owned && typeof r.owned === 'object' ? r.owned : {}) as Record<string, unknown>
  for (const p of PETS) {
    const o = owned[p.id] as Record<string, unknown> | undefined
    if (o && typeof o === 'object') {
      const pet: OwnedPet = { at: num(o.at), xp: Math.max(0, Math.min(1_000_000, num(o.xp))), ...(o.gift === true ? { gift: true } : {}) }
      if (typeof o.mood === 'number' && Number.isFinite(o.mood)) {
        pet.mood = Math.max(MOOD_FLOOR, Math.min(MOOD_MAX, Math.round(o.mood)))
        pet.moodAt = Math.max(0, num(o.moodAt))
      }
      const dayRe = /^\d{4}-\d{2}-\d{2}$/
      if (typeof o.careDay === 'string' && dayRe.test(o.careDay)) pet.careDay = o.careDay
      if (typeof o.feedDay === 'string' && dayRe.test(o.feedDay)) {
        pet.feedDay = o.feedDay
        pet.fedToday = Math.max(0, Math.min(MAX_FEEDS_PER_DAY, Math.floor(num(o.fedToday))))
      }
      out.owned[p.id] = pet
    }
  }
  const t = r.trial as Record<string, unknown> | null
  if (t && petById(t.id) && !out.owned[t.id as PetId]) out.trial = { id: t.id as PetId, until: num(t.until), xp: Math.max(0, num(t.xp)) }
  if (Array.isArray(r.coupons)) {
    for (const c of r.coupons as Record<string, unknown>[]) {
      if (!c || typeof c !== 'object') continue
      const pct = num(c.pct)
      if (pct <= 0 || pct > 90) continue
      const pet = c.pet == null ? null : petById(c.pet) ? (c.pet as PetId) : undefined
      if (pet === undefined) continue
      const source = (['streak', 'trial-clear', 'trial-end', 'gift'] as const).find((s) => s === c.source) ?? 'gift'
      out.coupons.push({ id: typeof c.id === 'string' ? c.id : `c${out.coupons.length}`, pct, pet, source, expires: num(c.expires) })
    }
  }
  out.redeemed = Array.isArray(r.redeemed) ? (r.redeemed as unknown[]).filter((x): x is string => typeof x === 'string').slice(-50) : []
  out.streakCouponAt = Math.max(0, num(r.streakCouponAt))
  const tr = (r.treats && typeof r.treats === 'object' ? r.treats : {}) as Record<string, unknown>
  out.treats = { snack: Math.max(0, Math.min(99, Math.floor(num(tr.snack)))), feast: Math.max(0, Math.min(99, Math.floor(num(tr.feast)))) }
  const a = r.active
  out.active = a && (out.owned[a as PetId] || out.trial?.id === a) ? (a as PetId) : null
  return out
}

export function hasPet(s: PetState, id: PetId, now: number): boolean {
  return !!s.owned[id] || (!!s.trial && s.trial.id === id && s.trial.until > now)
}

/** The active buddy right now (a lapsed trial doesn't count) */
export function activePet(s: PetState, now: number): PetId | null {
  return s.active && hasPet(s, s.active, now) ? s.active : null
}

export function petXp(s: PetState, id: PetId): number {
  return s.owned[id]?.xp ?? (s.trial?.id === id ? s.trial.xp : 0)
}

export function activePerk(s: PetState, now: number): Perk | null {
  const id = activePet(s, now)
  if (!id) return null
  const lv = levelInfo(petXp(s, id))
  const perk = perkFor(id, lv.level, lv.stars)
  // 9.30-m: a happy owned buddy adds a few coins to each win (a hungry one just gives its normal perk)
  if (s.owned[id] && moodKind(moodNow(s.owned[id], now)) === 'happy') {
    return { ...perk, coins: perk.coins + HAPPY_COINS, label: `${perk.label} · happy +${HAPPY_COINS}` }
  }
  return perk
}

export function equip(s: PetState, id: PetId | null, now: number): PetState {
  if (id !== null && !hasPet(s, id, now)) return s
  return { ...s, active: id }
}

// ---------- coupons ----------
export function liveCoupons(s: PetState, now: number): Coupon[] {
  return s.coupons.filter((c) => c.expires > now)
}
/** Best live coupon that fits this buddy (its own, or an any-buddy one). */
export function couponFor(s: PetState, id: PetId, now: number): Coupon | null {
  let best: Coupon | null = null
  for (const c of liveCoupons(s, now)) if ((c.pet === null || c.pet === id) && (!best || c.pct > best.pct)) best = c
  return best
}
export function priceWith(price: number, coupon: Coupon | null): number {
  return coupon ? Math.round((price * (100 - coupon.pct)) / 100 / 10) * 10 : price
}

function addCoupon(s: PetState, c: Omit<Coupon, 'id'>, now: number): PetState {
  const id = `c${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  // keep the newest few; drop expired ones first, then the one expiring soonest
  let coupons = [...liveCoupons(s, now), { ...c, id }]
  while (coupons.length > MAX_COUPONS) {
    const soonest = coupons.reduce((a, b) => (b.expires < a.expires ? b : a))
    coupons = coupons.filter((x) => x !== soonest)
  }
  return { ...s, coupons }
}

/** Buddies the player could still buy (not owned, on sale), cheapest first */
export function lockedForSale(s: PetState, now: number): PetDef[] {
  return PETS.filter((p) => !s.owned[p.id] && onSale(p, now)).sort((a, b) => a.price - b.price)
}

/** Daily streak of 7, 14, 21…: 20% off the cheapest buddy you don't have. */
export function awardStreakCoupon(s: PetState, streak: number, now: number): { state: PetState; coupon: Coupon | null } {
  if (streak <= 0 || streak % 7 !== 0 || s.streakCouponAt === streak) return { state: s, coupon: null }
  const target = lockedForSale(s, now)[0]
  if (!target) return { state: { ...s, streakCouponAt: streak }, coupon: null }
  const state = addCoupon({ ...s, streakCouponAt: streak }, { pct: STREAK_COUPON_PCT, pet: target.id, source: 'streak', expires: now + COUPON_DAYS * DAY_MS }, now)
  return { state, coupon: state.coupons[state.coupons.length - 1] }
}

/** Roman's Trial clear: 30% off a buddy you don't have (random pick). */
export function awardTrialClearCoupon(s: PetState, now: number, rng = Math.random): { state: PetState; coupon: Coupon | null } {
  const pool = lockedForSale(s, now)
  if (!pool.length) return { state: s, coupon: null }
  const target = pool[Math.floor(rng() * pool.length) % pool.length]
  const state = addCoupon(s, { pct: TRIAL_CLEAR_COUPON_PCT, pet: target.id, source: 'trial-clear', expires: now + COUPON_DAYS * DAY_MS }, now)
  return { state, coupon: state.coupons[state.coupons.length - 1] }
}

// ---------- trial buddies ----------
/** A free 24h trial of a buddy you don't own (prize). Null when there's nothing to try. */
export function grantTrial(s: PetState, now: number, rng = Math.random): { state: PetState; pet: PetId | null } {
  const pool = lockedForSale(s, now)
  if (!pool.length) return { state: s, pet: null }
  const pick = pool[Math.floor(rng() * pool.length) % pool.length]
  return { state: { ...s, trial: { id: pick.id, until: now + TRIAL_MS, xp: 0 }, active: pick.id }, pet: pick.id }
}

/** Trial over: the buddy goes home, and you get a coupon for it (and Solo if it was active). */
export function expireTrial(s: PetState, now: number): { state: PetState; expired: PetId | null } {
  if (!s.trial || s.trial.until > now) return { state: s, expired: null }
  const id = s.trial.id
  let next: PetState = { ...s, trial: null, active: s.active === id && !s.owned[id] ? null : s.active }
  if (!s.owned[id]) next = addCoupon(next, { pct: TRIAL_END_COUPON_PCT, pet: id, source: 'trial-end', expires: now + COUPON_DAYS * DAY_MS }, now)
  return { state: next, expired: id }
}

// ---------- buying ----------
export type BuyResult =
  | { ok: true; state: PetState; coins: number; spent: number; coupon: Coupon | null }
  | { ok: false; reason: string }

/** Coins only. One coupon per purchase (the best one that fits is used automatically). */
export function buyPet(s: PetState, coins: number, id: PetId, now: number): BuyResult {
  const p = petById(id)
  if (!p) return { ok: false, reason: 'Unknown buddy' }
  if (s.owned[id]) return { ok: false, reason: 'Already in your Stable' }
  if (!onSale(p, now)) return { ok: false, reason: p.limited ? `${p.limited.label} buddy: back ${p.limited.from}` : 'Not for sale' }
  const coupon = couponFor(s, id, now)
  const cost = priceWith(p.price, coupon)
  if (coins < cost) return { ok: false, reason: `Need ${cost - coins} more coins` }
  const trialXp = s.trial?.id === id ? s.trial.xp : 0
  const state: PetState = {
    ...s,
    owned: { ...s.owned, [id]: { at: now, xp: trialXp } },
    trial: s.trial?.id === id ? null : s.trial,
    coupons: s.coupons.filter((c) => c !== coupon && c.expires > now),
    active: id,
  }
  return { ok: true, state, coins: coins - cost, spent: cost, coupon }
}

// ---------- bundles (coins only, 9.30-b) ----------
export type BundleId = 'starter' | 'full'
export interface BundleDef {
  id: BundleId
  name: string
  pets: PetId[]
  /** % off the combined price of the buddies you still need */
  pct: number
}
export const BUNDLES: readonly BundleDef[] = [
  { id: 'starter', name: 'Starter pack', pets: ['lupa', 'aquila'], pct: 15 },
  { id: 'full', name: 'Full Stable', pets: ['lupa', 'aquila', 'leo', 'invictus'], pct: 20 },
]
export function bundleById(id: unknown): BundleDef | undefined {
  return BUNDLES.find((b) => b.id === id)
}

export interface BundleQuote {
  bundle: BundleDef
  /** buddies in it you don't own yet */
  missing: PetId[]
  /** full price of those */
  full: number
  /** what you pay (bundle discount; coupons don't stack) */
  price: number
  save: number
  /** offered only while 2+ of its buddies are still missing */
  available: boolean
}

/** Bundle price: its % off the combined price of the buddies you still need, rounded to 10 coins */
export function bundleQuote(s: PetState, id: BundleId, now: number): BundleQuote {
  const bundle = bundleById(id)!
  const missing = bundle.pets.filter((p) => !s.owned[p] && onSale(petById(p)!, now))
  const full = missing.reduce((sum, p) => sum + petById(p)!.price, 0)
  const price = Math.round((full * (100 - bundle.pct)) / 100 / 10) * 10
  return { bundle, missing, full, price, save: full - price, available: missing.length >= 2 }
}

export type BundleResult = { ok: true; state: PetState; coins: number; spent: number; got: PetId[] } | { ok: false; reason: string }

/** Coins only. Adds every missing buddy in the bundle at once; rides with the priciest new one. */
export function buyBundle(s: PetState, coins: number, id: BundleId, now: number): BundleResult {
  if (!bundleById(id)) return { ok: false, reason: 'Unknown bundle' }
  const q = bundleQuote(s, id, now)
  if (!q.available) return { ok: false, reason: q.missing.length ? 'Just one buddy left: adopt it on its own' : 'You have all of these already' }
  if (coins < q.price) return { ok: false, reason: `Need ${q.price - coins} more coins` }
  const owned = { ...s.owned }
  for (const p of q.missing) owned[p] = { at: now, xp: s.trial?.id === p ? s.trial.xp : 0 }
  const top = [...q.missing].sort((a, b) => petById(b)!.price - petById(a)!.price)[0]
  const state: PetState = { ...s, owned, trial: s.trial && q.missing.includes(s.trial.id) ? null : s.trial, active: top }
  return { ok: true, state, coins: coins - q.price, spent: q.price, got: q.missing }
}

/** Win with a buddy: it grows. */
export function addPetXp(s: PetState, id: PetId | null, xp: number, now: number): { state: PetState; levelUp: number | null; starUp: number | null } {
  if (!id || xp <= 0) return { state: s, levelUp: null, starUp: null }
  const before = levelInfo(petXp(s, id))
  let state = s
  if (s.owned[id]) state = { ...s, owned: { ...s.owned, [id]: { ...withMood(s.owned[id]!, WIN_MOOD, now), xp: s.owned[id]!.xp + xp } } }
  else if (s.trial?.id === id && s.trial.until > now) state = { ...s, trial: { ...s.trial, xp: s.trial.xp + xp } }
  else return { state: s, levelUp: null, starUp: null }
  const after = levelInfo(petXp(state, id))
  return { state, levelUp: after.level > before.level ? after.level : null, starUp: after.stars > before.stars ? after.stars : null }
}

// ---------- care: pet, feed, mood (9.30-m) ----------
export type TreatId = 'snack' | 'feast'
export interface TreatDef {
  id: TreatId
  name: string
  cost: number
  xp: number
  mood: number
}
/** Treats are the coin sink for growth: a snack is 1 XP per coin, a feast about 1.3. Max 3 a day per buddy. */
export const TREATS: readonly TreatDef[] = [
  { id: 'snack', name: 'Snack', cost: 30, xp: 30, mood: 20 },
  { id: 'feast', name: 'Feast', cost: 90, xp: 120, mood: 45 },
]
export const CARE_XP = 15
export const CARE_MOOD = 25
export const MAX_TREAT_STOCK = 9
export function treatById(id: unknown): TreatDef | undefined {
  return TREATS.find((t) => t.id === id)
}

export interface CareInfo {
  mood: number
  kind: MoodKind
  /** the free daily pet is still available */
  canPet: boolean
  feedsLeft: number
  /** fully grown (level 30 and every star): treats would do nothing */
  maxed: boolean
}
export function careInfo(s: PetState, id: PetId, now: number, today: string): CareInfo {
  const o = s.owned[id]
  const mood = moodNow(o, now)
  const fed = o?.feedDay === today ? o.fedToday ?? 0 : 0
  const lv = levelInfo(o?.xp ?? 0)
  return { mood, kind: moodKind(mood), canPet: !!o && o.careDay !== today, feedsLeft: o ? Math.max(0, MAX_FEEDS_PER_DAY - fed) : 0, maxed: lv.max && lv.stars >= MAX_STARS }
}

function withMood(o: OwnedPet, add: number, now: number): OwnedPet {
  return { ...o, mood: Math.min(MOOD_MAX, moodNow(o, now) + add), moodAt: now }
}

export type CareResult =
  | { ok: true; state: PetState; xp: number; levelUp: number | null; starUp: number | null }
  | { ok: false; reason: string }

/** The free daily pet: a little XP and a happier buddy. Once a day per buddy. */
export function petCare(s: PetState, id: PetId, now: number, today: string): CareResult {
  const o = s.owned[id]
  if (!o) return { ok: false, reason: 'Adopt this buddy first' }
  if (o.careDay === today) return { ok: false, reason: 'Already cared for today. Come back tomorrow!' }
  const before = levelInfo(o.xp)
  const xp = before.max && before.stars >= MAX_STARS ? 0 : CARE_XP
  const next: OwnedPet = { ...withMood(o, CARE_MOOD, now), xp: o.xp + xp, careDay: today }
  const state = { ...s, owned: { ...s.owned, [id]: next } }
  const after = levelInfo(next.xp)
  return { ok: true, state, xp, levelUp: after.level > before.level ? after.level : null, starUp: after.stars > before.stars ? after.stars : null }
}

export type FeedResult =
  | { ok: true; state: PetState; coins: number; spent: number; usedStock: boolean; xp: number; levelUp: number | null; starUp: number | null }
  | { ok: false; reason: string }

/** Feed a treat: from your earned stock first, otherwise for coins. Max 3 a day per buddy. */
export function feedPet(s: PetState, coins: number, id: PetId, treat: TreatId, now: number, today: string): FeedResult {
  const o = s.owned[id]
  const t = treatById(treat)
  if (!o || !t) return { ok: false, reason: 'Adopt this buddy first' }
  const info = careInfo(s, id, now, today)
  if (info.maxed) return { ok: false, reason: 'Fully grown! Nothing left to feed' }
  if (info.feedsLeft <= 0) return { ok: false, reason: 'Full for today. Treats again tomorrow' }
  const useStock = (s.treats[treat] ?? 0) > 0
  if (!useStock && coins < t.cost) return { ok: false, reason: `Need ${t.cost - coins} more coins` }
  const before = levelInfo(o.xp)
  const fed = o.feedDay === today ? o.fedToday ?? 0 : 0
  const next: OwnedPet = { ...withMood(o, t.mood, now), xp: o.xp + t.xp, feedDay: today, fedToday: fed + 1 }
  const treats = useStock ? { ...s.treats, [treat]: s.treats[treat] - 1 } : s.treats
  const state: PetState = { ...s, treats, owned: { ...s.owned, [id]: next } }
  const after = levelInfo(next.xp)
  return {
    ok: true,
    state,
    coins: useStock ? coins : coins - t.cost,
    spent: useStock ? 0 : t.cost,
    usedStock: useStock,
    xp: t.xp,
    levelUp: after.level > before.level ? after.level : null,
    starUp: after.stars > before.stars ? after.stars : null,
  }
}

/** Free treats from play (Daily, Buddy Hunt, streaks). The stock is capped so it can't pile up forever. */
export function grantTreat(s: PetState, treat: TreatId, n = 1): PetState {
  return { ...s, treats: { ...s.treats, [treat]: Math.min(MAX_TREAT_STOCK, (s.treats[treat] ?? 0) + Math.max(0, n)) } }
}

// ---------- gifts (owner codes) ----------
/** 9.30-b: the tag on gifted buddies/coupons and in redeem messages (renamed from the owner's name in 9.30-b) */
export const GIFT_TAG = 'Gift from Roman'
export const GIFT_NOTE_MAX = 60

/** The optional reason on a gift ("Happy birthday"): one line, no control characters, max 60 */
export function cleanGiftNote(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(s).slice(0, GIFT_NOTE_MAX).join('').trim()
}

/** What a gift is, in plain words: "Aquila the Eagle", "500 coins", "30% off Leo the Lion Cub (7 days to use it)" */
export function giftLabel(g: Gift): string {
  if (g.kind === 'pack') {
    const parts = g.items.map(giftLabel)
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? 'a gift'
    return g.pack === 'all' ? `All buddies pack: ${list}` : `Gift pack: ${list}`
  }
  if (g.kind === 'pet') return petLabel(g.pet) ?? 'a buddy'
  if (g.kind === 'coins') return `${g.amount.toLocaleString('en-US')} coins`
  const who = g.pet ? petLabel(g.pet) ?? 'a buddy' : 'any buddy'
  return `${g.pct}% off ${who} (${g.days} day${g.days === 1 ? '' : 's'} to use it)`
}

/** The ready-to-send message on the owner page after making a code */
export function giftShareMessage(o: { gift: Gift; code: string; link: string; note?: string }): string {
  const note = cleanGiftNote(o.note)
  return `Roman sent you a gift in Roman's Game: ${giftLabel(o.gift)}!${note ? ` "${note}"` : ''} Tap to claim: ${o.link} (code ${o.code}, works once)`
}
/** One thing in a gift */
export type GiftItem = { kind: 'pet'; pet: PetId } | { kind: 'coins'; amount: number } | { kind: 'coupon'; pct: number; pet: PetId | null; days: number }
/** 9.30-b: a pack is several items behind one code (one claim). 'all' = the All buddies pack. */
export type GiftPack = { kind: 'pack'; pack: 'all' | 'custom'; items: GiftItem[] }
export const PACK_MAX_ITEMS = 8

/** The All buddies pack: every buddy that isn't limited (holiday ones only if asked) */
export function allBuddiesPack(includeLimited = false): GiftPack {
  return { kind: 'pack', pack: 'all', items: PETS.filter((p) => includeLimited || !p.limited).map((p) => ({ kind: 'pet' as const, pet: p.id })) }
}
export type Gift = GiftItem | GiftPack

export const GIFT_CODE_RE = /^ROMA-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/
export function normalizeGiftCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = s.startsWith('ROMA') ? s.slice(4) : s
  return `ROMA-${body}`
}

/** Apply a server-confirmed gift. A buddy you already own turns into coins instead. */
export function applyGift(s: PetState, coins: number, gift: Gift, code: string, now: number, rawNote?: string): { state: PetState; coins: number; message: string } {
  const out = gift.kind === 'pack' ? applyPack(s, coins, gift, code, now) : applyGiftInner(s, coins, gift, code, now)
  const note = cleanGiftNote(rawNote)
  return note ? { ...out, message: `${out.message} "${note}"` } : out
}

/** A pack: every item in one claim, one message listing all of it */
function applyPack(s: PetState, coins: number, gift: GiftPack, code: string, now: number): { state: PetState; coins: number; message: string } {
  let state = s
  let total = coins
  const joined: string[] = []
  let extraCoins = 0
  const coupons: string[] = []
  const already: string[] = []
  const firstActive = s.active
  for (const it of gift.items) {
    const before = total
    const r = applyGiftInner(state, total, it, code, now)
    state = r.state
    total = r.coins
    if (it.kind === 'pet') {
      const p = petById(it.pet)!
      if (s.owned[p.id]) already.push(p.name)
      else joined.push(p.name)
    }
    if (it.kind === 'coins' || (it.kind === 'pet' && s.owned[it.pet])) extraCoins += total - before
    if (it.kind === 'coupon') coupons.push(`${it.pct}% off ${it.pet ? petById(it.pet)?.name : 'any buddy'}`)
  }
  // ride with the first new buddy in the pack (or keep who you had)
  const firstNew = gift.items.find((it): it is Extract<GiftItem, { kind: 'pet' }> => it.kind === 'pet' && !s.owned[it.pet])
  state = { ...state, active: firstNew ? firstNew.pet : firstActive && hasPet(state, firstActive, now) ? firstActive : state.active }
  const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0])
  const parts: string[] = []
  if (joined.length) parts.push(`${list(joined)} joined your Stable`)
  if (extraCoins) parts.push(`+${extraCoins.toLocaleString('en-US')} coins${already.length ? ` (you already had ${list(already)})` : ''}`)
  parts.push(...coupons)
  return { state, coins: total, message: `${GIFT_TAG}: ${parts.join(', ')}!` }
}

function applyGiftInner(s: PetState, coins: number, gift: GiftItem, code: string, now: number): { state: PetState; coins: number; message: string } {
  const redeemed = [...s.redeemed.filter((c) => c !== code), code].slice(-50)
  if (gift.kind === 'coins') return { state: { ...s, redeemed }, coins: coins + gift.amount, message: `${GIFT_TAG}: +${gift.amount} coins!` }
  if (gift.kind === 'coupon') {
    const state = addCoupon({ ...s, redeemed }, { pct: gift.pct, pet: gift.pet, source: 'gift', expires: now + gift.days * DAY_MS }, now)
    const who = gift.pet ? petById(gift.pet)?.name : 'any buddy'
    return { state, coins, message: `${GIFT_TAG}: ${gift.pct}% off ${who}!` }
  }
  const p = petById(gift.pet)!
  if (s.owned[p.id]) {
    const bonus = Math.round(p.price / 10)
    return { state: { ...s, redeemed }, coins: coins + bonus, message: `You already have ${p.name}, so Roman's gift is +${bonus} coins.` }
  }
  const state: PetState = {
    ...s,
    redeemed,
    owned: { ...s.owned, [p.id]: { at: now, xp: s.trial?.id === p.id ? s.trial.xp : 0, gift: true } },
    trial: s.trial?.id === p.id ? null : s.trial,
    active: p.id,
  }
  return { state, coins, message: `${GIFT_TAG}: ${p.name} the ${p.species} joined your Stable!` }
}

// ---------- share / records ----------
export function petLabel(id: string | null | undefined): string | null {
  const p = petById(id)
  return p ? `${p.name} the ${p.species}` : null
}

// ---------- economy (measured from the reward code) ----------
/**
 * Typical coins per day, from the real payout code: win coins = max(20, score/8) with badge
 * bonus, plus star / new-best coins, plus the Daily bonus and the odd prize spin.
 * "Normal play" = 5 boards a day (about 15-20 minutes), one of them the Daily.
 */
export function estimateEconomy(o: { winsPerDay?: number; badgeBonusPct?: number; spendShare?: number } = {}) {
  const winsPerDay = o.winsPerDay ?? 5
  const badge = o.badgeBonusPct ?? 5
  const spendShare = o.spendShare ?? 0.1
  const perSize = [5, 6, 7, 8].map((size) => {
    const t = targetsFor({ size, difficulty: 'medium' })
    // a normal (not great) run: at the target time, a hint every third board, combo ~x1.2 on buddies
    const score = scoreRunV2({ size, targetMs: t.timeMs, elapsedMs: t.timeMs, hintsUsed: 0.33, perfect: false, comboPoints: size * 40 * 0.2 })
    const perfectScore = score + PERFECT_BONUS
    const avgScore = 0.6 * score + 0.4 * perfectScore
    return Math.floor(Math.max(20, Math.floor(avgScore / 8)) * (1 + badge / 100))
  })
  const perWin = perSize.reduce((a, b) => a + b, 0) / perSize.length
  // stars and new bests: early boards pay stars, later a new best now and then
  const extrasPerWin = (STAR_COINS[1] + STAR_COINS[2]) / 4 + NEW_BEST_COINS / 3
  const daily = dailyCoins(4)
  const spinsPerDay = 0.3
  const avgPrize = 38
  const gross = winsPerDay * (perWin + extrasPerWin) + daily + spinsPerDay * avgPrize
  const net = Math.round(gross * (1 - spendShare))
  return { perWin: Math.round(perWin), extrasPerWin: Math.round(extrasPerWin), daily, gross: Math.round(gross), net, winsPerDay }
}

/** Days of normal play to afford a buddy at full price */
export function daysToAfford(price: number, netPerDay = estimateEconomy().net): number {
  return Math.round((price / netPerDay) * 10) / 10
}
