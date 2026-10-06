/**
 * SFX + one shared voice channel (Roman + coach).
 * Every voice line goes through a single HTMLAudioElement, so two lines can never sound at once.
 * Roman is always the deeper Brian clips; the old-timer heckler is William (+rasp); the coach is Jenny. No speech-synthesis fallback:
 * if a clip can't play, the line stays silent.
 */

import { heardEnough } from './heardLog'
import {
  WARM_COACH_CLIPS,
  isPlayableVoiceClip,
  romanPlaybackRate,
  moodPlayback,
  roleForClip,
  type VoiceLineId,
  type VoiceMood,
} from './voiceLines'
import { boardEndCancel, clipEndsAt, decideVoice, replacesWaiting, type ChannelLine } from './voiceChannel'

let ctx: AudioContext | null = null
let muted = false
let voiceEnabled = true

/**
 * Old-timer speed. Pitch stays natural (preservesPitch), so he keeps his deep gruff voice.
 * 9.30-e (Tony): about 11% quicker than 9.30-d's 1.15. Roman's speed: romanPlaybackRate (voiceLines.ts).
 */
export const OLDTIMER_PLAYBACK_RATE = 1.28

/** The one and only voice player. Reused for every line (and unlocked on the first tap for iOS). */
let voiceEl: HTMLAudioElement | null = null
/** Line currently requested/playing on the channel (null = channel free) */
let currentLine: ({ gen: number } & ChannelLine) | null = null
/** Clip id asked for by the current line (9.30-f duplicate guard) */
let currentClip: string | null = null
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
  // 9.30-g: combined not-best lines (board cleared + slower than your best)
  old_notbest_tsk: "Old-timer: Board's clear... but slower than last time. Tsk.",
  old_notbest_yesterday: "Old-timer: You won. Your old self still beat you, though. He's smug about it.",
  old_notbest_rerun: "Old-timer: Same board, slower time. Like a rerun, but longer.",
  old_notbest_ghost: "Old-timer: Done, sure. Your ghost finished first and went home.",
  old_notbest_calendar: "Old-timer: Nice clear. Your best time is over there, waving. From far away.",
  old_notbest_knees: "Old-timer: Cleared it. Slower than before, and I know slow. Ask my knees.",
  old_notbest_tea: "Old-timer: You won. I finished a whole cup of tea. Last time I only got a sip.",
  old_notbest_downhill: "Old-timer: A win, but slower than your record. It's all downhill from here, kid.",
  old_notbest_slowpoke: "Old-timer: Board's done. Your record's safe. From you, mostly.",
  roman_notbest_record: "Roman says: board cleared! Your record just yawned, though.",
  roman_notbest_again: "Roman says: winner! Not your fastest. Roman noticed. Roman always notices.",
  roman_notbest_turtle: "Roman says: you did it, turtle-style! Your best time says hi.",
  coach_notbest_clear: "Board cleared. A little slower than your best. You know you have more in you.",
  coach_notbest_close: "Nice finish. Not a new best this time, but the next one could be.",
  // 9.30-i: approved thin-pool lines
  roman_record_fireworks: "Roman says: new best time! Cue the fireworks!",
  roman_record_clock: "Roman says: the clock can't even keep up with you!",
  roman_record_fridge: "Roman says: new record! That's going on the fridge.",
  roman_record_zoom: "Roman says: zoom! You just beat your old self.",
  roman_record_notes: "Roman says: record smashed. Roman is taking notes.",
  roman_record_socks: "Roman says: new record! You knocked my socks off. Both of them.",
  // 9.30-o: approved lines (voice-lines-draft-3.md)
  roman_wrong_hiccup: "Roman says: tiny hiccup. Tap again!",
  roman_wrong_hat: "Roman says: that square is wearing the wrong hat.",
  roman_wrong_bounce: "Roman says: boing! That one bounced right off.",
  roman_wrong_cousin: "Roman says: that square is a cousin. Not the one you want.",
  roman_wrong_marble: "Roman says: Roman lost a marble. It was that tap.",
  roman_wrong_toast: "Roman says: that move is burnt toast. Make a new slice.",
  roman_wrong_sneeze: "Roman says: was that a sneeze? Bless you. Try again!",
  roman_wrong_cape: "Roman says: Roman's cape twitched. Wrong square.",
  roman_wrong_map: "Roman says: you are holding the map upside down.",
  roman_wrong_nearly: "Roman says: nearly! Nearly is not a square, though.",
  roman_wrong_banana: "Roman says: you slipped on a banana. Roman saw it all.",
  roman_wrong_clown: "Roman says: the wrong square did a little clown honk.",
  roman_wrong_nap: "Roman says: that square is napping. Do not wake it.",
  roman_wrong_dance: "Roman says: nice dance move. Wrong spot, though!",
  roman_wrong_puddle: "Roman says: splash! Wrong puddle.",
  roman_wrong_hmm: "Roman says: hmm. Roman's eyebrow went up.",
  roman_wrong_gremlin: "Roman says: a gremlin moved your finger. Blame him.",
  roman_wrong_shelf: "Roman says: that one goes on a different shelf.",
  roman_wrong_chirp: "Roman says: the birds are chirping about that tap.",
  roman_wrong_pancake: "Roman says: flat as a pancake. Flip it and try again.",
  roman_wrong_noodle: "Roman says: your finger went full noodle.",
  roman_wrong_nice_try: "Roman says: nice try, champion. Different square!",
  roman_wrong_plot: "Roman says: Roman had a plan. That was not the plan.",
  roman_wrong_mirror: "Roman says: even the mirror said no.",
  roman_wrong_hop: "Roman says: hop over to another square.",
  roman_wrong_wobble: "Roman says: wobbly tap! Steady now.",
  roman_wrong_ticket: "Roman says: that square wants to see a ticket.",
  roman_wrong_gong: "Roman says: gong! Wrong.",
  roman_wrong_sock: "Roman says: that tap is a mismatched sock.",
  roman_wrong_detour: "Roman says: scenic detour. Now come back.",
  coach_wrong_touch_gap: "Give your buddies a little room. Try a square with a gap.",
  coach_wrong_touch_corner: "Careful, buddies can't touch, even at the corners.",
  coach_wrong_row_one: "One buddy per row and column. This one already has one.",
  coach_wrong_region_own: "Each colour gets just one buddy, and this one has its buddy.",
  coach_wrong_any_close: "Not quite. Look for a spot that's safe.",
  coach_wrong_any_ok: "That's okay. Take another look.",
  old_good_stopped: "Old-timer: Even a stopped clock, and so on. Go on.",
  old_good_carry: "Old-timer: Fine. I'll carry your bags. Just this once.",
  old_good_twice: "Old-timer: Do that twice and I'll believe it.",
  old_good_mild: "Old-timer: That was mildly acceptable.",
  old_good_bones: "Old-timer: My bones felt that one. In a good way.",
  old_good_newspaper: "Old-timer: That belongs in the newspaper. The small print.",
  old_good_nod: "Old-timer: You get a nod. Don't spend it all at once.",
  old_good_soup: "Old-timer: Not bad. Almost like my soup.",
  old_good_hat: "Old-timer: I'd tip my hat, but I can't find my hat.",
  old_good_decent: "Old-timer: Decent. Very decent. I said decent.",
  old_good_kid: "Old-timer: Not bad, kid. Don't tell your mother I said so.",
  old_good_bench: "Old-timer: I'll save you a spot on the bench for that one.",
  old_good_radio: "Old-timer: That was smoother than my radio.",
  old_good_cardigan: "Old-timer: That deserves a warm cardigan.",
  old_good_bingo: "Old-timer: I haven't seen a move like that since bingo night.",
  old_good_porch: "Old-timer: Sit on the porch with that one. You've earned it.",
  old_good_gravy: "Old-timer: That's gravy. Thin gravy, but gravy.",
  old_good_whistle: "Old-timer: I'd whistle, but my teeth are in the other room.",
  old_good_rare: "Old-timer: A right answer. Rarer than a quiet pigeon.",
  old_good_blink: "Old-timer: Blink and I'd have missed it. Then I did.",
  old_good_weather: "Old-timer: Good. Weather's clearing up.",
  old_good_fair: "Old-timer: Fair enough. Fair enough.",
  old_aside_door: "Old-timer: Did somebody knock? No? Must be the door thinking again.",
  old_aside_slippers: "Old-timer: Where did my slippers go? They were just here.",
  old_aside_biscuit: "Old-timer: I could go for a biscuit. Hard ones. Like life.",
  old_aside_weather: "Old-timer: Radio says rain. Radio also says a lot of things.",
  old_aside_lawn: "Old-timer: Kids on my lawn again. Mentally.",
  old_aside_crossword: "Old-timer: Seven letters, starts with S. Squares.",
  old_aside_clock: "Old-timer: That clock's been slow since Thursday.",
  old_aside_neighbour: "Old-timer: The neighbour's dog is judging me.",
  old_aside_mail: "Old-timer: Did the mail come? I'm expecting nothing, as usual.",
  old_aside_nap: "Old-timer: I was resting my eyes. Not sleeping. Resting.",
  old_aside_stairs: "Old-timer: Stairs got longer overnight, I swear.",
  old_aside_phone: "Old-timer: Phone's ringing. Nope, that's my ears.",
  old_aside_lemon: "Old-timer: Smells like lemon in here. Or is it me?",
  old_aside_ache: "Old-timer: My elbow says something's coming. Could be lunch.",
  old_aside_whistle: "Old-timer: Somebody's whistling. Is it me? It's me.",
  roman_prize_drumroll: "Roman says: drumroll, please! Or just tap the wheel.",
  roman_prize_jackpot: "Roman says: is it jackpot time? Roman feels jackpot.",
  roman_prize_spin: "Roman says: spin it, champ!",
  roman_prize_wheel: "Roman says: the wheel loves you today.",
  roman_prize_goodies: "Roman says: goodies incoming!",
  roman_prize_shiny: "Roman says: ooh, shiny things ahead.",
  roman_prize_fate: "Roman says: let fate wiggle the wheel!",
  coach_prize_spin: "Give the wheel a spin!",
  coach_prize_lucky: "Feeling lucky? Let's find out.",
  coach_prize_reward: "You earned this reward.",
  coach_prize_surprise: "Here comes a surprise!",
  coach_prize_nice: "A prize for you. Nicely done!",
  coach_badge_nice: "You earned a new badge. Great job!",
  coach_badge_hard: "That badge took real effort.",
  coach_badge_proud: "A shiny new badge. Be proud!",
  coach_badge_collect: "Another one for your collection.",
  roman_badge_trophy: "Roman says: badge time! Roman is clapping. Loudly.",
  roman_badge_brag: "Roman says: new badge. You may brag for ten seconds.",
  roman_badge_shelf: "Roman says: badge get! Clear a spot on the shelf.",
  roman_badge_gold: "Roman says: badge earned. Roman calls it gold.",
  coach_hint_light: "This square is lit for you.",
  coach_hint_start: "Start with this one.",
  coach_hint_safe: "This spot is a safe bet.",
  coach_hint_point: "Here's where I'd look.",
  coach_hint_easy: "Take this square. It's a good one.",
  roman_hint_shh: "Roman says: shh, look at the glowing square.",
  roman_hint_magic: "Roman says: a little magic for you. That square.",
  roman_hint_map: "Roman says: the treasure map says, right here.",
  roman_hint_owl: "Roman says: a wise owl told me. That square.",
  roman_hint_boop: "Roman says: boop! Tap that one.",
  old_hint_mapquest: "Old-timer: Fine, here's a hint. Don't get used to being led around.",
  old_hint_crutch: "Old-timer: That hint's a crutch. Lean on it, sure.",
  old_hint_giveup: "Old-timer: Hints already? I've waited longer for a bus.",
  coach_notbest_again: "Good clear. Try again and go a bit faster.",
  coach_notbest_steady: "Steady win. Your best is still within reach.",
  coach_notbest_learning: "You're learning this board. Keep going.",
  coach_notbest_nice_win: "Nice win! You'll beat your time soon.",
  coach_notbest_almost: "A win is a win. Chase that best next.",
  coach_notbest_fresh: "Cleared! One more go could be your fastest.",
  coach_notbest_calm: "Calm and steady wins boards. Speed comes next.",
  coach_notbest_close2: "Not your fastest, but a strong finish.",
  coach_notbest_rhythm: "You're finding your rhythm. Go again!",
  coach_notbest_smile: "Board cleared. Smile, you're improving.",
  coach_notbest_bank: "Bank that win. The record is next.",
  roman_notbest_snail: "Roman says: you won! A snail passed you on the way, but you won.",
  roman_notbest_yawn: "Roman says: cleared it! Your best time did a big yawn.",
  old_notbest_slow: "Old-timer: Won it. Slower than your best. Fine. Slow is my speed.",
  old_notbest_sunday: "Old-timer: Nice win. Took a nice Sunday stroll, did you?",
  old_notbest_snail: "Old-timer: You won. A snail sent a postcard while you thought.",
  old_notbest_stroll: "Old-timer: Cleared. You took the scenic route.",
  old_notbest_pension: "Old-timer: A win at a pensioner's pace. I approve, sort of.",
  old_notbest_crawl: "Old-timer: Won it. Your best time is still out in front. Way out.",
  roman_record_rocket: "Roman says: new record! Was that a rocket?",
  coach_record_fast: "New best time. Look how quick you got!",
  roman_idle_dust: "Roman says: I see dust on that square.",
  roman_idle_tick: "Roman says: tick tock, tick tock.",
  roman_idle_tea: "Roman says: I'll make some tea while you think.",
  roman_idle_cloud: "Roman says: that cloud looks like a good move.",
  roman_idle_stretch: "Roman says: time for a stretch. Then a tap.",
  coach_idle_take: "Take your time. Whenever you're ready, tap a square.",
  old_undo_merry: "Old-timer: Round and round like a merry-go-round.",
  old_undo_pendulum: "Old-timer: You swing like a pendulum. Pick a side.",
  old_undo_sweep: "Old-timer: Sweeping it away and putting it back. Quite the housekeeper.",
  old_undo_dial: "Old-timer: Turning that undo like a radio dial. Find a station!",
  roman_undo_boomerang: "Roman says: your move is a boomerang. Back it comes.",
  old_wrong_aim: "Old-timer: Your aim's worse than mine, and I've got cataracts.",
  old_wrong_bird: "Old-timer: A pigeon would have picked better.",
  old_wrong_sideways: "Old-timer: You went sideways. Squares don't go sideways.",
  old_wrong_seat: "Old-timer: That square's already got a seat.",
  old_wrong_nope: "Old-timer: Nope. Nope. And nope again.",
  old_wrong_cheese: "Old-timer: That's the wrong cheese, kid.",
  old_wrong_map: "Old-timer: You're lost. Want directions?",
  old_wrong_cane: "Old-timer: I'd poke that move with my cane.",
  old_nearmiss_close: "Old-timer: Close. A closer look next time.",
  old_record_nap: "Old-timer: New record. I didn't even get to finish my nap.",
  old_record_teeth: "Old-timer: Faster than ever. I almost dropped my teeth.",
  old_record_luck: "Old-timer: A new best? Beginner's luck. Probably. Maybe.",
  old_record_showoff: "Old-timer: New record. Back in my day we called that showing off.",
  old_record_rocking: "Old-timer: That was quick. My rocking chair's still rocking.",
  old_record_pencil: "Old-timer: Fine, it's a record. I'll write it down. Where'd I put my pencil?",
  coach_record_best: "New best time. Amazing work!",
  coach_record_faster: "That's your fastest yet. Well done!",
  coach_record_proud: "A new record! You should be proud.",
  coach_record_practice: "New record. All that practice is paying off!",
  roman_trial_shocked: "Roman says: you beat Roman's Trial! Roman is shocked. Shocked!",
  roman_trial_coins: "Roman says: Trial cleared! Double coins, coming right up.",
  roman_trial_unfair: "Roman says: you beat the clock AND my Trial. Not fair!",
  roman_trial_crown: "Roman says: Trial champion! Roman will make you a paper crown.",
  roman_trial_harder: "Roman says: you survived! Roman needs a harder Trial.",
  coach_trial_clear: "You cleared the Trial. Double coins for you!",
  coach_trial_clock: "You beat the clock! Great focus.",
  coach_trial_steady: "Trial complete. Nice and steady under pressure.",
  old_trial_huh: "Old-timer: You beat the Trial. Huh. Didn't see that coming.",
  old_trial_candy: "Old-timer: Double coins, eh? Don't spend it all on candy.",
  old_trial_complaint: "Old-timer: Beat the clock, did ya? The clock's filing a complaint.",
  roman_daily_streak: "Roman says: daily done! Keep that streak rolling.",
  roman_daily_cook: "Roman says: that's today's board. Roman will cook up a new one tomorrow.",
  roman_daily_calendar: "Roman says: daily challenge crushed! Mark the calendar.",
  roman_daily_snack: "Roman says: daily done! Go have a snack. You earned it.",
  roman_daily_sametime: "Roman says: done for today! Same time tomorrow?",
  coach_daily_done: "Daily challenge done. See you tomorrow!",
  coach_daily_streak: "Another day, another win. Keep the streak going!",
  coach_daily_great: "Today's board is done. Great job!",
  old_daily_paper: "Old-timer: Daily done. Now I can read my paper in peace.",
  old_daily_tomorrow: "Old-timer: That's today's. Come back tomorrow. I'll still be here. Probably.",
  old_daily_everyday: "Old-timer: Every day, huh? Even I don't show up every day.",
  coach_notbest_stands: "Board cleared! Your best time still stands. Try again?",
  coach_notbest_okay: "You won. A bit slower this time, and that's okay.",
  coach_notbest_chase: "Nice clear. Your best time is still out there to chase.",
  coach_notbest_breath: "Board done! Not quite your best. Take a breath and go again.",
  coach_notbest_safe: "Good win. Your record's safe for now. You'll get it.",
  coach_notbest_practice: "Cleared it. Slower than your best, but every run is practice.",
  coach_stash_five: "All five sparks! Bonus unlocked!",
  coach_stash_complete: "Critter stash complete. Nice catching!",
  coach_stash_bonus: "That's the whole stash. Enjoy the bonus!",
  coach_stash_sparkle: "Five for five! Time to sparkle.",
  // 9.30-j: tip lines now also play as ordinary moment lines
  tip_daily_coach_careful: "Daily Challenge! Only one try counts, so take your time.",
  tip_daily_coach_streak: "Come back every day to build your streak and earn more coins.",
  tip_daily_old_glasses: "Daily puzzle. I do one every day too. It's called finding my glasses.",
  tip_daily_old_pills: "Daily puzzle. Same time tomorrow, like my pills.",
  tip_daily_old_diet: "One try a day. That's more discipline than my diet.",
  tip_daily_old_crossword: "The daily. I treat it like the crossword, except I actually finish this one.",
  tip_daily_old_nap: "New puzzle every morning. It's the only routine I respect besides napping.",
  tip_daily_old_parking: "One shot, kiddo. No do-overs. Like parking at the grocery store.",
  tip_daily_roman_first: "it's the Daily Challenge. Everybody gets this board today. Only your first try counts.",
  tip_daily_roman_streak: "win today, win tomorrow, and your streak grows. Like Roman's ego.",
  tip_stall_coach_combo: "Quick moves keep your combo alive. Even a little X counts!",
  tip_stall_coach_fewest: "Try the row or region with the fewest open squares first.",
  tip_stall_coach_marks: "Stuck? Mark the squares that can't have a buddy. It opens things up.",
  tip_stall_old_combo: "Your combo died of old age. And I'd know about old age.",
  tip_stall_old_free: "Put an X somewhere. X's are free. Unlike my patience.",
  tip_stall_old_timer: "The timer doesn't stop for thinking, kiddo. Neither do I. Well, I do. Often.",
  tip_stall_roman_beg: "tap something. Anything. Roman is begging politely.",
  tip_stall_roman_clock: "the clock is still running. Roman checked. Twice.",
  tip_stall_roman_combo: "every second you think, your combo takes a nap.",
  tip_trial_coach_marks: "Tip: X's are free, and they never cost a heart. Use them.",
  tip_trial_coach_rules: "This is the Trial: race the clock, two hearts, no undo. You've got this!",
  tip_trial_old_doctor: "Two hearts and a timer. I've had doctor's appointments like this.",
  tip_trial_old_embarrass: "This is the real deal. Try not to embarrass yourself.",
  tip_trial_old_marriage: "Trial mode. No safety net. Like my first marriage.",
  tip_trial_old_baseball: "Three strikes and you're out. Baseball got it right.",
  tip_trial_old_gym: "No hints, no mercy. Just like my old gym teacher.",
  tip_trial_old_life: "No undo button in here. Welcome to how life works.",
  tip_trial_roman_coins: "beat the clock and you get double coins. Lose, and Roman laughs. Gently.",
  tip_trial_roman_welcome: "welcome to Roman's Trial. Two hearts, no undo, and a clock. Roman is not sorry.",
  tip_undo_coach_cost: "Heads up: each undo costs 25 points and resets your combo.",
  tip_undo_coach_marks: "Try marking X's first. They're safer than guessing a buddy.",
  tip_undo_coach_stars: "Want three stars? Finish without any undos. Take a breath before you tap.",
  tip_undo_old_crying: "Back in my day we had one undo. It was called crying.",
  tip_undo_old_prices: "Twenty-five points a pop. At these prices I'd think before I tapped.",
  tip_undo_old_rent: "Undo again and I'm charging you rent on that button.",
  tip_undo_roman_count: "every undo costs twenty-five points. Roman is counting. Roman is always counting.",
  tip_undo_roman_rules: "three undos? No three stars for you. Roman's rules.",
  tip_undo_roman_sock: "undo, undo, undo. Your score is shrinking like a wool sock.",
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

/** 9.30-f: told when a clip actually starts playing (the line bags only count heard lines) */
let voiceStartListener: ((clip: string) => void) | null = null
export function setVoiceStartListener(fn: ((clip: string) => void) | null) {
  voiceStartListener = fn
}

/**
 * 9.30-k: told when a clip counts as HEARD: it finished, or it has played 70% of its length.
 * (A line that was only requested, dropped as stale, skipped, or cut off early never counts.)
 */
let voiceHeardListener: ((clip: string) => void) | null = null
export function setVoiceHeardListener(fn: ((clip: string) => void) | null) {
  voiceHeardListener = fn
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
  el.onloadedmetadata = null
  el.ontimeupdate = null
  try {
    el.pause()
  } catch {
    /* ignore */
  }
}

/**
 * 9.29-a: a board just ended. Drop any line still WAITING for the channel below `minPriority`, so a
 * stall/wrong/undo/old-timer line queued a moment earlier can't play after the win or lose line.
 * 9.30-e: a line that is already playing is never cut (the old-timer finishes his sentence; the
 * win/lose line waits for him). Only one still loading (not heard yet) is dropped.
 */
export function cancelVoiceBelow(minPriority: number) {
  const c = boardEndCancel(currentLine, waitingLine ? (waitingLine.opts.priority ?? 1) : null, minPriority)
  if (c.dropWaiting) waitingLine = null
  if (c.stopCurrent) stopVoice()
}

/** 9.30-e: a new board starts: lines queued on the last board don't play on this one (a line already playing still finishes) */
export function dropWaitingVoice() {
  waitingLine = null
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

/**
 * 9.30-a: the player's pet buddy (The Stable) giggles when tapped or cheering. These use the three
 * recorded buddy giggles on their own little audio element, never the Roman voice channel, and
 * never on top of a Roman line (then it's the synth peeps). Rotates so the same giggle never
 * plays twice in a row.
 */
let petGiggleEl: HTMLAudioElement | null = null
let lastPetGiggle = -1
export const PET_GIGGLES = ['buddy_giggle_1', 'buddy_giggle_2', 'buddy_giggle_3'] as const
export function petGiggle(opts: { quietOnly?: boolean } = {}): string | null {
  if (muted) return null
  if (opts.quietOnly && (currentLine || waitingLine)) return null
  if (currentLine || waitingLine || typeof Audio === 'undefined') {
    synthGiggle()
    return 'synth'
  }
  let i = Math.floor(Math.random() * PET_GIGGLES.length)
  if (i === lastPetGiggle) i = (i + 1) % PET_GIGGLES.length
  lastPetGiggle = i
  const id = PET_GIGGLES[i]
  try {
    if (!petGiggleEl) petGiggleEl = new Audio()
    petGiggleEl.pause()
    petGiggleEl.src = voiceHref(id)
    petGiggleEl.volume = 0.7
    void petGiggleEl.play().catch(() => synthGiggle())
  } catch {
    synthGiggle()
  }
  if (typeof window !== 'undefined') (window as unknown as { __petGiggles?: string[] }).__petGiggles?.push(id)
  return id
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
  // 9.30-f: the same clip already playing or waiting its turn isn't asked for twice (a line only
  // counts as played once heard, so its bag can offer it again while it waits)
  if ((currentLine && currentClip === id) || waitingLine?.id === id) return
  // 9.30-e: a line that has started always finishes; higher lines wait their turn (or go stale)
  const d = decideVoice(currentLine, { priority, waitMs: opts.waitMs }, performance.now())
  if (d.kind === 'skip') return
  if (d.kind === 'wait') {
    if (replacesWaiting(waitingLine ? (waitingLine.opts.priority ?? 1) : null, priority)) waitingLine = { id, opts, until: d.until }
    return
  }
  if (waitingLine && priority >= (waitingLine.opts.priority ?? 1)) waitingLine = null
  const el = voicePlayer()
  if (!el) return

  stopVoice()
  const gen = voiceGeneration
  currentLine = { priority, gen, audible: false, endsAt: 0 }
  currentClip = id
  voiceFreeSince = 0
  // Safety net while loading: never hold the channel forever if a clip never starts. Once it plays,
  // this is replaced by one sized to the clip (so the channel isn't freed while he's still talking).
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
    // 9.30-h: pitch stays natural for every voice when the speed changes
    const media = el as HTMLAudioElement & { webkitPreservesPitch?: boolean }
    media.preservesPitch = true
    media.webkitPreservesPitch = true
    if (role === 'roman') {
      // 9.30-h (Tony): ~10% quicker than 9.30-g. Default rate too: iOS resets playbackRate to it on a src swap
      const romanRate = romanPlaybackRate(rate)
      media.defaultPlaybackRate = romanRate
      media.playbackRate = romanRate
      el.volume = Math.min(1, volume * 1.05)
    } else if (role === 'oldtimer') {
      // A touch faster than the recorded take. Pitch stays put so he still sounds like William.
      // default rate too: a src swap resets playbackRate to it on some iOS versions
      media.defaultPlaybackRate = OLDTIMER_PLAYBACK_RATE
      media.playbackRate = OLDTIMER_PLAYBACK_RATE
      el.volume = Math.min(1, volume * 1.05)
    } else {
      el.playbackRate = Math.min(1.2, Math.max(0.85, rate))
      el.volume = volume
    }
    if (role !== 'oldtimer' && role !== 'roman') el.defaultPlaybackRate = el.playbackRate
    const wantRate = el.playbackRate
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
      try {
        voiceStartListener?.(clipId)
      } catch {
        /* rotation bookkeeping never breaks playback */
      }
      // Heard now: nothing may cut it. Size the safety net to what's left of the clip at this rate.
      const markPlaying = () => {
        if (gen !== voiceGeneration || !currentLine) return
        // iOS can reset the rate once metadata loads: put the voice's speed back before timing the clip
        if (Math.abs(el.playbackRate - wantRate) > 0.01) el.playbackRate = wantRate
        const now = performance.now()
        currentLine.audible = true
        currentLine.endsAt = clipEndsAt(now, el.duration, el.playbackRate, el.duration - el.currentTime)
        clearVoiceSafety()
        const left = currentLine.endsAt ? currentLine.endsAt - now : 20000
        voiceSafetyTimer = window.setTimeout(() => releaseVoice(gen), left + 2500)
      }
      markPlaying()
      el.onloadedmetadata = markPlaying
      const done = () => releaseVoice(gen)
      // 9.30-k: heard = finished or 70% played; counted once per play
      let counted = false
      const countHeard = () => {
        if (counted) return
        counted = true
        el.ontimeupdate = null
        try {
          voiceHeardListener?.(clipId)
        } catch {
          /* the heard log never breaks playback */
        }
      }
      el.ontimeupdate = () => {
        if (gen !== voiceGeneration) {
          el.ontimeupdate = null
          return
        }
        if (heardEnough(el.currentTime, el.duration)) countHeard()
      }
      el.onended = () => {
        countHeard()
        done()
      }
      el.onerror = done
      // Paused by the OS/browser (call, tab hidden…) — free the channel
      el.onpause = () => {
        if (gen === voiceGeneration && el.paused && !el.ended) {
          if (heardEnough(el.currentTime, el.duration)) countHeard()
          done()
        }
      }
      if (el.ended) {
        countHeard()
        done()
      }
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
