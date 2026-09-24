export type ThemeId =
  | 'classic'
  | 'cosmic'
  | 'ruins'
  | 'neon'
  | 'ocean'
  | 'ember'
  | 'crystal'

export interface BoardTheme {
  id: ThemeId
  label: string
  tagline: string
  /** High-contrast palette — hues at least ~40° apart, alternating light/dark */
  hues: number[]
  sats: number[]
  lits: number[]
  className: string
  voiceEvent:
    | 'theme-cosmic'
    | 'theme-ruins'
    | 'theme-neon'
    | 'theme-ocean'
    | 'theme-ember'
    | 'theme-crystal'
    | null
}

/**
 * Palettes designed so consecutive region indices look clearly different
 * (hue jump + sat/lit flip). Ocean/ember no longer muddy same-family clusters.
 */
export const THEMES: Record<ThemeId, BoardTheme> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    tagline: 'Sunny buddies',
    // teal · coral · royal · gold · magenta · lime · indigo · orange · sky · rose
    hues: [172, 8, 222, 46, 312, 118, 258, 28, 198, 340],
    sats: [78, 82, 74, 88, 72, 70, 68, 86, 70, 76],
    lits: [48, 58, 54, 56, 58, 46, 56, 54, 52, 60],
    className: 'theme-classic',
    voiceEvent: null,
  },
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic Void',
    tagline: 'Starlit mystery',
    // violet · cyan · hot pink · deep blue · gold · teal · lilac · lime · orange · mint
    hues: [275, 185, 328, 230, 48, 165, 295, 105, 22, 150],
    sats: [72, 78, 80, 70, 85, 60, 55, 68, 82, 58],
    lits: [58, 48, 60, 42, 56, 50, 64, 52, 54, 50],
    className: 'theme-cosmic',
    voiceEvent: 'theme-cosmic',
  },
  ruins: {
    id: 'ruins',
    label: 'Ancient Ruins',
    tagline: 'Forgotten stone',
    // sand · rust · olive · sky · terracotta · cream · moss · slate-blue · copper · sage
    hues: [42, 14, 88, 205, 18, 38, 115, 220, 28, 130],
    sats: [70, 78, 52, 55, 72, 45, 48, 40, 68, 42],
    lits: [60, 46, 48, 55, 52, 68, 42, 48, 50, 52],
    className: 'theme-ruins',
    voiceEvent: 'theme-ruins',
  },
  neon: {
    id: 'neon',
    label: 'Neon Night',
    tagline: 'Electric streets',
    // hot pink · electric teal · purple · lime · amber · cyan · violet · white-blue · red · chartreuse
    hues: [328, 168, 280, 112, 42, 190, 255, 210, 0, 95],
    sats: [92, 90, 82, 88, 90, 85, 75, 60, 88, 80],
    lits: [56, 48, 58, 52, 54, 52, 60, 62, 50, 50],
    className: 'theme-neon',
    voiceEvent: 'theme-neon',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Deep',
    tagline: 'Abyss glow',
    // navy · seafoam · coral accent · aqua · sand · deep teal · sky · magenta kiss · ice · peach
    hues: [228, 155, 12, 185, 40, 175, 205, 320, 195, 25],
    sats: [75, 62, 78, 72, 70, 68, 58, 55, 50, 70],
    lits: [40, 58, 56, 50, 60, 44, 62, 58, 64, 58],
    className: 'theme-ocean',
    voiceEvent: 'theme-ocean',
  },
  ember: {
    id: 'ember',
    label: 'Ember Peak',
    tagline: 'Molten heat',
    // crimson · gold · cool teal contrast · orange · rose · yellow · charcoal-blue · coral · plum · lime
    hues: [0, 48, 175, 28, 350, 55, 215, 14, 300, 105],
    sats: [85, 90, 55, 88, 70, 85, 45, 80, 60, 65],
    lits: [48, 56, 48, 54, 58, 58, 42, 56, 50, 50],
    className: 'theme-ember',
    voiceEvent: 'theme-ember',
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal Cave',
    tagline: 'Prism hush',
    // aqua · violet · peach · mint · orchid · sky · lemon · rose · indigo · coral
    hues: [178, 275, 22, 145, 300, 205, 58, 335, 250, 8],
    sats: [70, 62, 72, 55, 58, 60, 75, 65, 55, 70],
    lits: [52, 60, 58, 54, 62, 56, 56, 60, 50, 56],
    className: 'theme-crystal',
    voiceEvent: 'theme-crystal',
  },
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Grow a theme palette so every region can get its own color. */
function expandPalette(
  theme: BoardTheme,
  count: number,
): { hues: number[]; sats: number[]; lits: number[] } {
  const hues = [...theme.hues]
  const sats = [...theme.sats]
  const lits = [...theme.lits]
  let guard = 0
  while (hues.length < count && guard < 64) {
    guard++
    // Place a new hue farthest from all existing ones on the wheel
    let bestHue = 0
    let bestMin = -1
    for (let step = 0; step < 36; step++) {
      const h = (step * 10 + hues.length * 7) % 360
      let minD = 180
      for (const existing of hues) minD = Math.min(minD, hueDist(h, existing))
      if (minD > bestMin) {
        bestMin = minD
        bestHue = h
      }
    }
    const i = hues.length
    hues.push(bestHue)
    sats.push(sats[i % sats.length] ?? 70)
    // Alternate lightness so extras stay readable next to neighbors
    lits.push(i % 2 === 0 ? 46 : 58)
  }
  return { hues, sats, lits }
}

/**
 * Assign a distinct color to every region. Prefer unique palette slots for
 * the whole board (not only adjacent regions) so separated blocks never
 * share the same shade when enough colors exist.
 */
export function regionColorMap(
  themeId: ThemeId,
  regions: number[],
  size: number,
): Map<number, { hue: number; sat: number; lit: number }> {
  const theme = THEMES[themeId]
  const unique = [...new Set(regions)].sort((a, b) => a - b)
  const palette = expandPalette(theme, unique.length)
  const n = palette.hues.length

  // Build adjacency between region ids (4-neighborhood)
  const adj = new Map<number, Set<number>>()
  for (const r of unique) adj.set(r, new Set())
  for (let i = 0; i < regions.length; i++) {
    const a = regions[i]
    const row = Math.floor(i / size)
    const col = i % size
    const neighbors = [
      row > 0 ? i - size : -1,
      row < size - 1 ? i + size : -1,
      col > 0 ? i - 1 : -1,
      col < size - 1 ? i + 1 : -1,
    ]
    for (const j of neighbors) {
      if (j < 0) continue
      const b = regions[j]
      if (a !== b) {
        adj.get(a)!.add(b)
        adj.get(b)!.add(a)
      }
    }
  }

  // Greedy: hardest regions first
  const order = [...unique].sort((a, b) => (adj.get(b)?.size ?? 0) - (adj.get(a)?.size ?? 0))
  const assigned = new Map<number, number>() // region -> palette index
  const usedGlobal = new Set<number>()

  for (const reg of order) {
    const usedByNeighbors = new Set<number>()
    for (const nb of adj.get(reg) ?? []) {
      const pi = assigned.get(nb)
      if (pi != null) usedByNeighbors.add(pi)
    }

    const scoreSlot = (pi: number): number => {
      let minDist = 180
      for (const nb of adj.get(reg) ?? []) {
        const npi = assigned.get(nb)
        if (npi == null) continue
        minDist = Math.min(minDist, hueDist(palette.hues[pi], palette.hues[npi]))
      }
      const litClash = [...usedByNeighbors].some(
        (npi) => Math.abs(palette.lits[pi] - palette.lits[npi]) < 8,
      )
      // Strongly prefer never-used slots so every section looks unique
      const uniqueBonus = usedGlobal.has(pi) ? 0 : 400
      return uniqueBonus + minDist + (litClash ? 0 : 12)
    }

    let best = 0
    let bestScore = -1
    // Pass 1: unused globally + not used by neighbors
    for (let pi = 0; pi < n; pi++) {
      if (usedGlobal.has(pi) || usedByNeighbors.has(pi)) continue
      const score = scoreSlot(pi)
      if (score > bestScore) {
        bestScore = score
        best = pi
      }
    }
    // Pass 2: allow reuse only if every slot is taken — still avoid neighbors
    if (bestScore < 0) {
      for (let pi = 0; pi < n; pi++) {
        if (usedByNeighbors.has(pi)) continue
        const score = scoreSlot(pi)
        if (score > bestScore) {
          bestScore = score
          best = pi
        }
      }
    }
    // Pass 3: all neighbor slots blocked — pick farthest hue
    if (bestScore < 0) {
      for (let pi = 0; pi < n; pi++) {
        const score = scoreSlot(pi)
        if (score > bestScore) {
          bestScore = score
          best = pi
        }
      }
    }

    assigned.set(reg, best)
    usedGlobal.add(best)
  }

  const out = new Map<number, { hue: number; sat: number; lit: number }>()
  for (const reg of unique) {
    const pi = assigned.get(reg) ?? reg % n
    out.set(reg, {
      hue: palette.hues[pi],
      sat: palette.sats[pi],
      lit: palette.lits[pi],
    })
  }
  return out
}

export function regionStyle(themeId: ThemeId, regionIndex: number): {
  hue: number
  sat: number
  lit: number
} {
  const theme = THEMES[themeId]
  const i = ((regionIndex % theme.hues.length) + theme.hues.length) % theme.hues.length
  return { hue: theme.hues[i], sat: theme.sats[i], lit: theme.lits[i] }
}

export function themeForPuzzle(id: string, difficulty: string): ThemeId {
  const map: Record<string, ThemeId> = {
    dawn: 'classic',
    harbor: 'ocean',
    moss: 'classic',
    quiet: 'crystal',
    cedar: 'ruins',
    drift: 'ocean',
    lantern: 'ember',
    copper: 'ruins',
    valley: 'classic',
    mirror: 'crystal',
    summit: 'ember',
    current: 'ocean',
    ember: 'ember',
    hollow: 'ruins',
    signal: 'neon',
    orbit: 'cosmic',
    threshold: 'ruins',
    vault: 'crystal',
    nadir: 'cosmic',
    prism: 'crystal',
  }
  if (map[id]) return map[id]
  if (difficulty === 'expert') return 'cosmic'
  if (difficulty === 'hard') return 'neon'
  return 'classic'
}
