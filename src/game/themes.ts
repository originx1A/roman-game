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
 * Build 9.28-b: every theme uses the same 8 color families (maroon, orange, yellow,
 * mint, teal, blue, indigo, pink), tuned per theme. Each set was picked so all pairs
 * stay clearly apart for normal vision and in deuteranopia / protanopia simulation
 * (Machado 2009, CIEDE2000 >= ~14). Light and dark shades alternate so lightness
 * separates colors even when hue can't. Each color slot also has a shape mark
 * (see TILE_SHAPES) so color is never the only cue.
 */
export const THEMES: Record<ThemeId, BoardTheme> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    tagline: 'Sunny buddies',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 22, 58, 148, 183, 212, 246, 333],
    sats: [68, 68, 84, 68, 68, 80, 68, 72],
    lits: [36, 56, 56, 66, 42, 48, 36, 52],
    className: 'theme-classic',
    voiceEvent: null,
  },
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic Void',
    tagline: 'Starlit mystery',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 22, 52, 148, 183, 212, 246, 333],
    sats: [64, 64, 84, 64, 64, 80, 64, 72],
    lits: [36, 53, 53, 63, 39, 45, 36, 49],
    className: 'theme-cosmic',
    voiceEvent: 'theme-cosmic',
  },
  ruins: {
    id: 'ruins',
    label: 'Ancient Ruins',
    tagline: 'Forgotten stone',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 14, 52, 148, 183, 212, 246, 333],
    sats: [60, 42, 60, 60, 60, 60, 60, 60],
    lits: [36, 53, 55, 65, 41, 47, 36, 51],
    className: 'theme-ruins',
    voiceEvent: 'theme-ruins',
  },
  neon: {
    id: 'neon',
    label: 'Neon Night',
    tagline: 'Electric streets',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 16, 58, 146, 183, 212, 246, 331],
    sats: [80, 80, 96, 80, 80, 80, 80, 80],
    lits: [36, 62, 50, 70, 42, 48, 36, 50],
    className: 'theme-neon',
    voiceEvent: 'theme-neon',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Deep',
    tagline: 'Abyss glow',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 22, 58, 148, 183, 212, 246, 333],
    sats: [64, 64, 75, 64, 64, 76, 64, 72],
    lits: [36, 55, 51, 65, 41, 47, 36, 51],
    className: 'theme-ocean',
    voiceEvent: 'theme-ocean',
  },
  ember: {
    id: 'ember',
    label: 'Ember Peak',
    tagline: 'Molten heat',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 22, 54, 148, 183, 212, 246, 333],
    sats: [66, 66, 90, 66, 66, 80, 66, 72],
    lits: [36, 56, 56, 66, 42, 48, 36, 52],
    className: 'theme-ember',
    voiceEvent: 'theme-ember',
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal Cave',
    tagline: 'Prism hush',
    // maroon · orange · yellow · mint · teal · blue · indigo · pink (colorblind-checked)
    hues: [356, 18, 48, 148, 183, 212, 246, 333],
    sats: [64, 48, 68, 64, 64, 70, 64, 70],
    lits: [36, 57, 53, 69, 45, 51, 36, 55],
    className: 'theme-crystal',
    voiceEvent: 'theme-crystal',
  },
}

/** Shape mark per palette slot (same color = same shape on every board). */
export const TILE_SHAPES = ['dot', 'triangle', 'star', 'diamond', 'square', 'plus', 'ring', 'heart'] as const
export type TileShape = (typeof TILE_SHAPES)[number]

export interface RegionColor {
  hue: number
  sat: number
  lit: number
  /** Palette slot → shape mark. */
  shape: TileShape
  /** Mark ink that reads on this tile: dark ink on light tiles, light ink on dark ones. */
  ink: 'dark' | 'light'
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

const CVD: number[][][] = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  // deuteranopia / protanopia (Machado et al. 2009, severity 1)
  [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
]

function labOf(rgb: [number, number, number], m: number[][]): [number, number, number] {
  const lin = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const v = m.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))
  const X = (0.4124 * v[0] + 0.3576 * v[1] + 0.1805 * v[2]) / 0.95047
  const Y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  const Z = (0.0193 * v[0] + 0.1192 * v[1] + 0.9505 * v[2]) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

/** Perceptual distance (CIE76) — the smallest of normal, deutan and protan views. */
export function colorGap(
  a: { hue: number; sat: number; lit: number },
  b: { hue: number; sat: number; lit: number },
): number {
  const ra = hslToRgb(a.hue, a.sat, a.lit)
  const rb = hslToRgb(b.hue, b.sat, b.lit)
  let min = Infinity
  for (const m of CVD) {
    const la = labOf(ra, m)
    const lb = labOf(rb, m)
    min = Math.min(min, Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]))
  }
  return min
}

/** CIE L* of a tile color (0–100). */
export function tileLightness(c: { hue: number; sat: number; lit: number }): number {
  return labOf(hslToRgb(c.hue, c.sat, c.lit), CVD[0])[0]
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
): Map<number, RegionColor> {
  const theme = THEMES[themeId]
  const unique = [...new Set(regions)].sort((a, b) => a - b)
  const palette = expandPalette(theme, unique.length)
  const n = palette.hues.length
  const slot = (pi: number) => ({ hue: palette.hues[pi], sat: palette.sats[pi], lit: palette.lits[pi] })
  const gapCache = new Map<number, number>()
  const gap = (a: number, b: number): number => {
    const key = Math.min(a, b) * 1000 + Math.max(a, b)
    let v = gapCache.get(key)
    if (v == null) {
      v = colorGap(slot(a), slot(b))
      gapCache.set(key, v)
    }
    return v
  }

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
      // Neighbors get the most distinct pair (checked for color-blind views too)
      let minDist = 150
      for (const nb of adj.get(reg) ?? []) {
        const npi = assigned.get(nb)
        if (npi == null) continue
        minDist = Math.min(minDist, gap(pi, npi))
      }
      // Strongly prefer never-used slots so every section looks unique
      const uniqueBonus = usedGlobal.has(pi) ? 0 : 400
      return uniqueBonus + minDist
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

  const out = new Map<number, RegionColor>()
  for (const reg of unique) {
    const pi = assigned.get(reg) ?? reg % n
    const c = slot(pi)
    out.set(reg, {
      ...c,
      shape: TILE_SHAPES[pi % TILE_SHAPES.length],
      ink: tileLightness(c) > 62 ? 'dark' : 'light',
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
