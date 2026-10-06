/**
 * 9.30-j: fewer voice lines on the busy moments. Each gated moment has a minimum gap since its last
 * line and a chance to speak at all. A skipped moment draws nothing, so no shuffle bag moves and
 * lines last longer before any repeat. Win/lose/record and the other one-per-board moments are not gated.
 */
export interface GateRule {
  /** minimum ms since this moment last spoke */
  gapMs: number
  /** chance (0..1) to speak when the gap allows */
  chance: number
}

export const VOICE_GATES: Readonly<Record<string, GateRule>> = {
  'place-bad': { gapMs: 20000, chance: 0.5 },
  'place-good': { gapMs: 50000, chance: 1 },
  idle: { gapMs: 45000, chance: 1 },
  hint: { gapMs: 30000, chance: 0.6 },
  'undo-spam': { gapMs: 25000, chance: 1 },
}

/**
 * 9.30-k: the more of a moment's lines nobody has heard yet, the more easily it speaks: the gap
 * shrinks (down to 40%) and the chance climbs toward 90%. Once every line has been heard the plain
 * rule applies again, so a worn-out moment stays quiet. `unheard` is the share (0..1) of that
 * moment's lines with a heard count of 0.
 */
export const UNHEARD_MAX_CHANCE = 0.9
export const UNHEARD_MIN_GAP_SCALE = 0.4

export function createVoiceGate(rules: Readonly<Record<string, GateRule>> = VOICE_GATES, rand: () => number = Math.random) {
  const last = new Map<string, number>()
  return {
    /** true = let this moment speak (and remember when) */
    allow(event: string, now: number, unheard = 0): boolean {
      const rule = rules[event]
      if (!rule) return true
      const f = Math.min(1, Math.max(0, unheard))
      const gap = rule.gapMs * (1 - (1 - UNHEARD_MIN_GAP_SCALE) * f)
      const chance = rule.chance + Math.max(0, UNHEARD_MAX_CHANCE - rule.chance) * f
      const prev = last.get(event)
      if (prev != null && now - prev < gap) return false
      if (rand() >= chance) return false
      last.set(event, now)
      return true
    },
    reset() {
      last.clear()
    },
  }
}
