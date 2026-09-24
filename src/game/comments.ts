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
  { text: 'Roman says: hang on — I lost a shoe under the couch.', clip: 'roman_shoe' },
  { text: 'Roman says: potato. That’s the whole comment.', clip: 'roman_potato' },
  { text: 'Roman says: achoo! …you still won though.', clip: 'roman_sneeze' },
  { text: 'Roman says: I was talking to the fridge. It gets me.', clip: 'roman_fridge' },
  { text: 'Roman says: nap time. You earned it. I earned it more.', clip: 'roman_nap' },
  { text: 'Roman says: there’s spaghetti on the ceiling. Not sorry.', clip: 'roman_spaghetti' },
  { text: 'Roman says: a raccoon stole my strategy. Still won vibes.', clip: 'roman_raccoon' },
  { text: 'Roman says: shrug. Magic. Next board.', clip: 'roman_shrug' },
  { text: 'Roman says: I’m doing a tiny victory dance with my eyebrows.', clip: 'roman_dance' },
  { text: 'Roman says: wait — what were we talking about?', clip: 'roman_forgot' },
  { text: 'Roman says: my toes are freezing. Celebrate harder.', clip: 'roman_toes' },
  { text: 'Roman says: I beat that with my eyeballs closed. Mostly.', clip: 'roman_eyeballs' },
  { text: 'Roman says: *quiet victory burp* Excuse Roman.', clip: 'roman_victoryburp' },
  { text: 'Roman says: high five… to myself. You can watch.', clip: 'roman_highfiveself' },
]

const ROMAN_PRIZE: Line[] = [
  { text: 'Roman says: sparkle mode unlocked!', clip: 'roman_sparkle' },
  { text: 'Roman says: prize time, baby!', clip: 'roman_prize' },
  { text: 'Roman says: I am the puzzle boss.', clip: 'roman_boss' },
]

const ROMAN_HINT: Line[] = [
  { text: 'Roman whispers: try over there.', clip: 'roman_hint' },
  { text: 'Roman says: trust the empty square.', clip: 'roman_nudge' },
]

/** Same-color / region already filled — playful, not mean */
const ROMAN_REGION: Line[] = [
  { text: 'Roman says: are you color blind? That color’s taken!', clip: 'roman_colorblind' },
  { text: 'Roman says: same color club is full!', clip: 'roman_samecolor' },
  { text: 'Roman says: that color already has a buddy!', clip: 'roman_samecolor' },
]

const ROMAN_ROW: Line[] = [
  { text: 'Roman says: that row already has a roommate!', clip: 'roman_rowmate' },
  { text: 'Roman says: nope-a-dope. Row’s taken.', clip: 'roman_nope' },
]

const ROMAN_COL: Line[] = [
  { text: 'Roman says: that column’s booked!', clip: 'roman_coltaken' },
  { text: 'Roman says: plot twist — try again!', clip: 'roman_retry' },
]

const ROMAN_TOUCH: Line[] = [
  { text: 'Personal space! Even buddies need it.', clip: 'roman_close' },
  { text: 'Roman says: no cuddling — even corners count!', clip: 'roman_cuddle' },
  { text: 'Roman says: silly goose move. Shake it off!', clip: 'roman_silly' },
]

/** Playful rivalry digs — sibling trash talk, never mean */
const ROMAN_RIVAL: Line[] = [
  { text: 'Roman says: I had high hopes for you. Bummer.', clip: 'roman_highhopes' },
  { text: "Roman says: well, you can't win them all.", clip: 'roman_cantwin' },
  { text: 'Roman says: are you even trying?', clip: 'roman_trying' },
  { text: "Roman says: you did great — but I'm still better.", clip: 'roman_stillbetter' },
  { text: 'Roman says: skill issue. Shake it off!', clip: 'roman_skillissue' },
  { text: 'Roman says: that was your warm-up, right?', clip: 'roman_warmup' },
  { text: 'Roman says: so close… and yet so Roman.', clip: 'roman_almost' },
  { text: 'Roman says: did you fall asleep mid-tap?', clip: 'roman_sleeping' },
  { text: 'Roman says: practice more — then challenge me.', clip: 'roman_practice' },
  { text: 'Roman says: nice try. Still my board though.', clip: 'roman_myboard' },
]

const ROMAN_GENERIC_BAD: Line[] = [
  { text: 'Roman says: bonk. Try a different square.', clip: 'roman_bonk' },
  { text: 'Roman says: tiny brain fart. You’re fine.', clip: 'roman_brainfart' },
  ...ROMAN_RIVAL,
]

const ROMAN_LOSE: Line[] = [
  { text: 'Whoops! That was a spicy miss.', clip: 'roman_oops' },
  { text: 'Roman says: hearts down, spirit up. Rematch!', clip: 'roman_hearts' },
  { text: 'Roman says: plot twist — try again!', clip: 'roman_retry' },
  ...ROMAN_RIVAL,
]

const COACH_BAD: Record<ConflictKind, Line> = {
  touch: { text: 'Too close — give them space.', clip: 'too_close' },
  row: { text: 'That row is already taken.', clip: 'row_taken' },
  col: { text: 'Nope — that column is taken.', clip: 'nope' },
  region: { text: 'That region already has one.', clip: 'region_full' },
  generic: { text: 'Nope. Try another spot.', clip: 'nope' },
}

const COACH_UPLIFT: Line[] = [
  { text: 'Nice!', clip: 'nice' },
  { text: 'Good call!', clip: 'good_call' },
  { text: 'Clean!', clip: 'clean' },
]

function romanForConflict(kind: ConflictKind): Line {
  // Sometimes a general rivalry dig instead of the action-specific line
  if (chance(0.28)) return pickFresh(ROMAN_RIVAL)
  switch (kind) {
    case 'region':
      return pickFresh(ROMAN_REGION)
    case 'row':
      return pickFresh([...ROMAN_ROW, ...ROMAN_RIVAL.slice(0, 3)])
    case 'col':
      return pickFresh([...ROMAN_COL, ...ROMAN_RIVAL.slice(0, 3)])
    case 'touch':
      return pickFresh([...ROMAN_TOUCH, ...ROMAN_RIVAL.slice(0, 2)])
    default:
      return pickFresh(ROMAN_GENERIC_BAD)
  }
}

/**
 * Action-matched banter. Roman does cheers AND putdowns.
 * Putdowns are occasional (~55–70%) and matched to the mistake type.
 * X marks: silence. Good place: buddy giggle only.
 */
export function banterFor(
  event:
    | 'place-good'
    | 'place-bad'
    | 'mark'
    | 'hint'
    | 'win'
    | 'lose'
    | 'prize'
    | 'achievement'
    | 'critter'
    | 'critter-stash',
  conflict?: ConflictKind,
): Banter {
  switch (event) {
    case 'mark':
      return { text: '', mood: 'neutral', voiceMood: 'neutral', speak: false, silent: true }

    case 'place-good':
      // Rare soft coach uplift toast text only — voice is giggle from Board
      if (chance(0.1)) {
        const line = pick(COACH_UPLIFT)
        return {
          text: line.text,
          mood: 'good',
          voiceMood: 'happy',
          speak: false,
          giggle: true,
          silent: false,
        }
      }
      return {
        text: '',
        mood: 'good',
        voiceMood: 'happy',
        speak: false,
        giggle: true,
        silent: true,
      }

    case 'place-bad': {
      const kind = conflict ?? 'generic'
      // Putdowns: Roman humour most of the time
      if (chance(0.78)) {
        const line = romanForConflict(kind)
        return {
          text: line.text,
          mood: 'bad',
          voiceMood: 'disappointed',
          speak: true,
          clip: line.clip,
        }
      }
      // Sometimes silent toast-only so voices don't spam every miss
      if (chance(0.35)) {
        const coach = COACH_BAD[kind]
        return {
          text: coach.text,
          mood: 'bad',
          voiceMood: 'soft',
          speak: false,
        }
      }
      const coach = COACH_BAD[kind]
      return {
        text: coach.text,
        mood: 'bad',
        voiceMood: 'disappointed',
        speak: true,
        clip: coach.clip,
      }
    }

    case 'hint': {
      if (chance(0.55)) {
        const line = pickFresh(ROMAN_HINT)
        return {
          text: line.text,
          mood: 'neutral',
          voiceMood: 'soft',
          speak: true,
          clip: line.clip,
        }
      }
      return {
        text: 'Here’s a nudge.',
        mood: 'neutral',
        voiceMood: 'happy',
        speak: true,
        clip: 'nudge',
      }
    }

    case 'win': {
      // Wins lean absurd (sandwich / itchy energy) so Roman stays unpredictable
      const line = chance(0.62) ? pickFresh(ROMAN_ABSURD) : pickFresh(ROMAN_HYPE)
      return {
        text: line.text,
        mood: 'hype',
        voiceMood: 'excited',
        speak: true,
        clip: line.clip,
      }
    }

    case 'lose': {
      const line = chance(0.75)
        ? pickFresh(ROMAN_LOSE)
        : { text: 'Out of hearts. Rematch?', clip: 'out_of_hearts' as VoiceClipId }
      return {
        text: line.text,
        mood: 'bad',
        voiceMood: 'disappointed',
        speak: true,
        clip: line.clip,
      }
    }

    case 'prize': {
      const line = pickFresh(ROMAN_PRIZE)
      return {
        text: line.text,
        mood: 'hype',
        voiceMood: 'excited',
        speak: true,
        clip: line.clip,
      }
    }

    case 'achievement': {
      const line = pickFresh([
        { text: 'Roman says: I am the puzzle boss.', clip: 'roman_boss' as VoiceClipId },
        { text: 'Roman says: absolute legend!', clip: 'roman_legend' as VoiceClipId },
        { text: 'Roman says: you are awesome!', clip: 'roman_awesome' as VoiceClipId },
        { text: 'Roman says: clutch! That was clean!', clip: 'roman_clutch' as VoiceClipId },
        { text: 'Roman says: yes! Keep that energy!', clip: 'roman_cheer' as VoiceClipId },
      ])
      return {
        text: line.text,
        mood: 'hype',
        voiceMood: 'excited',
        speak: true,
        clip: line.clip,
      }
    }

    case 'critter': {
      // Progress is handled by sparkProgressBanter(have) from App — fallback cheer
      return {
        text: 'Nice catch!',
        mood: 'hype',
        voiceMood: 'happy',
        speak: true,
        clip: 'nice',
      }
    }

    case 'critter-stash': {
      // Female coach unlock line — spin is earned, not auto-forced every tap
      return {
        text: 'Sparkle mode unlocked!',
        mood: 'hype',
        voiceMood: 'excited',
        speak: true,
        clip: 'spark_unlocked',
      }
    }
  }
}

/** Coach progress after catching a spark (1..goal-1). */
export function sparkProgressBanter(have: number, goal = 5): Banter {
  const left = Math.max(0, goal - have)
  const clips: Record<number, VoiceClipId> = {
    1: 'spark_1',
    2: 'spark_2',
    3: 'spark_3',
    4: 'spark_4',
  }
  const haveClips: Record<number, VoiceClipId> = {
    1: 'spark_have_1',
    2: 'spark_have_2',
    3: 'spark_have_3',
    4: 'spark_have_4',
  }
  // Prefer "N more left" wording; sometimes "you've got N"
  const useHave = have > 0 && chance(0.4) && haveClips[have]
  const clip = useHave ? haveClips[have] : clips[have] ?? 'nice'
  const text = useHave
    ? have === 1
      ? "You've got one sparkle toward the bonus."
      : `You've got ${have} sparkles toward the bonus.`
    : have === 1
      ? 'One sparkle so far. Four more for the bonus!'
      : left === 1
        ? 'Four sparkles. Just one more for the bonus!'
        : `${have} sparkles. ${left} more for the bonus!`

  return {
    text,
    mood: 'hype',
    voiceMood: 'happy',
    speak: true,
    clip,
  }
}
