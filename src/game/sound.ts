/** SFX + non-overlapping voice (coach / Roman / buddy giggle) */

import {
  moodPlayback,
  roleForClip,
  type VoiceLineId,
  type VoiceMood,
  type VoiceRole,
} from './voiceLines'

let ctx: AudioContext | null = null
let muted = false
let voiceEnabled = true

const voicePool = new Map<string, HTMLAudioElement>()
let activeVoice: HTMLAudioElement | null = null
let activeRole: VoiceRole | null = null
let voiceBusyUntil = 0
let voiceGeneration = 0

const FALLBACK_TEXT: Partial<Record<VoiceLineId, string>> = {
  nice: 'Nice.',
  solid: 'Solid.',
  good_call: 'Good call.',
  that_works: 'That works.',
  clean: 'Clean.',
  too_close: 'Too close. Buddies need space.',
  row_taken: 'That row is already taken.',
  region_full: 'That region already has one.',
  nope: 'Nope. Try another spot.',
  nudge: "Here's a nudge.",
  cleared: 'You cleared it!',
  board_complete: 'Board complete. Nice work.',
  out_of_hearts: 'Out of hearts. Rematch?',
  tough_board: 'Tough board. Try again.',
  prize_time: 'Prize time!',
  new_badge: 'New badge unlocked.',
  roman_awesome: 'Roman says: you are awesome!',
  roman_legend: 'Roman says: absolute legend!',
  roman_highfive: 'Roman says: high five, puzzle champ!',
  roman_win: 'Roman wins! Confetti in my hair!',
  roman_brain: "Roman's brain: big. Your move: bigger.",
  roman_boss: 'Roman says: I am the puzzle boss.',
  roman_sparkle: 'Roman says: sparkle mode unlocked!',
  roman_proud: "Roman says: I'm proud of that move!",
  roman_clutch: 'Roman says: clutch! That was clean!',
  roman_smooth: 'Roman says: smooth operator!',
  roman_cheer: 'Roman says: yes! Keep that energy!',
  roman_cook: 'Roman says: you cooked that board!',
  roman_critter: 'Roman says: you caught the spark critter!',
  roman_stash: 'Roman says: critter stash complete! Big bonus!',
  roman_prize: 'Roman says: prize time, baby!',
  roman_hint: 'Roman whispers: try over there.',
  roman_nudge: 'Roman says: trust the empty square.',
  roman_close: 'Personal space! Even buddies need it.',
  roman_oops: 'Whoops! That was a spicy miss.',
  roman_bonk: 'Roman says: bonk. Try a different square.',
  roman_nope: 'Roman says: nope-a-dope. Not that one.',
  roman_silly: 'Roman says: silly goose move. Shake it off!',
  roman_brainfart: "Roman says: tiny brain fart. You're fine.",
  roman_retry: 'Roman says: plot twist — try again!',
  roman_hearts: 'Roman says: hearts down, spirit up. Rematch!',
  roman_colorblind: "Roman says: are you color blind? That color's taken!",
  roman_samecolor: 'Roman says: same color club is full!',
  roman_rowmate: 'Roman says: that row already has a roommate!',
  roman_coltaken: "Roman says: that column's booked!",
  roman_cuddle: 'Roman says: no cuddling — even corners count!',
  roman_highhopes: 'Roman says: I had high hopes for you. Bummer.',
  roman_cantwin: "Roman says: well, you can't win them all.",
  roman_trying: 'Roman says: are you even trying?',
  roman_stillbetter: "Roman says: you did great — but I'm still better.",
  roman_skillissue: 'Roman says: skill issue. Shake it off!',
  roman_warmup: 'Roman says: that was your warm-up, right?',
  roman_almost: 'Roman says: so close… and yet so Roman.',
  roman_sleeping: 'Roman says: did you fall asleep mid-tap?',
  roman_practice: 'Roman says: practice more — then challenge me.',
  roman_myboard: 'Roman says: nice try. Still my board though.',
  roman_sandwich: 'Roman says: did anyone see where I left my sandwich?',
  roman_itchy: 'Roman says: my butt is itchy. Anyway — you won!',
  roman_plotwin: 'Roman says: plot twist — you actually did it!',
  roman_okayfine: 'Roman says: okay fine. That one was pretty good.',
  roman_cocky: "Roman says: don't get cocky. I'm still watching.",
  roman_sock: 'Roman says: who took my other sock?',
  roman_taco: 'Roman says: cool cool. Now where are the tacos?',
  roman_juice: 'Roman says: victory! Also — juice box, please.',
  roman_dino: 'Roman says: I was thinking about dinosaurs the whole time.',
  roman_nugget: 'Roman says: this win smells like chicken nuggets.',
  roman_shoe: 'Roman says: hang on — I lost a shoe under the couch.',
  roman_potato: 'Roman says: potato. That’s the whole comment.',
  roman_sneeze: 'Roman says: achoo! …you still won though.',
  roman_fridge: 'Roman says: I was talking to the fridge. It gets me.',
  roman_nap: 'Roman says: nap time. You earned it. I earned it more.',
  roman_spaghetti: 'Roman says: there’s spaghetti on the ceiling. Not sorry.',
  roman_raccoon: 'Roman says: a raccoon stole my strategy. Still won vibes.',
  roman_shrug: 'Roman says: shrug. Magic. Next board.',
  roman_dance: 'Roman says: I’m doing a tiny victory dance with my eyebrows.',
  roman_forgot: 'Roman says: wait — what were we talking about?',
  roman_toes: 'Roman says: my toes are freezing. Celebrate harder.',
  roman_eyeballs: 'Roman says: I beat that with my eyeballs closed. Mostly.',
  roman_victoryburp: 'Roman says: quiet victory burp. Excuse Roman.',
  roman_highfiveself: 'Roman says: high five… to myself. You can watch.',
  roman_broccoli: 'Roman says: broccoli power. You cleared that board!',
  roman_pickle: 'Roman says: pickle me proud. That was crisp!',
  roman_banana: 'Roman says: banana split victory. You did it!',
  roman_cheese: 'Roman says: extra cheese on that win. Delicious!',
  roman_pants: 'Roman says: I put on my fancy pants for this win!',
  roman_booger: 'Roman says: booger face, champion heart!',
  roman_lizard: 'Roman says: a tiny lizard just clapped for you!',
  roman_ghost: 'Roman says: boo! Just kidding. You won!',
  roman_unicorn: 'Roman says: unicorn sparkles. That move was magic!',
  roman_worm: 'Roman says: even the worm is doing a happy wiggle!',
  roman_trumpet: 'Roman says: toot toot! Victory trumpet!',
  roman_bubblegum: 'Roman says: bubblegum pop. Sticky sweet win!',
  roman_helicopter: 'Roman says: helicopter hair. We are taking off!',
  roman_underpants: 'Roman says: superhero underpants. Cape not included!',
  roman_moonwalk: 'Roman says: moonwalk across the board. Smooth!',
  roman_idle_hello: 'Roman says: hello? The board is getting lonely.',
  roman_idle_century: 'Roman says: any century now.',
  roman_idle_sandwich: 'Roman says: I could eat a sandwich while I wait.',
  roman_idle_blink: 'Roman says: blink twice if you are still there.',
  roman_idle_loading: 'Roman says: still loading your next move.',
  roman_idle_admire: 'Roman says: I am admiring this empty square.',
  roman_idle_sphinx: 'Roman says: the sphinx is less patient than me.',
  roman_idle_snore: 'Roman says: zzz. Wake me when you tap.',
  roman_wrong_bold: 'Roman says: bold move. Wrong square.',
  roman_wrong_complaint: 'Roman says: I filed a tiny complaint about that tap.',
  roman_wrong_oof: 'Roman says: oof. That one bounced off.',
  roman_wrong_politely: 'Roman says: politely, that spot is a no.',
  roman_wrong_grandma: 'Roman says: even my grandma would skip that square.',
  roman_wrong_wifi: 'Roman says: that move has no signal.',
  roman_wrong_drama: 'Roman says: the drama. The miss. The heart.',
  roman_wrong_trophy: 'Roman says: no trophy for that square.',
  cosmic: 'Cosmic void. Starlit mystery.',
  ruins: 'Ancient ruins. Forgotten stone.',
  neon: 'Neon night. Electric streets.',
  ocean: 'Ocean deep. Abyss glow.',
  ember: 'Ember peak. Molten heat.',
  crystal: 'Crystal cave. Prism hush.',
  spark_unlocked: 'Sparkle mode unlocked!',
  spark_1: 'One sparkle so far. Four more for the bonus!',
  spark_2: 'Two sparkles. Three more for the bonus!',
  spark_3: 'Three sparkles. Two more for the bonus!',
  spark_4: 'Four sparkles. Just one more for the bonus!',
  spark_have_1: "You've got one sparkle toward the bonus.",
  spark_have_2: "You've got two sparkles toward the bonus.",
  spark_have_3: "You've got three sparkles toward the bonus.",
  spark_have_4: "You've got four sparkles. So close!",
}

export function voiceLineText(id: string): string | undefined {
  return FALLBACK_TEXT[id as VoiceLineId]
}

/** Role priority — higher wins / can interrupt lower; same or lower is skipped while busy */
const ROLE_PRIORITY: Record<VoiceRole, number> = {
  coach: 3,
  roman: 2,
  buddy: 1,
}

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Resume audio graph before every beep — mobile browsers mute until gesture + resume */
function ensureAudio() {
  try {
    const c = ac()
    if (c.state === 'suspended') void c.resume()
  } catch {
    /* ignore */
  }
}

function voiceHref(id: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}voices/${id}.mp3`
}

function stopVoice() {
  voiceGeneration += 1
  if (activeVoice) {
    try {
      activeVoice.onended = null
      activeVoice.onerror = null
      activeVoice.pause()
      activeVoice.currentTime = 0
    } catch {
      /* ignore */
    }
    activeVoice = null
  }
  activeRole = null
  if (typeof speechSynthesis !== 'undefined') {
    try {
      speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }
}

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  return (
    voices.find((v) => /Samantha|Karen|Moira|Victoria|Jenny|Zira|Google US English/i.test(v.name)) ||
    voices.find((v) => /female|woman/i.test(`${v.name} ${v.voiceURI}`)) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  )
}

function pickRomanVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return null
  return (
    voices.find((v) => /Brian|Aaron|Fred|Daniel|Alex|Tom|David|Male/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en') && /male/i.test(`${v.name} ${v.voiceURI}`)) ||
    null
  )
}

function looksLikeCodeOrMarkup(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.length > 180) return true
  if (/<speak|<\/|xmlns|mstts|express-as|function\s*\(|=>\s*\{|const\s+\w+\s*=/i.test(t)) return true
  if (/[{};]|<\/?[a-z]/i.test(t)) return true
  return false
}

function speakSynth(
  text: string,
  opts: { pitch?: number; rate?: number; role?: VoiceRole } = {},
) {
  if (muted || !voiceEnabled || !text) return
  // Never read SSML, XML, or source code aloud
  if (looksLikeCodeOrMarkup(text)) return
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    return
  }
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const role = opts.role ?? 'coach'
    const voice =
      role === 'roman' ? pickRomanVoice() || pickFemaleVoice() :
      role === 'buddy' ? pickFemaleVoice() :
      pickFemaleVoice()
    if (voice) u.voice = voice
    u.pitch = opts.pitch ?? (role === 'roman' ? 0.72 : role === 'buddy' ? 1.4 : 1.08)
    u.rate = opts.rate ?? (role === 'roman' ? 0.9 : 1.02)
    u.volume = 0.9
    const gen = voiceGeneration
    u.onend = () => {
      if (gen === voiceGeneration) {
        activeRole = null
        voiceBusyUntil = performance.now()
      }
    }
    speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (m) stopVoice()
}

export function setVoiceEnabled(on: boolean) {
  voiceEnabled = on
  if (!on) stopVoice()
}

let audioUnlocked = false

export function unlockAudio() {
  ensureAudio()
  try {
    const c = ac()
    if (c.state === 'suspended') void c.resume()
    const osc = c.createOscillator()
    const g = c.createGain()
    g.gain.value = 0.00001
    osc.connect(g)
    g.connect(c.destination)
    osc.start()
    osc.stop(c.currentTime + 0.01)
  } catch {
    /* ignore */
  }
  if (audioUnlocked || typeof Audio === 'undefined') return
  audioUnlocked = true
  try {
    const silent = new Audio(
      'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAAF4AAAAAgAAAAATEFN//uQxAAAAAAAAAAAAAAAAAAAAAAADwAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==',
    )
    silent.volume = 0.01
    void silent
      .play()
      .then(() => {
        silent.pause()
      })
      .catch(() => {
        audioUnlocked = false
      })
  } catch {
    audioUnlocked = false
  }
}

function noiseBurst(duration: number, gain = 0.08, when = 0) {
  if (muted) return
  ensureAudio()
  const c = ac()
  const t0 = c.currentTime + when
  const bufferSize = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const g = c.createGain()
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1400
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(c.destination)
  src.start(t0)
  src.stop(t0 + duration + 0.02)
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
  when = 0,
  slideTo?: number,
) {
  if (muted) return
  ensureAudio()
  const c = ac()
  const t0 = c.currentTime + when
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration)
  }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

export function sfxTap() {
  tone(720, 0.05, 'triangle', 0.09)
  noiseBurst(0.035, 0.04)
}

export function sfxMark() {
  // Crisp “X” scratch — two crossing ticks
  tone(380, 0.07, 'square', 0.1, 0, 220)
  tone(520, 0.06, 'square', 0.08, 0.04, 300)
  noiseBurst(0.06, 0.055, 0.01)
}

export function sfxPlace() {
  tone(260, 0.1, 'sine', 0.11)
  tone(520, 0.14, 'triangle', 0.09, 0.03)
  tone(1040, 0.09, 'sine', 0.05, 0.07)
}

export const SFX_IDS = {
  giggle: 'sfxGiggle',
  heartLose: 'heartLose',
} as const

function markSfx(id: string) {
  try {
    performance.mark?.(id)
  } catch {
    /* ignore */
  }
}

/** Synth backup giggle if mp3 missing */
function synthGiggle() {
  const peeps = [1100, 1320, 1480, 1240, 1600, 1400]
  peeps.forEach((f, i) => {
    tone(f, 0.05, i % 2 ? 'triangle' : 'sine', 0.055, i * 0.04)
  })
  ;[0.04, 0.12, 0.2].forEach((when, i) => noiseBurst(0.04, 0.015 + i * 0.004, when))
}

/**
 * Buddy kid-giggle voice. Skipped entirely if coach/roman is speaking.
 * Never starts coach/roman — giggles yield to spoken lines.
 */
export function sfxGiggle() {
  markSfx(SFX_IDS.giggle)
  if (muted || !voiceEnabled) {
    synthGiggle()
    return
  }
  const now = performance.now()
  if (now < voiceBusyUntil && activeRole && activeRole !== 'buddy') {
    // Soft peeps only under spoken voice — no second voice layer
    synthGiggle()
    return
  }
  const clips = ['buddy_giggle_1', 'buddy_giggle_2', 'buddy_giggle_3'] as const
  const id = clips[Math.floor(Math.random() * clips.length)]
  playVoice(id, undefined, { mood: 'happy', forceRole: 'buddy' })
}

export function sfxHeartLose() {
  markSfx(SFX_IDS.heartLose)
  tone(420, 0.12, 'sine', 0.1, 0, 280)
  tone(320, 0.16, 'triangle', 0.08, 0.06, 180)
  noiseBurst(0.12, 0.045, 0.04)
}

export function sfxStone() {
  sfxPlace()
}

export function sfxError() {
  tone(180, 0.14, 'sawtooth', 0.09, 0, 90)
  tone(140, 0.18, 'square', 0.07, 0.05, 70)
  noiseBurst(0.14, 0.06, 0.02)
}

export function sfxHint() {
  tone(523, 0.12, 'sine', 0.1)
  tone(659, 0.14, 'sine', 0.09, 0.07)
  tone(784, 0.16, 'triangle', 0.07, 0.14)
}

export function sfxUndo() {
  tone(360, 0.09, 'triangle', 0.08, 0, 280)
}

export function sfxWin() {
  ;[523, 659, 784, 988, 1175].forEach((f, i) =>
    tone(f, 0.3, i % 2 ? 'triangle' : 'sine', 0.1, i * 0.09),
  )
  noiseBurst(0.22, 0.05, 0.35)
}

export function sfxLose() {
  tone(320, 0.22, 'triangle', 0.1, 0, 160)
  tone(240, 0.28, 'sine', 0.08, 0.12, 110)
  tone(160, 0.38, 'sawtooth', 0.055, 0.22, 80)
}

export function sfxWhoosh() {
  noiseBurst(0.2, 0.07)
  tone(480, 0.14, 'sine', 0.05, 0.02, 220)
}

export function sfxCoin() {
  tone(988, 0.09, 'square', 0.08)
  tone(1319, 0.14, 'sine', 0.1, 0.05)
}

/** Spark critter catch — bright sparkle cascade (distinct from coin) */
export function sfxSpark() {
  ;[880, 1175, 1480, 1760, 2093].forEach((f, i) =>
    tone(f, 0.11, i % 2 ? 'triangle' : 'sine', 0.1 - i * 0.01, i * 0.045),
  )
  noiseBurst(0.12, 0.05, 0.02)
  tone(2349, 0.18, 'sine', 0.07, 0.22)
}

export function sfxSpin() {
  for (let i = 0; i < 12; i++) {
    tone(320 + i * 40, 0.06, 'triangle', 0.055, i * 0.07)
  }
}

export function sfxPrize() {
  ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, i * 0.08))
}

export function sfxAchievement() {
  tone(660, 0.12, 'sine', 0.1)
  tone(880, 0.14, 'triangle', 0.09, 0.08)
  tone(1320, 0.2, 'sine', 0.08, 0.16)
}

export interface PlayVoiceOpts {
  mood?: VoiceMood
  forceRole?: VoiceRole
  /** Fallback spoken text if mp3 fails */
  text?: string
  /** Same-pool clips to try when this file is missing or not audio. */
  alts?: readonly string[]
}

const clipUrlCache = new Map<string, string | null>()

function isMp3Bytes(bytes: Uint8Array): boolean {
  if (bytes.length < 64) return false
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 48)).trimStart().toLowerCase()
  if (head.startsWith('<') || head.includes('<!doctype') || head.includes('<html')) return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
}

/** Fetch the clip and reject the SPA html fallback (200 text/html). */
async function clipObjectUrl(id: string): Promise<string | null> {
  if (clipUrlCache.has(id)) return clipUrlCache.get(id) ?? null
  try {
    const res = await fetch(voiceHref(id))
    if (!res.ok) {
      clipUrlCache.set(id, null)
      return null
    }
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    const type = (res.headers.get('content-type') || '').toLowerCase()
    if (type.includes('text/html') || !isMp3Bytes(bytes)) {
      clipUrlCache.set(id, null)
      return null
    }
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
    clipUrlCache.set(id, url)
    return url
  } catch {
    return null
  }
}

/**
 * Play one voice clip. Enforces single-speaker lock so lines never overlap.
 * Higher-priority roles can interrupt lower ones; otherwise the request is dropped.
 */
export function playVoice(id: string, fallbackText?: string, opts: PlayVoiceOpts = {}) {
  if (muted || !voiceEnabled || !id) return
  const role = opts.forceRole ?? roleForClip(id)
  const now = performance.now()
  const busy = now < voiceBusyUntil && activeRole != null
  if (busy) {
    const incoming = ROLE_PRIORITY[role]
    const current = ROLE_PRIORITY[activeRole!]
    if (incoming <= current) return
  }

  stopVoice()
  const gen = voiceGeneration
  activeRole = role
  const mood = opts.mood ?? (role === 'roman' ? 'excited' : role === 'buddy' ? 'happy' : 'neutral')
  const { rate, volume } = moodPlayback(mood)
  // Buddy giggles are short
  const holdMs = role === 'buddy' ? 900 : role === 'roman' ? 2800 : 2400
  voiceBusyUntil = now + holdMs

  const text =
    opts.text ??
    fallbackText ??
    (FALLBACK_TEXT[id as VoiceLineId] as string | undefined)

  if (typeof Audio === 'undefined') {
    speakSynth(text ?? '', {
      role,
      pitch: role === 'buddy' ? 1.4 : role === 'roman' ? 1.0 : mood === 'excited' ? 1.1 : mood === 'disappointed' ? 0.95 : 1.05,
      rate,
    })
    return
  }

  const alts = (opts.alts ?? []).filter((alt) => alt && alt !== id).slice(0, 4)
  void playClipQueue([id, ...alts], gen, role, text, rate, volume)
}

function releaseVoice(gen: number) {
  if (gen !== voiceGeneration) return
  activeVoice = null
  activeRole = null
  voiceBusyUntil = performance.now()
}

async function playClipQueue(
  queue: string[],
  gen: number,
  role: VoiceRole,
  text: string | undefined,
  rate: number,
  volume: number,
) {
  for (const clipId of queue) {
    if (gen !== voiceGeneration) return
    const url = await clipObjectUrl(clipId)
    if (!url) continue
    const audio = new Audio(url)
    audio.preload = 'auto'
    const playRate =
      role === 'roman'
        ? Math.min(0.94, Math.max(0.82, rate * 0.88))
        : Math.min(1.2, Math.max(0.85, rate))
    audio.playbackRate = playRate
    audio.volume = role === 'roman' ? Math.min(1, volume * 1.05) : volume
    activeVoice = audio
    voicePool.set(clipId, audio)

    const started = await new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        resolve(ok)
      }
      audio.onerror = () => finish(false)
      void audio.play().then(() => {
        if (settled) return
        if (audio.error || audio.duration === 0) finish(false)
        else finish(true)
      }).catch(() => finish(false))
    })

    if (gen !== voiceGeneration) return
    if (started) {
      audio.onended = () => {
        if (gen !== voiceGeneration) return
        if (activeVoice === audio) releaseVoice(gen)
      }
      return
    }
    audio.onended = null
    audio.onerror = null
    try {
      audio.pause()
    } catch {
      /* ignore */
    }
    if (activeVoice === audio) activeVoice = null
  }

  if (gen !== voiceGeneration) return
  if (text) {
    speakSynth(text, {
      role,
      pitch: role === 'buddy' ? 1.4 : role === 'roman' ? 1.0 : 1.08,
      rate,
    })
    return
  }
  if (role === 'buddy') synthGiggle()
  releaseVoice(gen)
}

/** Coach / Roman line with emotional tone — never overlaps */
export function playBanterClip(
  id: string,
  mood: VoiceMood,
  text?: string,
  alts?: readonly string[],
) {
  playVoice(id, text, { mood, alts })
}

export function warmVoices() {
  if (typeof Audio === 'undefined') return
  const ids = [
    'nice',
    'cleared',
    'out_of_hearts',
    'too_close',
    'roman_awesome',
    'roman_win',
    'roman_clutch',
    'roman_bonk',
    'buddy_giggle_1',
  ]
  for (const id of ids) {
    if (voicePool.has(id)) continue
    try {
      const audio = new Audio(voiceHref(id))
      audio.preload = 'auto'
      voicePool.set(id, audio)
    } catch {
      /* ignore */
    }
  }
}
