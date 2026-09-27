/**
 * "Next board" after a win (9.27-b):
 * 1. another unbeaten board of the same size (level order), never the board just played;
 * 2. once that size is all beaten, the first unbeaten board of the next bigger size (sizes with
 *    nothing left are skipped); after the biggest size it wraps around to the smallest;
 * 3. once every board is beaten, replay by size: finish a pass through the current size (least
 *    recently beaten first), then the next size up, looping back to the smallest after the biggest;
 * 4. a locked size is never entered: the player keeps cycling the current size instead.
 * Pure: works from the level list and the saved clears only.
 */

export interface BoardRef {
  id: string
  size: number
}

export interface ClearInfo {
  puzzleId: string
  /** Set on every clear (9.27-b+). */
  lastClearedAt?: string
  /** Older saves: time of the best clear. */
  clearedAt?: string
}

export interface NextBoardOptions {
  /** Lock rule, if the game has one. No locks today. */
  isSizeLocked?: (size: number) => boolean
}

const when = (c: ClearInfo | undefined): number => {
  const t = Date.parse(c?.lastClearedAt ?? c?.clearedAt ?? '')
  return Number.isFinite(t) ? t : 0
}

export function pickNextBoard<B extends BoardRef>(
  current: BoardRef,
  boards: readonly B[],
  clears: readonly ClearInfo[],
  opts: NextBoardOptions = {},
): B {
  const locked = (size: number) => size !== current.size && !!opts.isSizeLocked?.(size)
  const byId = new Map(clears.map((c) => [c.puzzleId, c]))
  const beaten = (b: BoardRef) => b.id === current.id || byId.has(b.id)
  const others = boards.filter((b) => b.id !== current.id)
  const sizes = [...new Set(boards.map((b) => b.size))].sort((a, b) => a - b)
  const ofSize = (size: number) => others.filter((b) => b.size === size)
  const leastRecent = (list: B[]) =>
    list.reduce<B | undefined>((best, b) => (!best || when(byId.get(b.id)) < when(byId.get(best.id)) ? b : best), undefined)

  // Sizes to try after the current one: bigger ones first, then wrap to the smallest.
  // A locked size stops the walk (we never jump past a lock).
  const up = sizes.filter((s) => s > current.size)
  const wrap = sizes.filter((s) => s < current.size)
  const reachable: number[] = []
  for (const s of [...up, ...wrap]) {
    if (locked(s)) break
    reachable.push(s)
  }

  // 1 + 2: unbeaten boards, same size first, then the next sizes in order
  for (const s of [current.size, ...reachable]) {
    const fresh = ofSize(s).find((b) => !beaten(b))
    if (fresh) return fresh
  }

  // 3: everything reachable is beaten. Keep replaying this size while some board of it was last
  // beaten before the latest clear of any other size (i.e. not yet replayed in this pass).
  const otherSizes = clears.filter((c) => {
    const b = boards.find((x) => x.id === c.puzzleId)
    return b && b.size !== current.size
  })
  const passStart = otherSizes.reduce((m, c) => Math.max(m, when(c)), 0)
  const same = ofSize(current.size)
  const pending = same.filter((b) => when(byId.get(b.id)) < passStart)
  if (pending.length) return leastRecent(pending) as B
  const nextSize = reachable[0]
  if (nextSize != null) {
    const pick = leastRecent(ofSize(nextSize))
    if (pick) return pick
  }
  // Next size locked (or no other size): cycle this size, least recently beaten first
  return leastRecent(same) ?? leastRecent(others) ?? (boards[0] as B)
}
