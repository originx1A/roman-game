/** Modes the scores table already accepts. Practice is not one of them. */
export type CloudScoreMode = 'normal' | 'trial' | 'daily' | 'endless' | 'remix' | 'other'

/**
 * How a finished game is labeled when it is saved.
 * Practice (a Daily replay, or a Daily restarted mid-run) is not saved, so it cannot reach the board.
 * A Remix board is `remix`. It used to fall through to `normal`, or to `other` when the run was neither.
 */
export function cloudModeForWin(input: {
  practice: boolean
  daily: boolean
  endless: boolean
  trial: boolean
  remix: boolean
}): CloudScoreMode | null {
  if (input.practice) return null
  if (input.daily) return 'daily'
  if (input.endless) return 'endless'
  if (input.remix) return 'remix'
  if (input.trial) return 'trial'
  return 'normal'
}
