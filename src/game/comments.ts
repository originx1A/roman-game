export type CommentMood = 'good' | 'bad' | 'hype' | 'neutral'

export type VoiceClipId =
  | 'nice'
  | 'solid'
  | 'that_works'
  | 'good_call'
  | 'clean'
  | 'too_close'
  | 'row_taken'
  | 'region_full'
  | 'nope'
  | 'nudge'
  | 'cleared'
  | 'board_complete'
  | 'out_of_hearts'
  | 'tough_board'
  | 'prize_time'
  | 'new_badge'
  | 'roman_awesome'
  | 'roman_legend'
  | 'roman_highfive'
  | 'roman_win'
  | 'roman_brain'
  | 'roman_boss'
  | 'roman_sparkle'
  | 'roman_proud'
  | 'roman_clutch'
  | 'roman_smooth'
  | 'roman_cheer'
  | 'roman_cook'
  | 'roman_critter'
  | 'roman_stash'
  | 'roman_prize'
  | 'roman_hint'
  | 'roman_nudge'
  | 'roman_close'
  | 'roman_oops'
  | 'roman_bonk'
  | 'roman_nope'
  | 'roman_silly'
  | 'roman_brainfart'
  | 'roman_retry'
  | 'roman_hearts'
  | 'roman_colorblind'
  | 'roman_samecolor'
  | 'roman_rowmate'
  | 'roman_coltaken'
  | 'roman_cuddle'
  | 'roman_highhopes'
  | 'roman_cantwin'
  | 'roman_trying'
  | 'roman_stillbetter'
  | 'roman_skillissue'
  | 'roman_warmup'
  | 'roman_almost'
  | 'roman_sleeping'
  | 'roman_practice'
  | 'roman_myboard'
  | 'roman_sandwich'
  | 'roman_itchy'
  | 'roman_plotwin'
  | 'roman_okayfine'
  | 'roman_cocky'
  | 'roman_sock'
  | 'roman_taco'
  | 'roman_juice'
  | 'roman_dino'
  | 'roman_nugget'
  | 'roman_shoe'
  | 'roman_potato'
  | 'roman_sneeze'
  | 'roman_fridge'
  | 'roman_nap'
  | 'roman_spaghetti'
  | 'roman_raccoon'
  | 'roman_shrug'
  | 'roman_dance'
  | 'roman_forgot'
  | 'roman_toes'
  | 'roman_eyeballs'
  | 'roman_victoryburp'
  | 'roman_highfiveself'
  | 'spark_1'
  | 'spark_2'
  | 'spark_3'
  | 'spark_4'
  | 'spark_unlocked'
  | 'spark_have_1'
  | 'spark_have_2'
  | 'spark_have_3'
  | 'spark_have_4'

export type ConflictKind = 'touch' | 'row' | 'col' | 'region' | 'generic'

export type VoiceMood = 'excited' | 'happy' | 'neutral' | 'soft' | 'disappointed'

export interface Banter {
  text: string
  mood: CommentMood
  voiceMood: VoiceMood
  speak: boolean
  clip?: VoiceClipId
  giggle?: boolean
  silent?: boolean
}

type Line = { text: string; clip: VoiceClipId }

/** Remember recent Roman clips so wins/putdowns don't feel stuck on one line */
const RECENT_KEY = 'roman-recent-clips'
const RECENT_MAX = 16

function loadRecent(): VoiceClipId[] {
  try {
    if (typeof sessionStorage === 'undefined') return []
    const raw = sessionStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as VoiceClipId[]) : []
  } catch {
    return []
  }
}

function saveRecent(ids: VoiceClipId[]) {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(-RECENT_MAX)))
  } catch {
    /* ignore quota / private mode */
  }
}

const recentRoman: VoiceClipId[] = loadRecent()

function randInt(n: number): number {
  if (n <= 1) return 0
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      return buf[0] % n
    }
  } catch {
    /* fall through */
  }
  return Math.floor(Math.random() * n)
}

function pick<T>(arr: T[]): T {
  return arr[randInt(arr.length)]
}

function chance(p: number): boolean {
  return Math.random() < p
}

function rememberClip(clip: VoiceClipId) {
  recentRoman.push(clip)
  while (recentRoman.length > RECENT_MAX) recentRoman.shift()
  saveRecent(recentRoman)
}

/** Prefer unused clips; never repeat the last pick when the pool has alternatives */
function pickFresh(pool: Line[]): Line {
  if (pool.length <= 1) return pool[0]
  const last = recentRoman[recentRoman.length - 1]
  let candidates = pool.filter((l) => !recentRoman.includes(l.clip))
  if (!candidates.length) {
    candidates = pool.filter((l) => l.clip !== last)
  }
  if (!candidates.length) candidates = pool
  const chosen = pick(candidates)
  rememberClip(chosen.clip)
  return chosen
}

/** Straight hype / rivalry cheers */
const ROMAN_HYPE: Line[] = [
  { text: 'Roman says: you are awesome!', clip: 'roman_awesome' },
  { text: 'Roman says: absolute legend!', clip: 'roman_legend' },
  { text: 'Roman says: high five, puzzle champ!', clip: 'roman_highfive' },
  { text: 'Roman wins! Confetti in my hair!', clip: 'roman_win' },
  { text: "Roman's brain: big. Your move: bigger.", clip: 'roman_brain' },
  { text: 'Roman says: I am the puzzle boss.', clip: 'roman_boss' },
  { text: "Roman says: I'm proud of that move!", clip: 'roman_proud' },
  { text: 'Roman says: clutch! That was clean!', clip: 'roman_clutch' },
  { text: 'Roman says: smooth operator!', clip: 'roman_smooth' },
  { text: 'Roman says: yes! Keep that energy!', clip: 'roman_cheer' },
  { text: 'Roman says: you cooked that board!', clip: 'roman_cook' },
  { text: "Roman says: you did great — but I'm still better.", clip: 'roman_stillbetter' },
  { text: 'Roman says: nice try. Still my board though.', clip: 'roman_myboard' },
  { text: 'Roman says: plot twist — you actually did it!', clip: 'roman_plotwin' },
  { text: 'Roman says: okay fine. That one was pretty good.', clip: 'roman_okayfine' },
  { text: "Roman says: don't get cocky. I'm still watching.", clip: 'roman_cocky' },
]

/** Absurd non-sequitur punchlines — the sandwich / itchy energy */
const ROMAN_ABSURD: Line[] = [
  { text: 'Roman says: did anyone see where I left my sandwich?', clip: 'roman_sandwich' },
  { text: 'Roman says: my butt is itchy. Anyway — you won!', clip: 'roman_itchy' },
  { text: 'Roman says: who took my other sock?', clip: 'roman_sock' },
  { text: 'Roman says: cool cool. Now where are the tacos?', clip: 'roman_taco' },
  { text: 'Roman says: victory! Also — juice box, please.', clip: 'roman_juice' },
  { text: 'Roman says: I was thinking about dinosaurs the whole time.', clip: 'roman_dino' },
  { text: 'Roman says: this win smells like chicken nuggets.', clip: 'roman_nugget' },
  { text: 'Roman says: hang on — I lost a shoe under the couch