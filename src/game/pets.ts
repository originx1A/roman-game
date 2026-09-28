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

// ---------- levels ----------
export const MAX_PET_LEVEL = 10
/** XP to go from level L to L+1 */
export function xpToNext(level: number): number {
  return 30 + 15 * (level - 1)
}
export function levelInfo(xp: number): { level: number; into: number; need: number; max: boolean } {
  let level = 1
  let left = Math.max(0, Math.floor(xp || 0))
  while (level < MAX_PET_LEVEL && left >= xpToNext(level)) {
    left -= xpToNext(level)
    level += 1
  }
  const max = level >= MAX_PET_LEVEL
  return { level, into: max ? 0 : left, need: max ? 0 : xpToNext(level), max }
}
/** XP for a win with the buddy active */
export function winXp(o: { perfect: boolean; record: boolean }): number {
  return 10 + (o.perfect ? 5 : 0) + (o.record ? 5 : 0)
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

export function perkFor(id: PetId, level: number): Perk {
  const L = Math.min(MAX_PET_LEVEL, Math.max(1, Math.floor(level)))
  const base: Perk = { coins: 0, coinPct: 0, hints: 0, hearts: 0, rescues: 0, label: '' }
  switch (id) {
    case 'lupa': {
      const coins = 5 + L
      return { ...base, coins, label: `+${coins} coins every win`, next: L < MAX_PET_LEVEL ? `+1 coin per level (max +${5 + MAX_PET_LEVEL})` : undefined }
    }
    case 'aquila': {
      const hints = L >= 6 ? 2 : 1
      return { ...base, hints, label: `${hints} free hint${hints > 1 ? 's' : ''} every board`, next: L < 6 ? 'Level 6: 2 free hints' : undefined }
    }
    case 'leo': {
      const coins = L >= 5 ? L - 2 : 0
      return { ...base, hearts: 1, coins, label: coins ? `+1 heart every board, +${coins} coins a win` : '+1 heart every board', next: L < 5 ? 'Level 5: also +3 coins a win' : L < MAX_PET_LEVEL ? '+1 coin per level' : undefined }
    }
    case 'invictus': {
      const coinPct = 9 + L
      return { ...base, coinPct, label: `+${coinPct}% coins every win`, next: L < MAX_PET_LEVEL ? `+1% per level (max +${9 + MAX_PET_LEVEL}%)` : undefined }
    }
    case 'nox': {
      const rescues = L >= 6 ? 2 : 1
      return { ...base, rescues, label: `${rescues} free Rescue${rescues > 1 ? 's' : ''} every board`, next: L < 6 ? 'Level 6: 2 free Rescues' : undefined }
    }
  }
}

/** Win coins with the active buddy's coin perks (applied after badge bonuses) */
export function petWinCoins(paid: number, perk: Perk | null): number {
  if (!perk) return 0
  return perk.coins + Math.floor((paid * perk.coinPct) / 100)
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
}

export const PETS_KEY = 'roman.pets.v1'
export const DAY_MS = 86_400_000
export const TRIAL_MS = DAY_MS
export const COUPON_DAYS = 7
export const MAX_COUPONS = 4
export const STREAK_COUPON_PCT = 20
export const TRIAL_CLEAR_COUPON_PCT = 30
export const TRIAL_END_COUPON_PCT = 25

export function emptyPets(): PetState {
  return { v: 1, owned: {}, active: null, trial: null, coupons: [], redeemed: [], streakCouponAt: 0 }
}

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d)

/** Saved state from any older build (or junk) → a valid state. Missing = no buddies (Solo). */
export function sanitizePets(raw: unknown): PetState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = emptyPets()
  const owned = (r.owned && typeof r.owned === 'object' ? r.owned : {}) as Record<string, unknown>
  for (const p of PETS) {
    const o = owned[p.id] as Record<string, unknown> | undefined
    if (o && typeof o === 'object') out.owned[p.id] = { at: num(o.at), xp: Math.max(0, num(o.xp)), ...(o.gift === true ? { gift: true } : {}) }
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
  return id ? perkFor(id, levelInfo(petXp(s, id)).level) : null
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
export function addPetXp(s: PetState, id: PetId | null, xp: number, now: number): { state: PetState; levelUp: number | null } {
  if (!id || xp <= 0) return { state: s, levelUp: null }
  const before = levelInfo(petXp(s, id)).level
  let state = s
  if (s.owned[id]) state = { ...s, owned: { ...s.owned, [id]: { ...s.owned[id]!, xp: s.owned[id]!.xp + xp } } }
  else if (s.trial?.id === id && s.trial.until > now) state = { ...s, trial: { ...s.trial, xp: s.trial.xp + xp } }
  else return { state: s, levelUp: null }
  const after = levelInfo(petXp(state, id)).level
  return { state, levelUp: after > before ? after : null }
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
