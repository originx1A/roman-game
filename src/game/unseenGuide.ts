/**
 * Unseen guide system (Tony 2026-10-19, PR #53 batch 2).
 *
 * The Unseen is the game's notification character: instead of dry badges, he
 * pops out with a snarky line and deep-links to the relevant page. This module
 * holds the PURE trigger evaluation — App.tsx wires state, frequency caps and
 * rendering around it.
 *
 * Voice: each guide plays its own catalog clip through the shared speech queue.
 * A guide with no clip stays hidden.
 */

import {
  careInfo,
  onSale,
  PETS,
  petById,
  type PetDef,
  type PetId,
  type PetState,
} from './pets'
import {
  BADGES,
  badgeRank,
  totalBadgePower,
  upgradeBadgeCost,
  type Wallet,
} from './rewards'
import type { Screen } from './types'

export type GuideKind = 'urgent' | 'opportunity' | 'progress'
export type GuideCategory = 'warning' | 'opportunity' | 'progress'

/** Where tapping the guide goes. `pet` deep-links to that pet's Stable detail page. */
export interface GuideTarget {
  screen: Screen
  pet?: PetId
}

export interface GuideCandidate {
  category: GuideCategory
  /** session-unique dedupe key, e.g. 'card-80', 'streak-4' */
  tag: string
  kind: GuideKind
  text: string
  target: GuideTarget
}

export interface GuideSnapshot {
  now: number
  today: string
  pets: PetState
  wallet: Wallet
  /** unseen card pieces earned */
  pieces: number
  /** unseen card pieces total (CARD_PIECES) */
  piecesTotal: number
  /** live daily streak */
  streak: number
}

/** Small number→word for the "You're N pieces from my card. N." rhythm. */
function numWord(n: number): string {
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  return n >= 0 && n <= 10 ? words[n] : String(n)
}

function speciesName(p: PetDef): string {
  return p.species.toLowerCase()
}

/** Owned pets with their current care info, lowest mood first. */
function ownedByMood(s: GuideSnapshot): { id: PetId; mood: number; kind: 'happy' | 'okay' | 'hungry' }[] {
  const out: { id: PetId; mood: number; kind: 'happy' | 'okay' | 'hungry' }[] = []
  for (const p of PETS) {
    if (!s.pets.owned[p.id]) continue
    const info = careInfo(s.pets, p.id, s.now, s.today)
    out.push({ id: p.id, mood: info.mood, kind: info.kind })
  }
  return out.sort((a, b) => a.mood - b.mood)
}

/** Days left in a limited pet's sale window (Toronto). Infinity when not limited. */
function limitedDaysLeft(p: PetDef, now: number): number {
  if (!p.limited) return Number.POSITIVE_INFINITY
  const yearNow = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric' }).format(new Date(now)),
  )
  const [tm, td] = p.limited.to.split('-').map(Number)
  // End of the 'to' day in Toronto ≈ 05:00 UTC the next morning (Nov is EST).
  for (const year of [yearNow, yearNow + 1]) {
    const end = Date.UTC(year, tm - 1, td + 1, 5, 0, 0)
    if (end > now) return Math.max(0, Math.ceil((end - now) / 86_400_000))
  }
  return 0
}

/** The recorded clip for this guide tag, or null when that line has no file. */
export function guideVoiceClip(tag: string): string | null {
  if (tag.startsWith('hungry-')) return `old_guide_hungry_${tag.slice('hungry-'.length)}`
  if (tag.startsWith('meh-')) return `old_guide_meh_${tag.slice('meh-'.length)}`
  if (tag.startsWith('drowsy-')) return 'old_guide_drowsy'
  if (tag === 'nox-expiring') return 'old_guide_nox'
  if (tag.startsWith('afford-')) return 'old_guide_afford'
  if (tag === 'badge-rankup') return 'old_guide_badge'
  if (tag.startsWith('coins-')) return `old_guide_coins_${tag.slice('coins-'.length)}`
  if (tag.startsWith('streak-')) return 'old_guide_streak'
  if (tag.startsWith('card-')) {
    const left = Number(tag.slice('card-'.length))
    if (left >= 1 && left <= 10) return `old_guide_card_${String(left).padStart(2, '0')}`
  }
  return null
}

/**
 * All guide candidates in priority order: warnings first (urgent), then
 * opportunities, then progress. App.tsx applies the frequency caps
 * (1 warning/session, 1 opportunity/session, progress tags once each).
 */
export function guideCandidates(s: GuideSnapshot): GuideCandidate[] {
  const out: GuideCandidate[] = []
  const coins = s.wallet.coins

  // ---------- warnings (urgent, red) ----------
  const owned = ownedByMood(s)
  const hungry = owned.find((o) => o.kind === 'hungry')
  if (hungry) {
    const p = petById(hungry.id)!
    out.push({
      category: 'warning',
      tag: `hungry-${hungry.id}`,
      kind: 'urgent',
      text: `Your ${speciesName(p)} is starving. I can hear its stomach from the void. Embarrassing.`,
      target: { screen: 'stable', pet: hungry.id },
    })
  } else {
    // No dormancy system exists in the game; "about to go dormant" maps to a
    // defender whose mood is in 'okay' but near the hungry boundary (mood < 45).
    const drowsy = owned.find((o) => o.kind === 'okay' && o.mood < 45)
    if (drowsy) {
      out.push({
        category: 'warning',
        tag: `drowsy-${drowsy.id}`,
        kind: 'urgent',
        text: "Your defender's about to fall asleep on the job. Feed it. Or don't. I enjoy watching failure.",
        target: { screen: 'stable', pet: drowsy.id },
      })
    } else {
      const meh = owned.find((o) => o.kind === 'okay')
      if (meh) {
        const p = petById(meh.id)!
        out.push({
          category: 'warning',
          tag: `meh-${meh.id}`,
          kind: 'urgent',
          text: `Your ${speciesName(p)} looks miserable. Have you tried... playing better?`,
          target: { screen: 'stable', pet: meh.id },
        })
      }
    }
  }

  // ---------- opportunities (green) ----------
  const unowned = PETS.filter((p) => !s.pets.owned[p.id] && onSale(p, s.now))
  const nox = petById('nox')
  if (nox && !s.pets.owned.nox && onSale(nox, s.now) && limitedDaysLeft(nox, s.now) <= 3) {
    out.push({
      category: 'opportunity',
      tag: 'nox-expiring',
      kind: 'opportunity',
      text: "That Halloween owl won't be here forever. Unlike me. I'm always here.",
      target: { screen: 'stable', pet: 'nox' },
    })
  }
  const affordable = unowned.filter((p) => p.price <= coins).sort((a, b) => a.price - b.price)[0]
  if (affordable) {
    out.push({
      category: 'opportunity',
      tag: `afford-${affordable.id}`,
      kind: 'opportunity',
      text: "You've got coins just... sitting there. The Stable has something with your name on it.",
      target: { screen: 'stable', pet: affordable.id },
    })
  }
  const rankUp = BADGES.some((b) => {
    const rank = badgeRank(s.wallet, b.id)
    return rank >= 1 && coins >= upgradeBadgeCost(b.id, rank, totalBadgePower(s.wallet))
  })
  if (rankUp) {
    out.push({
      category: 'opportunity',
      tag: 'badge-rankup',
      kind: 'opportunity',
      text: 'You could be earning more coins per win. But sure, leave money on the table.',
      target: { screen: 'rewards' },
    })
  }

  // ---------- progress (gold) ----------
  if (s.pieces < s.piecesTotal) {
    for (const t of [90, 80]) {
      if (s.pieces / s.piecesTotal >= t / 100) {
        const left = s.piecesTotal - s.pieces
        const piece = left === 1 ? 'piece' : 'pieces'
        out.push({
          category: 'progress',
          tag: `card-${left}`,
          kind: 'progress',
          text: `You're ${left} ${piece} from my card. ${numWord(left)}. Even you can't mess this up.`,
          target: { screen: 'home' },
        })
        break // highest crossed threshold only
      }
    }
  }
  const cheapest = unowned.sort((a, b) => a.price - b.price)[0]
  if (cheapest) {
    const remaining = cheapest.price - coins
    if (remaining > 0 && remaining <= 2000) {
      out.push({
        category: 'progress',
        tag: `coins-${cheapest.id}`,
        kind: 'progress',
        text: `Just a few more coins and ${cheapest.name} is yours. That's... what, a week of mediocre play?`,
        target: { screen: 'stable', pet: cheapest.id },
      })
    }
  }
  if (s.streak >= 2) {
    out.push({
      category: 'progress',
      tag: `streak-${s.streak}`,
      kind: 'progress',
      text: `Win tomorrow and that's ${s.streak + 1} days. Don't choke.`,
      target: { screen: 'home' },
    })
  }

  return out
}

/**
 * The pet the silent pop-out should show: the lowest-mood owned pet that needs
 * care ('hungry' or 'okay'), or null. No dialogue — just the visual.
 */
export function petPopoutPick(s: GuideSnapshot): { id: PetId; kind: 'hungry' | 'okay'; mood: number } | null {
  const owned = ownedByMood(s)
  const needy = owned.find((o) => o.kind !== 'happy')
  if (!needy || needy.kind === 'happy') return null
  return { id: needy.id, kind: needy.kind, mood: needy.mood }
}
