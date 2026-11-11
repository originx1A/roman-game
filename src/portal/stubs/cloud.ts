/**
 * Portal stand-in for src/cloud/cloud.ts.
 * No Supabase, auth API, Turnstile, Kit, or score upload.
 */
export interface CardProgress {
  boards: number
  days: number
  pieces: number
  needed: number
  earned: boolean
}

export function onCardProgress(fn: (p: CardProgress | null) => void): () => void {
  fn(null)
  return () => {}
}

export async function initCloud(): Promise<void> {}

export function saveScore(_row: unknown): void {}
