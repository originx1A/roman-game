/** Shuffle-bag picker that will not repeat one of the last few items. */

export function createShuffleBag<T>(items: readonly T[], avoidLast = 3): () => T {
  if (items.length === 0) throw new Error('empty voice pool')
  const avoid = Math.min(avoidLast, Math.max(0, items.length - 1))
  let bag: T[] = []
  const recent: T[] = []

  const shuffle = (arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  return () => {
    const blocked = new Set(recent)
    if (bag.length === 0 || bag.every((item) => blocked.has(item))) {
      const fresh = items.filter((item) => !blocked.has(item))
      bag = shuffle([...(fresh.length > 0 ? fresh : items)])
    }
    let pick = bag.pop() as T
    if (blocked.has(pick)) {
      const idx = bag.findIndex((item) => !blocked.has(item))
      if (idx >= 0) {
        const alt = bag[idx]
        bag[idx] = pick
        pick = alt
      }
    }
    recent.push(pick)
    if (recent.length > avoid) recent.shift()
    return pick
  }
}
