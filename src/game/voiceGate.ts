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

export function createVoiceGate(rules: Readonly<Record<string, GateRule>> = VOICE_GATES, rand: () => number = Math.random) {
  const last = new Map<string, number>()
  return {
    /** true = let this moment speak (and remember when) */
    allow(event: string, now: number): boolean {
      const rule = rules[event]
      if (!rule) return true
      const prev = last.get(event)
      if (prev != null && now - prev < rule.gapMs) return false
      if (rand() >= rule.chance) return false
      last.set(event, now)
      return true
    },
    reset() {
      last.clear()
    },
  }
}
