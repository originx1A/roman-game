import type { CoinPackId } from './iap'

/** Pack the website shop is allowed to show. Prices are labels from the server. */
export interface WebPackOffer {
  id: CoinPackId
  productId: string
  label: string
  coins: number
  priceLabel: string
}

const PACK_IDS: readonly CoinPackId[] = ['coins_500', 'coins_1200', 'coins_3000']

function isPackId(value: unknown): value is CoinPackId {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value)
}

export function parseWebPacks(data: unknown): WebPackOffer[] | null {
  if (!data || typeof data !== 'object') return null
  const packs = (data as { packs?: unknown }).packs
  if (!Array.isArray(packs) || packs.length === 0) return null
  const offers: WebPackOffer[] = []
  for (const item of packs) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    if (!isPackId(row.id)) continue
    if (typeof row.productId !== 'string' || typeof row.label !== 'string') return null
    if (typeof row.priceLabel !== 'string' || row.priceLabel.length === 0 || row.priceLabel.length > 40) return null
    if (typeof row.coins !== 'number' || !Number.isInteger(row.coins) || row.coins <= 0) return null
    offers.push({
      id: row.id,
      productId: row.productId,
      label: row.label,
      coins: row.coins,
      priceLabel: row.priceLabel,
    })
  }
  return offers.length > 0 ? offers : null
}

export function cheapestWebPack(packs: WebPackOffer[], gap: number): WebPackOffer {
  const sorted = [...packs].sort((a, b) => a.coins - b.coins)
  return sorted.find((pack) => pack.coins >= gap) ?? sorted[sorted.length - 1]!
}

export async function loadWebPacks(): Promise<WebPackOffer[] | null> {
  const res = await fetch('/api/packs', { headers: { accept: 'application/json' } })
  if (!res.ok) return null
  return parseWebPacks(await res.json())
}
