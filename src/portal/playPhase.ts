export type PlayPhase = 'idle' | 'playing'
export type PlayCall = 'gameplayStart' | 'gameplayStop'

/**
 * Poki forbids two gameplayStart calls in a row, and two gameplayStop calls in a row.
 * This is the shipping rule. Tests exercise it directly. The browser SDK is not involved.
 */
export function nextPlayPhase(
  phase: PlayPhase,
  event: 'input' | 'interrupt',
): { phase: PlayPhase; call: PlayCall | null } {
  if (event === 'input') {
    if (phase === 'playing') return { phase, call: null }
    return { phase: 'playing', call: 'gameplayStart' }
  }
  if (phase === 'idle') return { phase, call: null }
  return { phase: 'idle', call: 'gameplayStop' }
}
