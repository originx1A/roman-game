#!/usr/bin/env python3
"""Generate voices — PLAIN text only (never SSML-as-text; that made Jenny read markup aloud)."""
from __future__ import annotations

import asyncio
import json
import subprocess
import tempfile
import pathlib
import sys

try:
    import edge_tts
except ImportError:
    print("edge_tts missing", file=sys.stderr)
    sys.exit(1)

OUT = pathlib.Path(__file__).resolve().parents[1] / "public" / "voices"
OUT.mkdir(parents=True, exist_ok=True)

ROMAN_VOICE = "en-US-BrianNeural"
COACH_VOICE = "en-US-JennyNeural"
GIGGLE_VOICE = "en-US-JennyNeural"

# Old-timer heckler: deeper, older, a little rough. Slower + lower, then a light rasp in ffmpeg
# (parallel soft-clip grit, gentle low-pass, slight age wobble, small room), loudness-matched.
OLDTIMER_VOICE = "en-AU-WilliamMultilingualNeural"
OLDTIMER_RATE = "-20%"
OLDTIMER_PITCH = "-16Hz"
OLDTIMER_POST = "rasp-v1"
RASP_FILTER = (
    "[0:a]aresample=48000,highpass=f=75,asplit=2[dry][wet];"
    "[wet]volume=10dB,asoftclip=type=tanh,highpass=f=300,lowpass=f=3200,volume=-13dB[grit];"
    "[dry][grit]amix=inputs=2:weights=1 0.6:normalize=0,"
    "vibrato=f=4.8:d=0.035,"
    "lowpass=f=6800,"
    "aecho=0.88:0.5:17|34:0.09|0.05,"
    "acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2,"
    "loudnorm=I=-19.5:TP=-3:LRA=7,"
    "aresample=24000"
)

ROMAN_LINES = {
    "roman_record_best": "Roman says: new record! Somebody write that down!",
    "roman_record_faster": "Roman says: faster than ever. I've got goosebumps!",
    "roman_record_beat": "Roman says: you just beat your own best. Show-off!",
    "roman_nearmiss": "Roman says: so close! Roman felt that one.",
    "roman_trial_clear": "Roman says: you survived Roman's Trial! Double coins!",
    "roman_daily_done": "Roman says: daily challenge, done! See you tomorrow.",
    "roman_awesome": "Roman says: you are awesome!",
    "roman_legend": "Roman says: absolute legend!",
    "roman_highfive": "Roman says: high five, puzzle champ!",
    "roman_win": "Roman wins! Confetti in my hair!",
    "roman_brain": "Roman's brain: big. Your move: bigger.",
    "roman_boss": "Roman says: I am the puzzle boss.",
    "roman_sparkle": "Roman says: sparkle mode unlocked!",
    "roman_proud": "Roman says: I'm proud of that move!",
    "roman_clutch": "Roman says: clutch! That was clean!",
    "roman_smooth": "Roman says: smooth operator!",
    "roman_cheer": "Roman says: yes! Keep that energy!",
    "roman_cook": "Roman says: you cooked that board!",
    "roman_critter": "Roman says: you caught the spark critter!",
    "roman_stash": "Roman says: critter stash complete! Big bonus!",
    "roman_prize": "Roman says: prize time, baby!",
    "roman_hint": "Roman whispers: try over there.",
    "roman_nudge": "Roman says: trust the empty square.",
    "roman_close": "Personal space! Even buddies need it.",
    "roman_oops": "Whoops! That was a spicy miss.",
    "roman_bonk": "Roman says: bonk. Try a different square.",
    "roman_nope": "Roman says: nope-a-dope. Not that one.",
    "roman_silly": "Roman says: silly goose move. Shake it off!",
    "roman_brainfart": "Roman says: tiny brain fart. You're fine.",
    "roman_retry": "Roman says: plot twist — try again!",
    "roman_hearts": "Roman says: hearts down, spirit up. Rematch!",
    "roman_colorblind": "Roman says: are you color blind? That color's taken!",
    "roman_samecolor": "Roman says: same color club is full!",
    "roman_rowmate": "Roman says: that row already has a roommate!",
    "roman_coltaken": "Roman says: that column's booked!",
    "roman_cuddle": "Roman says: no cuddling — even corners count!",
    "roman_highhopes": "Roman says: I had high hopes for you. Bummer.",
    "roman_cantwin": "Roman says: well, you can't win them all.",
    "roman_trying": "Roman says: are you even trying?",
    "roman_stillbetter": "Roman says: you did great — but I'm still better.",
    "roman_skillissue": "Roman says: skill issue. Shake it off!",
    "roman_warmup": "Roman says: that was your warm-up, right?",
    "roman_almost": "Roman says: so close… and yet so Roman.",
    "roman_sleeping": "Roman says: did you fall asleep mid-tap?",
    "roman_practice": "Roman says: practice more — then challenge me.",
    "roman_myboard": "Roman says: nice try. Still my board though.",
    "roman_sandwich": "Roman says: did anyone see where I left my sandwich?",
    "roman_itchy": "Roman says: my butt is itchy. Anyway — you won!",
    "roman_plotwin": "Roman says: plot twist — you actually did it!",
    "roman_okayfine": "Roman says: okay fine. That one was pretty good.",
    "roman_cocky": "Roman says: don't get cocky. I'm still watching.",
    "roman_sock": "Roman says: who took my other sock?",
    "roman_taco": "Roman says: cool cool. Now where are the tacos?",
    "roman_juice": "Roman says: victory! Also — juice box, please.",
    "roman_dino": "Roman says: I was thinking about dinosaurs the whole time.",
    "roman_nugget": "Roman says: this win smells like chicken nuggets.",
    "roman_shoe": "Roman says: hang on — I lost a shoe under the couch.",
    "roman_potato": "Roman says: potato. That's the whole comment.",
    "roman_sneeze": "Roman says: achoo! You still won though.",
    "roman_fridge": "Roman says: I was talking to the fridge. It gets me.",
    "roman_nap": "Roman says: nap time. You earned it. I earned it more.",
    "roman_spaghetti": "Roman says: there's spaghetti on the ceiling. Not sorry.",
    "roman_raccoon": "Roman says: a raccoon stole my strategy. Still won vibes.",
    "roman_shrug": "Roman says: shrug. Magic. Next board.",
    "roman_dance": "Roman says: I'm doing a tiny victory dance with my eyebrows.",
    "roman_forgot": "Roman says: wait — what were we talking about?",
    "roman_toes": "Roman says: my toes are freezing. Celebrate harder.",
    "roman_eyeballs": "Roman says: I beat that with my eyeballs closed. Mostly.",
    "roman_victoryburp": "Roman says: quiet victory burp. Excuse Roman.",
    "roman_highfiveself": "Roman says: high five to myself. You can watch.",
    "roman_broccoli": "Roman says: broccoli power. You cleared that board!",
    "roman_pickle": "Roman says: pickle me proud. That was crisp!",
    "roman_banana": "Roman says: banana split victory. You did it!",
    "roman_cheese": "Roman says: extra cheese on that win. Delicious!",
    "roman_pants": "Roman says: I put on my fancy pants for this win!",
    "roman_booger": "Roman says: booger face, champion heart!",
    "roman_lizard": "Roman says: a tiny lizard just clapped for you!",
    "roman_ghost": "Roman says: boo! Just kidding. You won!",
    "roman_unicorn": "Roman says: unicorn sparkles. That move was magic!",
    "roman_worm": "Roman says: even the worm is doing a happy wiggle!",
    "roman_trumpet": "Roman says: toot toot! Victory trumpet!",
    "roman_bubblegum": "Roman says: bubblegum pop. Sticky sweet win!",
    "roman_helicopter": "Roman says: helicopter hair. We are taking off!",
    "roman_underpants": "Roman says: superhero underpants. Cape not included!",
    "roman_moonwalk": "Roman says: moonwalk across the board. Smooth!",
    "roman_idle_hello": "Roman says: hello? The board is getting lonely.",
    "roman_idle_century": "Roman says: any century now.",
    "roman_idle_sandwich": "Roman says: I could eat a sandwich while I wait.",
    "roman_idle_blink": "Roman says: blink twice if you are still there.",
    "roman_idle_loading": "Roman says: still loading your next move.",
    "roman_idle_admire": "Roman says: I am admiring this empty square.",
    "roman_idle_sphinx": "Roman says: the sphinx is less patient than me.",
    "roman_idle_snore": "Roman says: zzz. Wake me when you tap.",
    "roman_wrong_bold": "Roman says: bold move. Wrong square.",
    "roman_wrong_complaint": "Roman says: I filed a tiny complaint about that tap.",
    "roman_wrong_oof": "Roman says: oof. That one bounced off.",
    "roman_wrong_politely": "Roman says: politely, that spot is a no.",
    "roman_wrong_grandma": "Roman says: even my grandma would skip that square.",
    "roman_wrong_wifi": "Roman says: that move has no signal.",
    "roman_wrong_drama": "Roman says: the drama. The miss. The heart.",
    "roman_wrong_trophy": "Roman says: no trophy for that square.",
    # Roman lines for moments that used to be coach-only (lose / hint / badge / prize spin / critter stash)
    "roman_lose_nap": "Roman says: out of hearts. Even legends need a nap.",
    "roman_lose_fought": "Roman says: that board fought back. Rematch?",
    "roman_lose_snacks": "Roman says: hearts empty, snack bowl full. Try again!",
    "roman_lose_round": "Roman says: the board wins this round. Not the war.",
    "roman_hint_psst": "Roman says: psst. Look over there.",
    "roman_hint_secret": "Roman says: I didn't tell you this, but try that square.",
    "roman_hint_clue": "Roman says: tiny clue. Big brain.",
    "roman_badge_shiny": "Roman says: new badge! So shiny!",
    "roman_badge_fridge": "Roman says: badge unlocked. Put it on the fridge!",
    "roman_badge_wear": "Roman says: ooh, a badge. Can I wear it?",
    "roman_badge_impressed": "Roman says: badge get! Roman is impressed.",
    "roman_spin_spoken": "Roman says: the wheel has spoken!",
    "roman_spin_ooh": "Roman says: ooh! What did you get?",
    "roman_spin_lucky": "Roman says: lucky spin! Roman approves.",
    "roman_stash_party": "Roman says: five sparks! Sparkle party!",
    "roman_stash_jazz": "Roman says: critter stash! Roman is doing jazz hands.",
    # 9.27-a: more lines for the busiest categories
    "roman_hint_wink": 'Roman says: wink wink. That square.',
    "roman_hint_spy": 'Roman says: my spy eyes see a clue.',
    "roman_hint_treasure": 'Roman says: X marks the spot. Well, kinda.',
    "roman_lose_cape": 'Roman says: capes off. Try again!',
    "roman_lose_shake": 'Roman says: shake it off, puzzle pal. Next round!',
    "roman_lose_pillow": "Roman says: I'm screaming into a pillow. Rematch?",
    # 9.30-g: approved voice-tip lines + combined not-best lines (voice-tips-draft.md)
    "tip_stall_roman_clock": "Roman says: the clock is still running. Roman checked. Twice.",
    "tip_stall_roman_combo": "Roman says: every second you think, your combo takes a nap.",
    "tip_stall_roman_beg": "Roman says: tap something. Anything. Roman is begging politely.",
    "tip_undo_roman_count": "Roman says: every undo costs twenty-five points. Roman is counting. Roman is always counting.",
    "tip_undo_roman_sock": "Roman says: undo, undo, undo. Your score is shrinking like a wool sock.",
    "tip_undo_roman_rules": "Roman says: three undos? No three stars for you. Roman's rules.",
    "tip_star_roman_time": "Roman says: two stars? Cute. Beat the target time and bring me three.",
    "tip_star_roman_recipe": "Roman says: no undos, fast time, big score. That's the three-star recipe. Roman wrote it.",
    "tip_star_roman_combo": "Roman says: faster moves build a combo. Combo builds score. Score builds Roman's respect.",
    "tip_star_roman_trial": "Roman says: three stars unlocks Roman's Trial. Roman's waiting. Roman is always waiting.",
    "tip_stuck_roman_shiny": "Roman says: the hint button is right there. It's shiny. Press it.",
    "tip_stuck_roman_1987": "Roman says: even Roman uses a hint sometimes. Once. In 1987.",
    "tip_stuck_roman_row": "Roman says: stuck? Look for a row with only one spot left.",
    "tip_trial_roman_welcome": "Roman says: welcome to Roman's Trial. Two hearts, no undo, and a clock. Roman is not sorry.",
    "tip_trial_roman_coins": "Roman says: beat the clock and you get double coins. Lose, and Roman laughs. Gently.",
    "tip_daily_roman_first": "Roman says: it's the Daily Challenge. Everybody gets this board today. Only your first try counts.",
    "tip_daily_roman_streak": "Roman says: win today, win tomorrow, and your streak grows. Like Roman's ego.",
    "roman_notbest_record": "Roman says: board cleared! Your record just yawned, though.",
    "roman_notbest_again": "Roman says: winner! Not your fastest. Roman noticed. Roman always notices.",
    "roman_notbest_turtle": "Roman says: you did it, turtle-style! Your best time says hi.",
}

# Uplifting coach — plain phrases only (slightly brighter rate/pitch)
COACH_LINES = {
    "nice": "Nice!",
    "solid": "Solid!",
    "good_call": "Good call!",
    "that_works": "That works!",
    "clean": "Clean!",
    "cleared": "You cleared it!",
    "board_complete": "Board complete. Nice work!",
    "prize_time": "Prize time!",
    "new_badge": "New badge unlocked!",
    "nudge": "Here's a nudge!",
    "too_close": "Too close. Buddies need space.",
    "row_taken": "That row is already taken.",
    "region_full": "That region already has one.",
    "nope": "Nope. Try another spot.",
    "out_of_hearts": "Out of hearts. Rematch?",
    "tough_board": "Tough board. Try again.",
    "cosmic": "Cosmic void. Starlit mystery.",
    "ruins": "Ancient ruins. Forgotten stone.",
    "neon": "Neon night. Electric streets.",
    "ocean": "Ocean deep. Abyss glow.",
    "ember": "Ember peak. Molten heat.",
    "crystal": "Crystal cave. Prism hush.",
    # Spark progress (female coach)
    "spark_1": "One sparkle so far. Four more for the bonus!",
    "spark_2": "Two sparkles. Three more for the bonus!",
    "spark_3": "Three sparkles. Two more for the bonus!",
    "spark_4": "Four sparkles. Just one more for the bonus!",
    "spark_unlocked": "Sparkle mode unlocked!",
    "spark_have_1": "You've got one sparkle toward the bonus.",
    "spark_have_2": "You've got two sparkles toward the bonus.",
    "spark_have_3": "You've got three sparkles toward the bonus.",
    "spark_have_4": "You've got four sparkles. So close!",
    # 9.27-a: more lines for the busiest categories
    "coach_hint_look": 'Take a look here.',
    "coach_hint_help": "Here's a little help.",
    "coach_hint_glow": 'Follow the glow!',
    "coach_hint_clue": 'This square is your clue.',
    "coach_hint_peek": 'Peek at this one.',
    "coach_hint_step": 'One step closer!',
    "coach_hint_try": 'Try this spot.',
    "coach_lose_breathe": "Deep breath. You've got this.",
    "coach_lose_again": 'So close! Go again?',
    "coach_lose_next": 'That one was tricky. Next time!',
    "coach_prize_ooh": 'Ooh, a prize!',
    "coach_prize_see": "Let's see what you got!",
    "coach_badge_earned": 'Badge earned. Well done!',
    "coach_badge_look": 'Look at that shiny badge!',
    # 9.30-g: approved voice-tip lines + combined not-best lines (voice-tips-draft.md)
    "tip_stall_coach_combo": "Quick moves keep your combo alive. Even a little X counts!",
    "tip_stall_coach_marks": "Stuck? Mark the squares that can't have a buddy. It opens things up.",
    "tip_stall_coach_fewest": "Try the row or region with the fewest open squares first.",
    "tip_undo_coach_cost": "Heads up: each undo costs 25 points and resets your combo.",
    "tip_undo_coach_stars": "Want three stars? Finish without any undos. Take a breath before you tap.",
    "tip_undo_coach_marks": "Try marking X's first. They're safer than guessing a buddy.",
    "tip_star_coach_time": "So close to three stars! Beat the target time on the start screen.",
    "tip_star_coach_undo": "Three stars means zero undos. Plan your moves, then tap.",
    "tip_star_coach_score": "For three stars you need a high score too. Keep the combo going with quick, clean moves.",
    "tip_star_coach_card": "Tap the level card to see what you need for three stars.",
    "tip_stuck_coach_hint": "Feeling stuck? The Hint button lights up a safe square.",
    "tip_stuck_coach_region": "Look for a region that fits in one row. Its buddy has to go there.",
    "tip_stuck_coach_learn": "Try a hint. It's not cheating, it's learning!",
    "tip_trial_coach_rules": "This is the Trial: race the clock, two hearts, no undo. You've got this!",
    "tip_trial_coach_marks": "Tip: X's are free, and they never cost a heart. Use them.",
    "tip_daily_coach_careful": "Daily Challenge! Only one try counts, so take your time.",
    "tip_daily_coach_streak": "Come back every day to build your streak and earn more coins.",
    "coach_notbest_clear": "Board cleared. A little slower than your best. You know you have more in you.",
    "coach_notbest_close": "Nice finish. Not a new best this time, but the next one could be.",
}

OLDTIMER_LINES = {
    "old_record_head": "New record, huh. Don't let it go to your head.",
    "old_record_tea": "Faster than last time. I nearly spilled my tea.",
    "old_nearmiss": "Almost. Almost doesn't win a medal.",
    # wrong move
    "old_wrong_stick": "Back in my day we solved these with a stick. And we were faster.",
    "old_wrong_pigeon": "Even a pigeon would've skipped that square. A pigeon!",
    "old_wrong_love": "Nope. And I say that with all the love I have left.",
    "old_wrong_choice": "That's a choice. Not a good one, but a choice.",
    "old_wrong_money": "You tapped that like it owed you money.",
    "old_wrong_tea": "Wrong. I'd explain why, but my tea's getting cold.",
    "old_wrong_chaos": "Oh sure, put it there. Why not. Chaos is free.",
    "old_wrong_knees": "My knees make better decisions than that. And they're sixty years old.",
    "old_wrong_personal": "Did the board do something to you? That felt personal.",
    "old_wrong_close": "Close. Well, no. Not close at all, actually.",
    "old_wrong_again": "Ha! Classic. Do it again, I missed it.",
    "old_wrong_refund": "That buddy wants a refund.",
    "old_wrong_nickel": "In my day a wrong move cost you a nickel. You'd be broke by now.",
    "old_wrong_teacher": "Somewhere, a puzzle teacher just felt a chill.",
    "old_wrong_loudly": "I'm not saying it's wrong. The board is saying it's wrong. Loudly.",
    # idle / slow
    "old_idle_twenty": "Take your time. I've got maybe twenty years left.",
    "old_idle_crossword": "I started a crossword while I wait. It's going better.",
    "old_idle_kettle": "Should I put the kettle on? Feels like a two-kettle puzzle.",
    "old_idle_nap": "Wake me up when you've got a move. I'll be snoozing.",
    "old_idle_glacier": "I've seen glaciers with more hustle.",
    "old_idle_younger": "Any day now. I'm not getting any younger.",
    "old_idle_gossip": "Still thinking? The squares are starting to gossip.",
    # hint
    "old_hint_stare": "A hint? In my day we just stared at it until it gave up.",
    "old_hint_tell": "Go on, take the hint. I won't tell anyone. I'll tell everyone.",
    "old_hint_wheels": "Ah, the training wheels. Classic.",
    "old_hint_push": "A hint, huh. Fine. Every legend needs a little push.",
    "old_hint_smart": "Asking for help already? Smart. Sad, but smart.",
    # undo / redo spam
    "old_undo_hokey": "Undo, redo, undo. You're doing the hokey pokey.",
    "old_undo_dizzy": "Make up your mind! The board's getting dizzy.",
    "old_undo_rocking": "Back and forth, back and forth. Are you solving, or rocking in a chair?",
    "old_undo_vacation": "That undo button's gonna need a vacation.",
    # lose
    "old_lose_tape": "Out of hearts. I'd lend you one, but mine runs on duct tape.",
    "old_lose_goldfish": "Game over. Even my goldfish saw that coming.",
    "old_lose_sideways": "Well, that went sideways. Dust yourself off, kiddo.",
    "old_lose_popcorn": "And that's the ballgame. Rematch? I'll get my popcorn.",
    # sloppy / slow win (backhanded)
    "old_win_eventually": "You won. Eventually. I'll allow it.",
    "old_win_ugly": "A win's a win. Even an ugly one.",
    "old_win_paint": "That was like watching paint dry. But with a happy ending.",
    "old_win_yesterday": "Done already? Oh wait, you started yesterday. Nice.",
    "old_win_gaveup": "Well, look at that. The board gave up before you did.",
    # rescue purchase
    "old_rescue_modern": "Buying your way out of trouble? Very modern.",
    "old_rescue_refund": "Rescue, huh. Nothing says confidence like a refund.",
    "old_rescue_coins": "Coins well spent. That buddy was a disaster.",
    "old_rescue_cat": "Rescued! Like a cat from a tree. A very confused cat.",
    # offhand asides — nothing to do with the move
    "old_aside_smell": "I smell something funny. Was that you?",
    "old_aside_heat": "Who turned the heat up in here?",
    "old_aside_glasses": "Did somebody move my glasses?",
    "old_aside_stove": "Hold on, I think I left the stove on.",
    "old_aside_tuesday": "Is it Tuesday? Feels like a Tuesday.",
    "old_aside_tea": "My tea's gone cold again. Story of my life.",
    "old_aside_knees": "My knees just predicted rain. They're never wrong.",
    "old_aside_remote": "Where'd I put the remote? Don't you move, I'm still talking.",
    "old_aside_cat": "The cat's on the board again. Mentally. She's very judgmental.",
    "old_aside_socks": "One sock's missing. I blame the squares.",
    # friendly jabs
    "old_jab_mitts": "You play like you're wearing oven mitts.",
    "old_jab_bingo": "I've seen better moves at a bingo hall.",
    "old_jab_phone": "Is this your first time holding a phone?",
    "old_jab_backday": "Back in my day we didn't tap. We committed.",
    "old_jab_buddy": "That buddy looks as confused as you do.",
    "old_jab_square": "Pick a square, any square. Preferably a different one.",
    "old_jab_thinking": "I can hear you thinking. It's very quiet.",
    "old_jab_patience": "I've got patience. You've got... something else.",
    "old_jab_map": "You need a map for a five-by-five? Bless your heart.",
    "old_jab_shoes": "Tie your shoes and try that square again.",
    # grudging praise for a correct move
    "old_good_fine": "Fine. That one was fine. Don't get excited.",
    "old_good_accident": "A correct buddy. I'll assume it was an accident.",
    "old_good_tea": "Not bad. I'll allow a sip of tea.",
    "old_good_knees": "My knees approve. High praise, from them.",
    "old_good_once": "You got one right. Write it down, it might not happen again.",
    "old_good_square": "That square can stay. The rest of them are still nervous.",
    "old_good_grumble": "Hmm. Adequate. That's the nicest word I've got.",
    "old_good_day": "Back in my day that would've been a Tuesday. Still, not terrible.",
    # 9.27-a: more lines for the busiest categories
    "old_wrong_toaster": "I've seen a toaster make smarter choices.",
    "old_wrong_bold": 'Bold. Wrong, but bold. Mostly wrong.',
    "old_wrong_hallway": "You'd get lost in a hallway, wouldn't you?",
    "old_wrong_history": "That move's going in the history books. Under 'don't'.",
    "old_wrong_spectacles": "Put your glasses on. Oh, you don't wear any? There's your problem.",
    "old_good_clock": 'Even a broken clock is right twice a day.',
    "old_good_surprised": "Well, would you look at that. I'm surprised too.",
    "old_good_lucky": "Lucky tap. Don't let it go to your head.",
    "old_good_clap": "Don't expect me to clap. My hands are cold.",
    "old_hint_flashlight": 'A hint? Want a map and a flashlight too?',
    "old_hint_grandkid": "My grandkid asks for hints. He's four.",
    "old_hint_cane": 'Lean on that hint. I lean on a cane. We all need something.',
    "old_hint_cheating": 'Back in my day we called that cheating.',
    "old_undo_face": "Undo all you like. You can't undo that face you're making.",
    "old_undo_yoyo": "Up, down, back, forth. You're a yo-yo.",
    "old_undo_regret": 'So much regret for one little square.',
    "old_undo_aging": "Pick one! I'm aging over here.",
    "old_undo_eraser": "You'd wear out an eraser in a day.",
    "old_win_squirrel": "A blindfolded squirrel would've been quicker. But fine, you won.",
    "old_win_frame": 'Frame it. It might not happen again.',
    "old_win_napped": 'Congratulations. I only napped twice.',
    "old_win_twothree": "Messy. Slow. Victorious. I'll take one out of three.",
    "old_lose_called": 'Called it. I called it at the first square.',
    "old_lose_sandwich": 'Hearts gone. Go have a sandwich and think about what you did.',
    "old_lose_nephew": "My nephew lost like that once. He's a lawyer now. Worked out fine.",
    "old_lose_deal": "Fold 'em, kiddo. Deal again.",
    "old_idle_mail": 'The mail came faster than your next move.',
    "old_idle_beard": 'I grew a beard waiting for that. Look at it.',
    "old_idle_birthday": "Hurry up. I'd like to finish before my birthday.",
    "old_aside_humming": "Is that my radio? No? Then who's humming?",
    "old_aside_pigeons": 'The pigeons out back are plotting something. I can feel it.',
    "old_rescue_lifeguard": "Somebody call a lifeguard. You're drowning in squares.",
    "old_rescue_parachute": 'Nice parachute. Shame about the landing.',
    # 9.30-g: approved voice-tip lines + combined not-best lines (voice-tips-draft.md)
    "tip_stall_old_combo": "Your combo died of old age. And I'd know about old age.",
    "tip_stall_old_timer": "The timer doesn't stop for thinking, kiddo. Neither do I. Well, I do. Often.",
    "tip_stall_old_free": "Put an X somewhere. X's are free. Unlike my patience.",
    "tip_undo_old_prices": "Twenty-five points a pop. At these prices I'd think before I tapped.",
    "tip_undo_old_rent": "Undo again and I'm charging you rent on that button.",
    "tip_undo_old_crying": "Back in my day we had one undo. It was called crying.",
    "tip_star_old_time": "You finished. So did the ice age. Faster next time for the third star.",
    "tip_star_old_barber": "The third star doesn't like undos. Neither does my barber.",
    "tip_star_old_coffee": "Score's too low for the third star. Try moving like you've had coffee.",
    "tip_star_old_motel": "Two stars. Like a motel. Go get the third.",
    "tip_stuck_old_complaint": "You've been staring so long the squares filed a complaint. Try the hint.",
    "tip_stuck_old_knees": "Hint button. Bottom of the screen. I'd press it for you, but my knees.",
    "tip_stuck_old_pride": "Pride's nice. Hints are faster.",
    "tip_trial_old_life": "No undo button in here. Welcome to how life works.",
    "tip_trial_old_doctor": "Two hearts and a timer. I've had doctor's appointments like this.",
    "tip_daily_old_parking": "One shot, kiddo. No do-overs. Like parking at the grocery store.",
    "tip_daily_old_glasses": "Daily puzzle. I do one every day too. It's called finding my glasses.",
    "old_notbest_tsk": "Board's clear... but slower than last time. Tsk.",
    "old_notbest_yesterday": "You won. Your old self still beat you, though. He's smug about it.",
    "old_notbest_rerun": "Same board, slower time. Like a rerun, but longer.",
    "old_notbest_ghost": "Done, sure. Your ghost finished first and went home.",
    "old_notbest_calendar": "Nice clear. Your best time is over there, waving. From far away.",
    "old_notbest_knees": "Cleared it. Slower than before, and I know slow. Ask my knees.",
    "old_notbest_tea": "You won. I finished a whole cup of tea. Last time I only got a sip.",
    "old_notbest_downhill": "A win, but slower than your record. It's all downhill from here, kid.",
    "old_notbest_slowpoke": "Board's done. Your record's safe. From you, mostly.",
}

# Which voice/settings produced each clip in public/voices (checked by scripts/check-voices.ts)
MANIFEST_PATH = pathlib.Path(__file__).resolve().parent / "voice-manifest.json"
MANIFEST: dict = json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}

GIGGLE_LINES = {
    "buddy_giggle_1": "hee hee hee!",
    "buddy_giggle_2": "ha ha! hee!",
    "buddy_giggle_3": "tee hee!",
}


async def save(voice: str, text: str, path: pathlib.Path, rate: str = "+0%", pitch: str = "+0Hz") -> None:
    # Guard: never synthesize markup/code
    if "<" in text or "xmlns" in text or "function" in text:
        raise ValueError(f"refusing to speak code-like text for {path.name}")
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await communicate.save(str(path))
    MANIFEST[path.stem] = {"voice": voice, "rate": rate, "pitch": pitch, "text": text}
    print(f"wrote {path.name} ({path.stat().st_size} bytes)")


async def save_oldtimer(text: str, path: pathlib.Path) -> None:
    """Old-timer clip: TTS to a temp file, then the rasp filter into public/voices."""
    with tempfile.TemporaryDirectory() as tmp:
        raw = pathlib.Path(tmp) / "raw.mp3"
        await save(OLDTIMER_VOICE, text, raw, rate=OLDTIMER_RATE, pitch=OLDTIMER_PITCH)
        MANIFEST.pop("raw", None)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter_complex", RASP_FILTER,
             "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", str(path)],
            check=True,
        )
    MANIFEST[path.stem] = {"voice": OLDTIMER_VOICE, "rate": OLDTIMER_RATE, "pitch": OLDTIMER_PITCH,
                           "post": OLDTIMER_POST, "text": text}
    print(f"wrote {path.name} ({path.stat().st_size} bytes, rasp)")


async def main() -> None:
    only = set(sys.argv[1:])  # optional: python generate-voices.py roman_sock roman_taco …
    roman_items = [(n, t) for n, t in ROMAN_LINES.items() if not only or n in only or n.replace("roman_", "") in only]
    coach_items = [(n, t) for n, t in COACH_LINES.items() if not only or n in only]
    giggle_items = [(n, t) for n, t in GIGGLE_LINES.items() if not only or n in only]
    old_items = [(n, t) for n, t in OLDTIMER_LINES.items() if not only or n in only]
    # If filtering to roman_* ids, skip coach/giggle unless explicitly named
    if only and all(x.startswith("roman_") or x in ROMAN_LINES for x in only):
        coach_items = []
        giggle_items = []
        if not roman_items:
            roman_items = [(n, t) for n, t in ROMAN_LINES.items() if n in only]

    for name, text in roman_items:
        # Same Brian voice as the clips already in public/voices.
        await save(ROMAN_VOICE, text, OUT / f"{name}.mp3", rate="-8%", pitch="-6Hz")

    for name, text in coach_items:
        # Brighter, more uplifting coach — still natural human speech
        await save(COACH_VOICE, text, OUT / f"{name}.mp3", rate="+10%", pitch="+6Hz")

    for name, text in old_items:
        await save_oldtimer(text, OUT / f"{name}.mp3")

    for name, text in giggle_items:
        await save(GIGGLE_VOICE, text, OUT / f"{name}.mp3", rate="+18%", pitch="+22Hz")

    MANIFEST_PATH.write_text(json.dumps(dict(sorted(MANIFEST.items())), indent=2) + "\n")
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
