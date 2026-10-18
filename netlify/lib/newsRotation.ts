/**
 * Optional pre-written story pool.
 *
 * No pool exists today. The live publisher does not retire stories or keep a
 * queue in this repo (see newsSource.ts). These rules run only when a pool
 * record is present in Netlify Blobs under `story-pool`. Selection is oldest
 * unused first. A story with `usedOn` set is never selected again.
 */

export const LOW_STOCK_UNDER = 14

export interface PoolStory {
  id: string
  title: string
  excerpt: string
  link: string
  image?: string
  /** ISO time the story was added to the pool. Oldest unused is next. */
  addedAt: string
  /** Toronto date (YYYY-MM-DD) once the publisher has used it. */
  usedOn?: string | null
}

export function unusedStories(pool: PoolStory[]): PoolStory[] {
  return pool
    .filter((story) => !story.usedOn)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id))
}

export function pickOldestUnused(pool: PoolStory[]): PoolStory | null {
  return unusedStories(pool)[0] ?? null
}

export function markStoryUsed(pool: PoolStory[], id: string, usedOn: string): PoolStory[] {
  return pool.map((story) => (story.id === id ? { ...story, usedOn } : story))
}

export function isLowStock(pool: PoolStory[]): boolean {
  return unusedStories(pool).length < LOW_STOCK_UNDER
}

export function parsePool(raw: unknown): PoolStory[] | null {
  if (!Array.isArray(raw)) return null
  const out: PoolStory[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<PoolStory>
    if (typeof row.id !== 'string' || typeof row.addedAt !== 'string') continue
    out.push({
      id: row.id,
      title: typeof row.title === 'string' ? row.title : row.id,
      excerpt: typeof row.excerpt === 'string' ? row.excerpt : '',
      link: typeof row.link === 'string' ? row.link : 'https://romansgame.com/news/',
      image: typeof row.image === 'string' ? row.image : undefined,
      addedAt: row.addedAt,
      usedOn: typeof row.usedOn === 'string' && row.usedOn ? row.usedOn : null,
    })
  }
  return out
}
