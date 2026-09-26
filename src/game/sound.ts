/**
 * SFX + one shared voice channel (Roman + coach).
 * Every voice line goes through a single HTMLAudioElement, so two lines can never sound at once.
 * Roman is always the deeper Brian clips; the old-timer heckler is William (+rasp); the coach is Jenny. No speech-synthesis fallback:
 * if a clip can't play, the line stays silent.
 */

import {
  WARM_COACH_CLIPS,
  isPlayableVoiceClip,
  moodPlayback,
  roleForClip,
  type VoiceLineId,
  type VoiceMood,
} from './voiceLines'

let ctx: AudioContext | null = null
let muted = false
let voiceEnabled = true

/** The one and only voice player. Reused for every line (and unlocked on the first tap for iOS). */
let voiceEl: HTMLAudioElement | null = null
/** Line currently requested/playing on the channel (null = channel free) */
let currentLine: { priority: number; gen: number } | null = null
let voiceGeneration = 0
let voiceSafetyTimer: number | null = null
let voiceUnlocked = false
/** One waiting line (e.g. a badge right after a win) that plays when the channel frees up */
let waitingLine: { id: string; opts: PlayVoiceOpts; until: number } | null = null

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
  roman_lose_nap: 'Roman says: out of hearts. Even legends need a nap.',
  roman_lose_fought: 'Roman says: that board fought back. Rematch?',
  roman_lose_snacks: 'Roman says: hearts empty, snack bowl full. Try again!',
  roman_lose_round: 'Roman says: the board wins this round. Not the war.',
  roman_hint_psst: 'Roman says: psst. Look over there.',
  roman_hint_secret: "Roman says: I didn't tell you this, but try that square.",
  roman_hint_clue: 'Roman says: tiny clue. Big brain.',
  roman_badge_shiny: 'Roman says: new badge! So shiny!',
  roman_badge_fridge: 'Roman says: badge unlocked. Put it on the fridge!',
  roman_badge_wear: 'Roman says: ooh, a badge. Can I wear it?',
  roman_badge_impressed: 'Roman says: badge get! Roman is impressed.',
  roman_spin_spoken: 'Roman says: the wheel has spoken!',
  roman_spin_ooh: 'Roman says: ooh! What did you get?',
  roman_spin_lucky: 'Roman says: lucky spin! Roman approves.',
  roman_stash_party: 'Roman says: five sparks! Sparkle party!',
  roman_stash_jazz: 'Roman says: critter stash! Roman is doing jazz hands.',
  old_wrong_stick: 'Old-timer: Back in my day we solved these with a stick. And we were faster.',
  old_wrong_pigeon: "Old-timer: Even a pigeon would've skipped that square. A pigeon!",
  old_wrong_love: 'Old-timer: Nope. And I say that with all the love I have left.',
  old_wrong_choice: "Old-timer: That's a choice. Not a good one, but a choice.",
  old_wrong_money: 'Old-timer: You tapped that like it owed you money.',
  old_wrong_tea: "Old-timer: Wrong. I'd explain why, but my tea's getting cold.",
  old_wrong_chaos: 'Old-timer: Oh sure, put it there. Why not. Chaos is free.',
  old_wrong_knees: "Old-timer: My knees make better decisions than that. And they're sixty years old.",
  old_wrong_personal: 'Old-timer: Did the board do something to you? That felt personal.',
  old_wrong_close: 'Old-timer: Close. Well, no. Not close at all, actually.',
  old_wrong_again: 'Old-timer: Ha! Classic. Do it again, I missed it.',
  old_wrong_refund: 'Old-timer: That buddy wants a refund.',
  old_wrong_nickel: "Old-timer: In my day a wrong move cost you a nickel. You'd be broke by now.",
  old_wrong_teacher: 'Old-timer: Somewhere, a puzzle teacher just felt a chill.',
  old_wrong_loudly: "Old-timer: I'm not saying it's wrong. The board is saying it's wrong. Loudly.",
  old_idle_twenty: "Old-timer: Take your time. I've got maybe twenty years left.",
  old_idle_crossword: "Old-timer: I started a crossword while I wait. It's going better.",
  old_idle_kettle: 'Old-timer: Should I put the kettle on? Feels like a two-kettle puzzle.',
  old_idle_nap: "Old-timer: Wake me up when you've got a move. I'll be snoozing.",
  old_idle_glacier: "Old-timer: I've seen glaciers with more hustle.",
  old_idle_younger: "Old-timer: Any day now. I'm not getting any younger.",
  old_idle_gossip: 'Old-timer: Still thinking? The squares are starting to gossip.',
  old_hint_stare: 'Old-timer: A hint? In my day we just stared at it until it gave up.',
  old_hint_tell: "Old-timer: Go on, take the hint. I won't tell anyone. I'll tell everyone.",
  old_hint_wheels: 'Old-timer: Ah, the training wheels. Classic.',
  old_hint_push: 'Old-timer: A hint, huh. Fine. Every legend needs a little push.',
  old_hint_smart: 'Old-timer: Asking for help already? Smart. Sad, but smart.',
  old_undo_hokey: "Old-timer: Undo, redo, undo. You're doing the hokey pokey.",
  old_undo_dizzy: "Old-timer: Make up your mind! The board's getting dizzy.",
  old_undo_rocking: 'Old-timer: Back and forth, back and forth. Are you solving, or rocking in a chair?',
  old_undo_vacation: "Old-timer: That undo button's gonna need a vacation.",
  old_lose_tape: "Old-timer: Out of hearts. I'd lend you one, but mine runs on duct tape.",
  old_lose_goldfish: 'Old-timer: Game over. Even my goldfish saw that coming.',
  old_lose_sideways: 'Old-timer: Well, that went sideways. Dust yourself off, kiddo.',
  old_lose_popcorn: "Old-timer: And that's the ballgame. Rematch? I'll get my popcorn.",
  old_win_eventually: "Old-timer: You won. Eventually. I'll allow it.",
  old_win_ugly: "Old-timer: A win's a win. Even an ugly one.",
  old_win_paint: 'Old-timer: That was like watching paint dry. But with a happy ending.',
  old_win_yesterday: 'Old-timer: Done already? Oh wait, you started yesterday. Nice.',
  old_win_gaveup: 'Old-timer: Well, look at that. The board gave up before you did.',
  old_rescue_modern: 'Old-timer: Buying your way out of trouble? Very modern.',
  old_rescue_refund: 'Old-timer: Rescue, huh. Nothing says confidence like a refund.',
  old_rescue_coins: 'Old-timer: Coins well spent. That buddy was a disaster.',
  old_rescue_cat: 'Old-timer: Rescued! Like a cat from a tree. A very confused cat.',
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

/** Set while baking an effect into a WAV. Live playback does not use the audio context. */
let renderCtx: BaseAudioContext | null = null

function ac(): BaseAudioContext {
  if (renderCtx) return renderCtx
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Resume audio graph before every beep — mobile browsers mute until gesture + resume */
function ensureAudio() {
  if (renderCtx) return
  try {
    const c = ac()
    if (c instanceof AudioContext && c.state === 'suspended') void c.resume()
  } catch {
    /* ignore */
  }
}

function voiceHref(id: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}voices/${id}.mp3`
}

/** 50 ms of silence (valid MP3) used to unlock the voice element on the first tap */
const SILENT_MP3 =
  'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAACoABtbW1tbW1tbW1tbW1tbW1tbW1tkpKSkpKSkpKSkpKSkpKSkpKSkpK2tra2tra2tra2tra2tra2tra2ttvb29vb29vb29vb29vb29vb29vb//////////////////////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJARQAAAAAAAAAqC9P8vrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80TEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEUwAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEpgAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU='

function voicePlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!voiceEl) {
    voiceEl = new Audio()
    voiceEl.preload = 'auto'
  }
  return voiceEl
}

function clearVoiceSafety() {
  if (voiceSafetyTimer != null) {
    window.clearTimeout(voiceSafetyTimer)
    voiceSafetyTimer = null
  }
}

/** Free the channel if `gen` is still the current line, then start a waiting line if any */
function releaseVoice(gen: number) {
  if (gen !== voiceGeneration) return
  clearVoiceSafety()
  currentLine = null
  const next = waitingLine
  waitingLine = null
  if (next && performance.now() <= next.until) {
    // Small gap so two voices don't run into each other
    window.setTimeout(() => {
      if (!currentLine) playVoice(next.id, { ...next.opts, waitMs: 0 })
    }, 250)
  }
}

/** Stop whatever is on the voice channel right now */
function stopVoice() {
  voiceGeneration += 1
  clearVoiceSafety()
  currentLine = null
  const el = voiceEl
  if (!el) return
  el.onended = null
  el.onerror = null
  el.onpause = null
  try {
    el.pause()
  } catch {
    /* ignore */
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (m) {
    waitingLine = null
    stopVoice()
    for (const el of sfxPool) {
      try {
        el.pause()
      } catch {
        /* ignore */
      }
    }
  }
}

export function setVoiceEnabled(on: boolean) {
  voiceEnabled = on
  if (!on) {
    waitingLine = null
    stopVoice()
  }
}

export function unlockAudio() {
  ensureAudio()
  try {
    const c = ac()
    if (c instanceof AudioContext) {
      if (c.state === 'suspended') void c.resume()
      const osc = c.createOscillator()
      const g = c.createGain()
      g.gain.value = 0.00001
      osc.connect(g)
      g.connect(c.destination)
      osc.start()
      osc.stop(c.currentTime + 0.01)
    }
  } catch {
    /* ignore */
  }
  // Effects use their own <audio> elements (see primeSfx). Unlock them in this
  // same gesture so a later effect can play on iPhone, including with the
  // silent switch on. They are not the voice element, so they can overlap it.
  unlockSfxElements()
  void primeSfx()
  // iOS only lets an audio element play without a tap once it has played inside one:
  // prime the shared voice element with a silent clip on the first tap.
  if (voiceUnlocked || currentLine) return
  const el = voicePlayer()
  if (!el) return
  voiceUnlocked = true
  try {
    el.src = SILENT_MP3
    el.volume = 0.01
    void el
      .play()
      .then(() => {
        if (el.src === SILENT_MP3) el.pause()
      })
      .catch(() => {
        voiceUnlocked = false
      })
  } catch {
    voiceUnlocked = false
  }
}

function noiseBurst(duration: number, gain = 0.08, when = 0) {
  if (muted && !renderCtx) return
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
  if (muted && !renderCtx) return
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

/**
 * Effects are baked to WAV and played on <audio> elements, same as the voice
 * clips. iPhone's silent switch mutes Web Audio (AudioContext) and leaves
 * <audio> alone, which is why voices were audible and taps/wins/spins were not.
 * The voice channel stays one element; effects use a separate pool so they
 * can play at the same time as a voice.
 */
const SFX_POOL_SIZE = 6
const sfxPool: HTMLAudioElement[] = []
let sfxPoolCursor = 0
const sfxUrls = new Map<string, string>()
const sfxRecipes = new Map<string, { dur: number; build: () => void }>()
let sfxReady: Promise<void> | null = null

function ensureSfxPool(): HTMLAudioElement[] {
  if (sfxPool.length || typeof Audio === 'undefined') return sfxPool
  for (let i = 0; i < SFX_POOL_SIZE; i++) {
    const el = new Audio()
    el.preload = 'auto'
    sfxPool.push(el)
  }
  return sfxPool
}

function unlockSfxElements() {
  for (const el of ensureSfxPool()) {
    if (el.dataset.unlocked === '1') continue
    el.dataset.unlocked = '1'
    if (!el.paused && el.src && !el.src.startsWith('data:')) continue
    el.volume = 0.001
    el.src = SILENT_MP3
    void el
      .play()
      .then(() => {
        if (el.src === SILENT_MP3 || el.src.startsWith('data:audio/mpeg')) {
          el.pause()
          el.volume = 1
        }
      })
      .catch(() => {
        el.dataset.unlocked = ''
      })
  }
}

function wavUrl(buffer: AudioBuffer): string {
  const samples = buffer.getChannelData(0)
  const n = samples.length
  const ab = new ArrayBuffer(44 + n * 2)
  const view = new DataView(ab)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, n * 2, true)
  let offset = 44
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return URL.createObjectURL(new Blob([ab], { type: 'audio/wav' }))
}

function defineSfx(name: string, dur: number, build: () => void) {
  sfxRecipes.set(name, { dur, build })
}

/** Bake every effect once. Safe to call more than once. */
export function primeSfx(): Promise<void> {
  if (!sfxReady) sfxReady = renderSfxClips()
  return sfxReady
}

async function renderSfxClips() {
  if (typeof OfflineAudioContext === 'undefined') return
  for (const [name, recipe] of sfxRecipes) {
    const rate = 44100
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(rate * recipe.dur)), rate)
    renderCtx = offline
    try {
      recipe.build()
    } finally {
      renderCtx = null
    }
    const rendered = await offline.startRendering()
    sfxUrls.set(name, wavUrl(rendered))
  }
}

function playUrl(url: string) {
  const els = ensureSfxPool()
  if (!els.length) return
  const free = els.find((el) => el.paused)
  const el = free ?? els[sfxPoolCursor++ % els.length]
  el.muted = false
  el.volume = 1
  if (el.src !== url) el.src = url
  try {
    el.currentTime = 0
  } catch {
    /* metadata not in yet; play() still starts at 0 */
  }
  void el.play().catch(() => {
    /* autoplay can reject before the first gesture unlocks the element */
  })
}

function playSfx(name: string) {
  if (muted) return
  const url = sfxUrls.get(name)
  if (url) {
    playUrl(url)
    return
  }
  void primeSfx()
  sfxRecipes.get(name)?.build()
}

defineSfx('tap', 0.12, () => {
  tone(720, 0.05, 'triangle', 0.09)
  noiseBurst(0.035, 0.04)
})

defineSfx('mark', 0.16, () => {
  tone(380, 0.07, 'square', 0.1, 0, 220)
  tone(520, 0.06, 'square', 0.08, 0.04, 300)
  noiseBurst(0.06, 0.055, 0.01)
})

defineSfx('place', 0.22, () => {
  tone(260, 0.1, 'sine', 0.11)
  tone(520, 0.14, 'triangle', 0.09, 0.03)
  tone(1040, 0.09, 'sine', 0.05, 0.07)
})

defineSfx('giggle', 0.36, () => {
  const peeps = [1100, 1320, 1480, 1240, 1600, 1400]
  peeps.forEach((f, i) => {
    tone(f, 0.05, i % 2 ? 'triangle' : 'sine', 0.055, i * 0.04)
  })
  ;[0.04, 0.12, 0.2].forEach((when, i) => noiseBurst(0.04, 0.015 + i * 0.004, when))
})

defineSfx('heart', 0.28, () => {
  tone(420, 0.12, 'sine', 0.1, 0, 280)
  tone(320, 0.16, 'triangle', 0.08, 0.06, 180)
  noiseBurst(0.12, 0.045, 0.04)
})

defineSfx('error', 0.28, () => {
  tone(180, 0.14, 'sawtooth', 0.09, 0, 90)
  tone(140, 0.18, 'square', 0.07, 0.05, 70)
  noiseBurst(0.14, 0.06, 0.02)
})

defineSfx('hint', 0.36, () => {
  tone(523, 0.12, 'sine', 0.1)
  tone(659, 0.14, 'sine', 0.09, 0.07)
  tone(784, 0.16, 'triangle', 0.07, 0.14)
})

defineSfx('undo', 0.14, () => {
  tone(360, 0.09, 'triangle', 0.08, 0, 280)
})

defineSfx('win', 0.8, () => {
  ;[523, 659, 784, 988, 1175].forEach((f, i) => tone(f, 0.3, i % 2 ? 'triangle' : 'sine', 0.1, i * 0.09))
  noiseBurst(0.22, 0.05, 0.35)
})

defineSfx('lose', 0.7, () => {
  tone(320, 0.22, 'triangle', 0.1, 0, 160)
  tone(240, 0.28, 'sine', 0.08, 0.12, 110)
  tone(160, 0.38, 'sawtooth', 0.055, 0.22, 80)
})

defineSfx('whoosh', 0.28, () => {
  noiseBurst(0.2, 0.07)
  tone(480, 0.14, 'sine', 0.05, 0.02, 220)
})

defineSfx('coin', 0.24, () => {
  tone(988, 0.09, 'square', 0.08)
  tone(1319, 0.14, 'sine', 0.1, 0.05)
})

defineSfx('spark', 0.5, () => {
  ;[880, 1175, 1480, 1760, 2093].forEach((f, i) =>
    tone(f, 0.11, i % 2 ? 'triangle' : 'sine', 0.1 - i * 0.01, i * 0.045),
  )
  noiseBurst(0.12, 0.05, 0.02)
  tone(2349, 0.18, 'sine', 0.07, 0.22)
})

defineSfx('spin', 0.95, () => {
  for (let i = 0; i < 12; i++) tone(320 + i * 40, 0.06, 'triangle', 0.055, i * 0.07)
})

defineSfx('prize', 0.55, () => {
  ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, i * 0.08))
})

defineSfx('achievement', 0.42, () => {
  tone(660, 0.12, 'sine', 0.1)
  tone(880, 0.14, 'triangle', 0.09, 0.08)
  tone(1320, 0.2, 'sine', 0.08, 0.16)
})

void primeSfx()

export function sfxTap() {
  playSfx('tap')
}

export function sfxMark() {
  playSfx('mark')
}

export function sfxPlace() {
  playSfx('place')
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

/**
 * Buddy giggle: synth peeps only. The recorded giggles are a female voice, and the only
 * voice in the game is the deeper Roman, so they are not played.
 */
export function sfxGiggle() {
  markSfx(SFX_IDS.giggle)
  playSfx('giggle')
}

export function sfxHeartLose() {
  markSfx(SFX_IDS.heartLose)
  playSfx('heart')
}

export function sfxStone() {
  sfxPlace()
}

export function sfxError() {
  playSfx('error')
}

export function sfxHint() {
  playSfx('hint')
}

export function sfxUndo() {
  playSfx('undo')
}

export function sfxWin() {
  playSfx('win')
}

export function sfxLose() {
  playSfx('lose')
}

export function sfxWhoosh() {
  playSfx('whoosh')
}

export function sfxCoin() {
  playSfx('coin')
}

/** Spark critter catch — bright sparkle cascade (distinct from coin) */
export function sfxSpark() {
  playSfx('spark')
}

export function sfxSpin() {
  playSfx('spin')
}

export function sfxPrize() {
  playSfx('prize')
}

export function sfxAchievement() {
  playSfx('achievement')
}

export interface PlayVoiceOpts {
  mood?: VoiceMood
  /** Channel priority. A new line interrupts only a lower-priority one; otherwise it is skipped. */
  priority?: number
  /** Instead of being skipped while an equal/higher line plays, wait up to this long for the channel. */
  waitMs?: number
  /** Same-pool clips to try when this file is missing or not audio. */
  alts?: readonly string[]
}

const clipUrlCache = new Map<string, string | null>()
const clipLoads = new Map<string, Promise<string | null>>()

function isMp3Bytes(bytes: Uint8Array): boolean {
  if (bytes.length < 64) return false
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 48)).trimStart().toLowerCase()
  if (head.startsWith('<') || head.includes('<!doctype') || head.includes('<html')) return false
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
}

/** Fetch the clip and reject the SPA html fallback (200 text/html). */
function clipObjectUrl(id: string): Promise<string | null> {
  if (clipUrlCache.has(id)) return Promise.resolve(clipUrlCache.get(id) ?? null)
  const pending = clipLoads.get(id)
  if (pending) return pending
  const load = (async () => {
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
    } finally {
      clipLoads.delete(id)
    }
  })()
  clipLoads.set(id, load)
  return load
}

/**
 * Play one voice line on the shared channel.
 * - Only catalog clips play (Roman = Brian, coach = Jenny); anything else is ignored (silent).
 * - While a line is loading or playing, a new line interrupts it only if its priority is higher;
 *   equal/lower priority is skipped (or waits, with waitMs), so lines never stack or overlap.
 */
export function playVoice(id: string, opts: PlayVoiceOpts = {}) {
  if (muted || !voiceEnabled || !id) return
  const queue = [id, ...(opts.alts ?? [])].filter((clip, i, all) => isPlayableVoiceClip(clip) && all.indexOf(clip) === i).slice(0, 5)
  if (!queue.length) return
  const priority = opts.priority ?? 1
  if (currentLine && priority <= currentLine.priority) {
    if (opts.waitMs && (!waitingLine || priority >= (waitingLine.opts.priority ?? 1))) {
      waitingLine = { id, opts, until: performance.now() + opts.waitMs }
    }
    return
  }
  if (waitingLine && priority >= (waitingLine.opts.priority ?? 1)) waitingLine = null
  const el = voicePlayer()
  if (!el) return

  stopVoice()
  const gen = voiceGeneration
  currentLine = { priority, gen }
  // Safety net: never hold the channel forever if the browser drops an 'ended' event
  voiceSafetyTimer = window.setTimeout(() => releaseVoice(gen), 12000)
  const { rate, volume } = moodPlayback(opts.mood ?? (roleForClip(id) === 'roman' ? 'excited' : 'neutral'))
  void playClipQueue(el, queue, gen, rate, volume)
}

async function playClipQueue(el: HTMLAudioElement, queue: string[], gen: number, rate: number, volume: number) {
  for (const clipId of queue) {
    if (gen !== voiceGeneration) return
    const url = await clipObjectUrl(clipId)
    if (gen !== voiceGeneration) return
    if (!url) continue
    el.onended = null
    el.onerror = null
    el.onpause = null
    el.src = url
    const role = roleForClip(clipId)
    if (role === 'roman') {
      el.playbackRate = Math.min(0.94, Math.max(0.82, rate * 0.88))
      el.volume = Math.min(1, volume * 1.05)
    } else if (role === 'oldtimer') {
      // Old-timer's slow, rough delivery is baked into the clip — play it as recorded
      el.playbackRate = 1
      el.volume = Math.min(1, volume * 1.05)
    } else {
      el.playbackRate = Math.min(1.2, Math.max(0.85, rate))
      el.volume = volume
    }
    let ok = false
    try {
      await el.play()
      ok = !el.error
    } catch {
      ok = false
    }
    if (gen !== voiceGeneration) return
    if (ok) {
      const done = () => releaseVoice(gen)
      el.onended = done
      el.onerror = done
      // Paused by the OS/browser (call, tab hidden…) — free the channel
      el.onpause = () => {
        if (gen === voiceGeneration && el.paused) done()
      }
      if (el.ended) done()
      return
    }
  }
  // No playable clip: stay silent (no speech-synthesis fallback)
  releaseVoice(gen)
}

/** Roman or coach line with emotional tone — one at a time on the shared channel */
export function playBanterClip(
  id: string,
  mood: VoiceMood,
  alts?: readonly string[],
  priority?: number,
  waitMs?: number,
) {
  playVoice(id, { mood, alts, priority, waitMs })
}

/** Prefetch the short coach clips in the background (Roman lines load on demand) */
export function warmVoices() {
  if (typeof Audio === 'undefined' || typeof fetch === 'undefined') return
  const ids: string[] = [...WARM_COACH_CLIPS]
  const next = () => {
    const id = ids.shift()
    if (!id) return
    void clipObjectUrl(id).finally(() => window.setTimeout(next, 120))
  }
  window.setTimeout(next, 1500)
}
