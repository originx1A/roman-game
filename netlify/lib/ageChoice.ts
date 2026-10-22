export type AgeChoice = '13_plus' | 'under_13'

/** Missing or anything else is unanswered. Unanswered is not under-13. */
export function readAgeChoice(value: unknown): AgeChoice | null {
  if (value === '13_plus' || value === 'under_13') return value
  return null
}

export const PARENT_HOLD_MS = 7 * 24 * 60 * 60 * 1000
