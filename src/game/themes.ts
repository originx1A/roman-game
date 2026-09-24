export type ThemeId =
  | 'classic'
  | 'cosmic'
  | 'ruins'
  | 'neon'
  | 'ocean'
  | 'ember'
  | 'crystal'

export interface Theme {
  id: ThemeId
  label: string
  tagline: string
  hues: number[]
  sats: number[]
  lits: number[]
  className: string
  voiceEvent: string | null
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    tagline: 'Sunny buddies',
    hues: [172,8,222,46,312,118,258,28],
    sats: [78,82,74,88,72,70,68,86],
    lits: [48,58,54,56,58,46,56,54],
    className: 'theme-classic',
    voiceEvent: null,
  },
  cosmic: {
    id: 'cosmic',
    label: 'Cosmic Void',
    tagline: 'Starlit mystery',
    hues: [275,185,328,230,48,165,295,105],
    sats: [72,78,80,70,85,60,55,68],
    lits: [58,48,60,42,56,50,64,52],
    className: 'theme-cosmic',
    voiceEvent: 'theme-cosmic',
  },
  ruins: {
    id: 'ruins',
    label: 'Ancient Ruins',
    tagline: 'Forgotten stone',
    hues: [42,14,88,205,18,38,115,220],
    sats: [70,78,52,55,72,45,48,40],
    lits: [60,46,48,55,52,68,42,48],
    className: 'theme-ruins',
    voiceEvent: 'theme-ruins',
  },
  neon: {
    id: 'neon',
    label: 'Neon Night',
    tagline: 'Electric streets',
    hues: [328,168,280,112,42,190,255,210],
    sats: [92,90,82,88,90,85,75,60],
    lits: [56,48,58,52,54,52,60,62],
    className: 'theme-neon',
    voiceEvent: 'theme-neon',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean Deep',
    tagline: 'Abyss glow',
    hues: [228,155,12,185,40,175,205,320],
    sats: [75,62,78,72,70,68,58,55],
    lits: [40,58,56,50,60,44,62,58],
    className: 'theme-ocean',
    voiceEvent: 'theme-ocean',
  },
  ember: {
    id: 'ember',
    label: 'Ember Peak',
    tagline: 'Molten heat',
    hues: [0,48,175,28,350,55,215,14],
    sats: [85,90,55,88,70,85,45,80],
    lits: [48,56,48,54,58,58,42,56],
    className: 'theme-ember',
    voiceEvent: 'theme-ember',
  },
  crystal: {
    id: 'crystal',
    label: 'Crystal Cave',
    tagline: 'Prism hush',
    hues: [178,275,22,145,300,205,58,335],
    sats: [70,62,72,55,58,60,75,65],
    lits: [52,60,58,54,62,56,56,60],
    className: 'theme-crystal',
    voiceEvent: 'theme-crystal',
  },
}

export function themeForPuzzle(puzzleId: string, difficulty: string): ThemeId {
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
  if (map[puzzleId]) return map[puzzleId]
  if (difficulty === 'expert') return 'cosmic'
  if (difficulty === 'hard') return 'neon'
  return 'classic'
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

/** Assign theme palette slots to regions so neighbors stay visually distinct. */
export function regionColorMap(
  themeId: ThemeId,
  regions: number[],
  size: number,
): Map<number, { hue: number; sat: number; lit: number }> {
  const theme = THEMES[themeId]
  const paletteLen = theme.hues.length
  const regionIds = [...new Set(regions)].sort((a, b) => a - b)
  const neighbors = new Map<number, Set<number>>()
  for (const id of regionIds) neighbors.set(id, new Set())

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i]
    const row = Math.floor(i / size)
    const col = i % size
    const adj = [
      row > 0 ? i - size : -1,
      row < size - 1 ? i + size : -1,
      col > 0 ? i - 1 : -1,
      col < size - 1 ? i + 1 : -1,
    ]
    for (const j of adj) {
      if (j < 0) continue
      const other = regions[j]
      if (r !== other) {
        neighbors.get(r)!.add(other)
        neighbors.get(other)!.add(r)
      }
    }
  }

  const order = [...regionIds].sort(
    (a, b) => (neighbors.get(b)?.size ?? 0) - (neighbors.get(a)?.size ?? 0),
  )
  const assignment = new Map<number, number>()

  for (const region of order) {
    const used = new Set<number>()
    for (const n of neighbors.get(region) ?? []) {
      const slot = assignment.get(n)
      if (slot != null) used.add(slot)
    }

    let bestSlot = 0
    let bestScore = -1
    for (let slot = 0; slot < paletteLen; slot++) {
      if (used.has(slot)) continue
      let minHue = 180
      for (const n of neighbors.get(region) ?? []) {
        const nSlot = assignment.get(n)
        if (nSlot != null) {
          minHue = Math.min(minHue, hueDistance(theme.hues[slot], theme.hues[nSlot]))
        }
      }
      const litClash = [...used].some((s) => Math.abs(theme.lits[slot] - theme.lits[s]) < 8)
      const score = minHue + (litClash ? 0 : 12)
      if (score > bestScore) {
        bestScore = score
        bestSlot = slot
      }
    }

    if (bestScore < 0) {
      bestSlot = 0
      bestScore = -1
      for (let slot = 0; slot < paletteLen; slot++) {
        let minHue = 180
        for (const n of neighbors.get(region) ?? []) {
          const nSlot = assignment.get(n)
          if (nSlot != null) {
            minHue = Math.min(minHue, hueDistance(theme.hues[slot], theme.hues[nSlot]))
          }
        }
        if (minHue > bestScore) {
          bestScore = minHue
          bestSlot = slot
        }
      }
    }

    assignment.set(region, bestSlot)
  }

  const colors = new Map<number, { hue: number; sat: number; lit: number }>()
  for (const id of regionIds) {
    const slot = assignment.get(id) ?? id % paletteLen
    colors.set(id, {
      hue: theme.hues[slot],
      sat: theme.sats[slot],
      lit: theme.lits[slot],
    })
  }
  return colors
}
