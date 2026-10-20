/** +1,200 — the amount stays one token so it never breaks mid-number. */
export function formatPackCoins(coins: number): string {
  return `+${coins.toLocaleString('en-US')}`
}

/** Small pack is a short stack. Larger packs are wider and taller. */
export function coinStackDiscs(coins: number): number {
  if (coins >= 2500) return 5
  if (coins >= 1000) return 3
  return 2
}
