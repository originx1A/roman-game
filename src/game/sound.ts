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

/** Old-timer only. Pitch stays natural (preservesPitch); Roman and the coach are unchanged. */
const OLDTIMER_PLAYBACK_RATE = 1.15

/** The one and only voice player. Reused for every line (and unlocked on the first tap for iOS). */
let voiceEl: HTMLAudioElement | null = null
/** Line currently requested/playing on the channel (null = channel free) */
let currentLine: { priority: number; gen: number } | null = null
/**
 * performance.now() when the channel last became free with voices allowed.
 * 0 means "not counting" (busy, muted, voice off, or the clock was just reset).
 */
let voiceFreeSince = 0
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
  roman_record_best: "Roman says: new record! Somebody write that down!",
  roman_record_faster: "Roman says: faster than ever. I've got goosebumps!",
  roman_record_beat: "Roman says: you just beat your own best. Show-off!",
  roman_nearmiss: "Roman says: so close! Roman felt that one.",
  roman_trial_clear: "Roman says: you survived Roman's Trial! Double coins!",
  roman_daily_done: "Roman says: daily challenge, done! See you tomorrow.",
  old_record_head: "Old-timer: New record, huh. Don't let it go to your head.",
  old_record_tea: "Old-timer: Faster than last time. I nearly spilled my tea.",
  old_nearmiss: "Old-timer: Almost. Almost doesn't win a medal.",
  old_win_paint: 'Old-timer: That was like watching paint dry. But with a happy ending.',
  old_win_yesterday: 'Old-timer: Done already? Oh wait, you started yesterday. Nice.',
  old_win_gaveup: 'Old-timer: Well, look at that. The board gave up before you did.',
  old_rescue_modern: 'Old-timer: Buying your way out of trouble? Very modern.',
  old_rescue_refund: 'Old-timer: Rescue, huh. Nothing says confidence like a refund.',
  old_rescue_coins: 'Old-timer: Coins well spent. That buddy was a disaster.',
  old_rescue_cat: 'Old-timer: Rescued! Like a cat from a tree. A very confused cat.',
  old_aside_smell: 'Old-timer: I smell something funny. Was that you?',
  old_aside_heat: 'Old-timer: Who turned the heat up in here?',
  old_aside_glasses: 'Old-timer: Did somebody move my glasses?',
  old_aside_stove: 'Old-timer: Hold on, I think I left the stove on.',
  old_aside_tuesday: 'Old-timer: Is it Tuesday? Feels like a Tuesday.',
  old_aside_tea: "Old-timer: My tea's gone cold again. Story of my life.",
  old_aside_knees: "Old-timer: My knees just predicted rain. They're never wrong.",
  old_aside_remote: "Old-timer: Where'd I put the remote? Don't you move, I'm still talking.",
  old_aside_cat: "Old-timer: The cat's on the board again. Mentally. She's very judgmental.",
  old_aside_socks: "Old-timer: One sock's missing. I blame the squares.",
  old_jab_mitts: "Old-timer: You play like you're wearing oven mitts.",
  old_jab_bingo: "Old-timer: I've seen better moves at a bingo hall.",
  old_jab_phone: 'Old-timer: Is this your first time holding a phone?',
  old_jab_backday: "Old-timer: Back in my day we didn't tap. We committed.",
  old_jab_buddy: 'Old-timer: That buddy looks as confused as you do.',
  old_jab_square: 'Old-timer: Pick a square, any square. Preferably a different one.',
  old_jab_thinking: "Old-timer: I can hear you thinking. It's very quiet.",
  old_jab_patience: "Old-timer: I've got patience. You've got... something else.",
  old_jab_map: 'Old-timer: You need a map for a five-by-five? Bless your heart.',
  old_jab_shoes: 'Old-timer: Tie your shoes and try that square again.',
  old_good_fine: "Old-timer: Fine. That one was fine. Don't get excited.",
  old_good_accident: "Old-timer: A correct buddy. I'll assume it was an accident.",
  old_good_tea: "Old-timer: Not bad. I'll allow a sip of tea.",
  old_good_knees: 'Old-timer: My knees approve. High praise, from them.',
  old_good_once: 'Old-timer: You got one right. Write it down, it might not happen again.',
  old_good_square: 'Old-timer: That square can stay. The rest of them are still nervous.',
  old_good_grumble: "Old-timer: Hmm. Adequate. That's the nicest word I've got.",
  old_good_day: "Old-timer: Back in my day that would've been a Tuesday. Still, not terrible.",
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
  // 9.27-a: more lines for the busiest categories
  coach_hint_look: 'Take a look here.',
  coach_hint_help: 'Here\'s a little help.',
  coach_hint_glow: 'Follow the glow!',
  coach_hint_clue: 'This square is your clue.',
  coach_hint_peek: 'Peek at this one.',
  coach_hint_step: 'One step closer!',
  coach_hint_try: 'Try this spot.',
  coach_lose_breathe: 'Deep breath. You\'ve got this.',
  coach_lose_again: 'So close! Go again?',
  coach_lose_next: 'That one was tricky. Next time!',
  coach_prize_ooh: 'Ooh, a prize!',
  coach_prize_see: 'Let\'s see what you got!',
  coach_badge_earned: 'Badge earned. Well done!',
  coach_badge_look: 'Look at that shiny badge!',
  roman_hint_wink: 'Roman says: wink wink. That square.',
  roman_hint_spy: 'Roman says: my spy eyes see a clue.',
  roman_hint_treasure: 'Roman says: X marks the spot. Well, kinda.',
  roman_lose_cape: 'Roman says: capes off. Try again!',
  roman_lose_shake: 'Roman says: shake it off, puzzle pal. Next round!',
  roman_lose_pillow: 'Roman says: I\'m screaming into a pillow. Rematch?',
  old_wrong_toaster: 'Old-timer: I\'ve seen a toaster make smarter choices.',
  old_wrong_bold: 'Old-timer: Bold. Wrong, but bold. Mostly wrong.',
  old_wrong_hallway: 'Old-timer: You\'d get lost in a hallway, wouldn\'t you?',
  old_wrong_history: 'Old-timer: That move\'s going in the history books. Under \'don\'t\'.',
  old_wrong_spectacles: 'Old-timer: Put your glasses on. Oh, you don\'t wear any? There\'s your problem.',
  old_good_clock: 'Old-timer: Even a broken clock is right twice a day.',
  old_good_surprised: 'Old-timer: Well, would you look at that. I\'m surprised too.',
  old_good_lucky: 'Old-timer: Lucky tap. Don\'t let it go to your head.',
  old_good_clap: 'Old-timer: Don\'t expect me to clap. My hands are cold.',
  old_hint_flashlight: 'Old-timer: A hint? Want a map and a flashlight too?',
  old_hint_grandkid: 'Old-timer: My grandkid asks for hints. He\'s four.',
  old_hint_cane: 'Old-timer: Lean on that hint. I lean on a cane. We all need something.',
  old_hint_cheating: 'Old-timer: Back in my day we called that cheating.',
  old_undo_face: 'Old-timer: Undo all you like. You can\'t undo that face you\'re making.',
  old_undo_yoyo: 'Old-timer: Up, down, back, forth. You\'re a yo-yo.',
  old_undo_regret: 'Old-timer: So much regret for one little square.',
  old_undo_aging: 'Old-timer: Pick one! I\'m aging over here.',
  old_undo_eraser: 'Old-timer: You\'d wear out an eraser in a day.',
  old_win_squirrel: 'Old-timer: A blindfolded squirrel would\'ve been quicker. But fine, you won.',
  old_win_frame: 'Old-timer: Frame it. It might not happen again.',
  old_win_napped: 'Old-timer: Congratulations. I only napped twice.',
  old_win_twothree: 'Old-timer: Messy. Slow. Victorious. I\'ll take one out of three.',
  old_lose_called: 'Old-timer: Called it. I called it at the first square.',
  old_lose_sandwich: 'Old-timer: Hearts gone. Go have a sandwich and think about what you did.',
  old_lose_nephew: 'Old-timer: My nephew lost like that once. He\'s a lawyer now. Worked out fine.',
  old_lose_deal: 'Old-timer: Fold \'em, kiddo. Deal again.',
  old_idle_mail: 'Old-timer: The mail came faster than your next move.',
  old_idle_beard: 'Old-timer: I grew a beard waiting for that. Look at it.',
  old_idle_birthday: 'Old-timer: Hurry up. I\'d like to finish before my birthday.',
  old_aside_humming: 'Old-timer: Is that my radio? No? Then who\'s humming?',
  old_aside_pigeons: 'Old-timer: The pigeons out back are plotting something. I can feel it.',
  old_rescue_lifeguard: 'Old-timer: Somebody call a lifeguard. You\'re drowning in squares.',
  old_rescue_parachute: 'Old-timer: Nice parachute. Shame about the landing.',
}

export function voiceLineText(id: string): string | undefined {
  return FALLBACK_TEXT[id as VoiceLineId]
}

function ac(): AudioContext {
  if (!ctx) {
    // Older iOS Safari only has the prefixed constructor.
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error('Web Audio unavailable')
    ctx = new Ctor()
  }
  if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {})
  return ctx
}

/** Resume audio graph before every beep — mobile browsers mute until gesture + resume */
function ensureAudio() {
  try {
    const c = ac()
    if (c.state !== 'running' && c.state !== 'closed') void c.resume().catch(() => {})
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
  voiceFreeSince = 0
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
  voiceFreeSince = 0
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

/**
 * 9.29-a: a board just ended. Drop any line still waiting for the channel and cut a line that is
 * playing below `minPriority`, so a stall/wrong/undo/old-timer line queued a moment earlier can't
 * play over (or after) the win or lose line.
 */
export function cancelVoiceBelow(minPriority: number) {
  if (waitingLine && (waitingLine.opts.priority ?? 1) < minPriority) waitingLine = null
  if (currentLine && currentLine.priority < minPriority) stopVoice()
}

export function setMuted(m: boolean) {
  muted = m
  voiceFreeSince = 0
  if (m) {
    waitingLine = null
    stopVoice()
  }
}

export function setVoiceEnabled(on: boolean) {
  voiceEnabled = on
  voiceFreeSince = 0
  if (!on) {
    waitingLine = null
    stopVoice()
  }
}

/**
 * How long the shared voice channel has been free, in ms.
 * Null while a line is playing, one is waiting, effects/voices are muted, or voice lines are off.
 * Unmuting or turning voices back on starts the clock over, so a remark doesn't fire immediately.
 */
export function voiceQuietMs(): number | null {
  if (typeof performance === 'undefined') return null
  if (muted || !voiceEnabled || currentLine || waitingLine) return null
  if (voiceFreeSince === 0) voiceFreeSince = performance.now()
  return performance.now() - voiceFreeSince
}

/** Drop any quiet time already counted (a new puzzle shouldn't inherit menu silence). */
export function resetVoiceQuietClock() {
  voiceFreeSince = 0
}

export function unlockAudio() {
  ensureAudio()
  try {
    const c = ac()
    if (c.state !== 'running' && c.state !== 'closed') void c.resume().catch(() => {})
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
  if (muted) return
  // A sound effect must never throw into a game action (Undo commits after its beep).
  try {
    noiseBurstUnsafe(duration, gain, when)
  } catch {
    /* ignore */
  }
}

function noiseBurstUnsafe(duration: number, gain: number, when: number) {
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
  try {
    toneUnsafe(freq, duration, type, gain, when, slideTo)
  } catch {
    /* ignore */
  }
}

function toneUnsafe(
  freq: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  when: number,
  slideTo?: number,
) {
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
 * Buddy giggle: synth peeps only. The recorded giggles are a female voice, and the only
 * voice in the game is the deeper Roman, so they are not played.
 */
export function sfxGiggle() {
  markSfx(SFX_IDS.giggle)
  synthGiggle()
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

/*
 * Buddy Hunt tile sounds (9.27-b). Same Web Audio synth, gains and mute switch as the other
 * effects, so they play on top of a voice line (voices use a separate audio element).
 */
export const HUNT_SFX = {
  flip: 'sfxHuntFlip',
  found: 'sfxHuntFound',
  miss: 'sfxHuntMiss',
  fanfare: 'sfxHuntFanfare',
  none: 'sfxHuntNone',
} as const

/** Every press: a short card-flip click */
export function sfxHuntFlip() {
  markSfx(HUNT_SFX.flip)
  noiseBurst(0.045, 0.07)
  tone(950, 0.06, 'triangle', 0.1, 0, 520)
}

/** Found a buddy: bright pop-chime plus the buddy giggle */
export function sfxHuntFound() {
  markSfx(HUNT_SFX.found)
  tone(660, 0.1, 'sine', 0.12, 0.05)
  tone(990, 0.12, 'triangle', 0.1, 0.1)
  tone(1320, 0.16, 'sine', 0.09, 0.15)
  window.setTimeout(sfxGiggle, 180)
}

/** Empty tile: a soft low whomp */
export function sfxHuntMiss() {
  markSfx(HUNT_SFX.miss)
  tone(210, 0.24, 'sine', 0.16, 0.05, 90)
  tone(140, 0.2, 'triangle', 0.07, 0.08, 70)
}

/** All three found: a little fanfare */
/** New personal best: quick rising sparkle + chord (Web Audio, same mute/volume as the rest) */
export function sfxRecord() {
  markSfx('sfxRecord')
  ;[659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, 0.15 + i * 0.08))
  ;[988, 1319, 1976].forEach((f) => tone(f, 0.6, 'sine', 0.05, 0.5))
  noiseBurst(0.15, 0.03, 0.5)
}

export function sfxHuntFanfare() {
  markSfx(HUNT_SFX.fanfare)
  ;[523, 659, 784].forEach((f, i) => tone(f, 0.14, 'triangle', 0.1, 0.45 + i * 0.11))
  ;[1047, 1319, 1568].forEach((f) => tone(f, 0.5, 'sine', 0.07, 0.8))
  noiseBurst(0.2, 0.04, 0.8)
}

/** No buddies found: a gentle down-tone */
export function sfxHuntNone() {
  markSfx(HUNT_SFX.none)
  tone(440, 0.22, 'sine', 0.09, 0.4, 350)
  tone(330, 0.34, 'sine', 0.08, 0.62, 220)
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
  voiceFreeSince = 0
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
      // A touch faster than the recorded take. Pitch stays put so he still sounds like William.
      const media = el as HTMLAudioElement & { webkitPreservesPitch?: boolean }
      media.preservesPitch = true
      media.webkitPreservesPitch = true
      media.playbackRate = OLDTIMER_PLAYBACK_RATE
      el.volume = Math.min(1, volume * 1.05)
    } else {
      el.playbackRate = Math.min(1.2, Math.max(0.85, rate))
      el.volume = volume
    }
    let ok = false
    let refused = false
    try {
      await el.play()
      ok = !el.error
    } catch {
      // The browser refused to play (autoplay / interrupted). The next clip would be refused too:
      // stop here instead of walking the pool in order (that made the first alts repeat a lot).
      refused = true
    }
    if (gen !== voiceGeneration) return
    if (refused) break
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
