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
    # 9.30-i: approved thin-pool lines (voice-lines-draft-2.md)
    "roman_record_fireworks": "Roman says: new best time! Cue the fireworks!",
    "roman_record_clock": "Roman says: the clock can't even keep up with you!",
    "roman_record_fridge": "Roman says: new record! That's going on the fridge.",
    "roman_record_zoom": "Roman says: zoom! You just beat your old self.",
    "roman_record_notes": "Roman says: record smashed. Roman is taking notes.",
    "roman_record_socks": "Roman says: new record! You knocked my socks off. Both of them.",
    "roman_trial_shocked": "Roman says: you beat Roman's Trial! Roman is shocked. Shocked!",
    "roman_trial_coins": "Roman says: Trial cleared! Double coins, coming right up.",
    "roman_trial_unfair": "Roman says: you beat the clock AND my Trial. Not fair!",
    "roman_trial_crown": "Roman says: Trial champion! Roman will make you a paper crown.",
    "roman_trial_harder": "Roman says: you survived! Roman needs a harder Trial.",
    "roman_daily_streak": "Roman says: daily done! Keep that streak rolling.",
    "roman_daily_cook": "Roman says: that's today's board. Roman will cook up a new one tomorrow.",
    "roman_daily_calendar": "Roman says: daily challenge crushed! Mark the calendar.",
    "roman_daily_snack": "Roman says: daily done! Go have a snack. You earned it.",
    "roman_daily_sametime": "Roman says: done for today! Same time tomorrow?",

    # 9.30-o: approved lines (voice-lines-draft-3.md)
    "roman_wrong_hiccup": "Roman says: tiny hiccup. Tap again!",
    "roman_wrong_hat": "Roman says: that square is wearing the wrong hat.",
    "roman_wrong_bounce": "Roman says: boing! That one bounced right off.",
    "roman_wrong_cousin": "Roman says: that square is a cousin. Not the one you want.",
    "roman_wrong_marble": "Roman says: Roman lost a marble. It was that tap.",
    "roman_wrong_toast": "Roman says: that move is burnt toast. Make a new slice.",
    "roman_wrong_sneeze": "Roman says: was that a sneeze? Bless you. Try again!",
    "roman_wrong_cape": "Roman says: Roman's cape twitched. Wrong square.",
    "roman_wrong_map": "Roman says: you are holding the map upside down.",
    "roman_wrong_nearly": "Roman says: nearly! Nearly is not a square, though.",
    "roman_wrong_banana": "Roman says: you slipped on a banana. Roman saw it all.",
    "roman_wrong_clown": "Roman says: the wrong square did a little clown honk.",
    "roman_wrong_nap": "Roman says: that square is napping. Do not wake it.",
    "roman_wrong_dance": "Roman says: nice dance move. Wrong spot, though!",
    "roman_wrong_puddle": "Roman says: splash! Wrong puddle.",
    "roman_wrong_hmm": "Roman says: hmm. Roman's eyebrow went up.",
    "roman_wrong_gremlin": "Roman says: a gremlin moved your finger. Blame him.",
    "roman_wrong_shelf": "Roman says: that one goes on a different shelf.",
    "roman_wrong_chirp": "Roman says: the birds are chirping about that tap.",
    "roman_wrong_pancake": "Roman says: flat as a pancake. Flip it and try again.",
    "roman_wrong_noodle": "Roman says: your finger went full noodle.",
    "roman_wrong_nice_try": "Roman says: nice try, champion. Different square!",
    "roman_wrong_plot": "Roman says: Roman had a plan. That was not the plan.",
    "roman_wrong_mirror": "Roman says: even the mirror said no.",
    "roman_wrong_hop": "Roman says: hop over to another square.",
    "roman_wrong_wobble": "Roman says: wobbly tap! Steady now.",
    "roman_wrong_ticket": "Roman says: that square wants to see a ticket.",
    "roman_wrong_gong": "Roman says: gong! Wrong.",
    "roman_wrong_sock": "Roman says: that tap is a mismatched sock.",
    "roman_wrong_detour": "Roman says: scenic detour. Now come back.",
    "roman_prize_drumroll": "Roman says: drumroll, please! Or just tap the wheel.",
    "roman_prize_jackpot": "Roman says: is it jackpot time? Roman feels jackpot.",
    "roman_prize_spin": "Roman says: spin it, champ!",
    "roman_prize_wheel": "Roman says: the wheel loves you today.",
    "roman_prize_goodies": "Roman says: goodies incoming!",
    "roman_prize_shiny": "Roman says: ooh, shiny things ahead.",
    "roman_prize_fate": "Roman says: let fate wiggle the wheel!",
    "roman_badge_trophy": "Roman says: badge time! Roman is clapping. Loudly.",
    "roman_badge_brag": "Roman says: new badge. You may brag for ten seconds.",
    "roman_badge_shelf": "Roman says: badge get! Clear a spot on the shelf.",
    "roman_badge_gold": "Roman says: badge earned. Roman calls it gold.",
    "roman_hint_shh": "Roman says: shh, look at the glowing square.",
    "roman_hint_magic": "Roman says: a little magic for you. That square.",
    "roman_hint_map": "Roman says: the treasure map says, right here.",
    "roman_hint_owl": "Roman says: a wise owl told me. That square.",
    "roman_hint_boop": "Roman says: boop! Tap that one.",
    "roman_notbest_snail": "Roman says: you won! A snail passed you on the way, but you won.",
    "roman_notbest_yawn": "Roman says: cleared it! Your best time did a big yawn.",
    "roman_record_rocket": "Roman says: new record! Was that a rocket?",
    "roman_idle_dust": "Roman says: I see dust on that square.",
    "roman_idle_tick": "Roman says: tick tock, tick tock.",
    "roman_idle_tea": "Roman says: I'll make some tea while you think.",
    "roman_idle_cloud": "Roman says: that cloud looks like a good move.",
    "roman_idle_stretch": "Roman says: time for a stretch. Then a tap.",
    "roman_undo_boomerang": "Roman says: your move is a boomerang. Back it comes.",
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
    # 9.30-i: approved thin-pool lines (voice-lines-draft-2.md)
    "coach_record_best": "New best time. Amazing work!",
    "coach_record_faster": "That's your fastest yet. Well done!",
    "coach_record_proud": "A new record! You should be proud.",
    "coach_record_practice": "New record. All that practice is paying off!",
    "coach_trial_clear": "You cleared the Trial. Double coins for you!",
    "coach_trial_clock": "You beat the clock! Great focus.",
    "coach_trial_steady": "Trial complete. Nice and steady under pressure.",
    "coach_daily_done": "Daily challenge done. See you tomorrow!",
    "coach_daily_streak": "Another day, another win. Keep the streak going!",
    "coach_daily_great": "Today's board is done. Great job!",
    "coach_notbest_stands": "Board cleared! Your best time still stands. Try again?",
    "coach_notbest_okay": "You won. A bit slower this time, and that's okay.",
    "coach_notbest_chase": "Nice clear. Your best time is still out there to chase.",
    "coach_notbest_breath": "Board done! Not quite your best. Take a breath and go again.",
    "coach_notbest_safe": "Good win. Your record's safe for now. You'll get it.",
    "coach_notbest_practice": "Cleared it. Slower than your best, but every run is practice.",
    "coach_stash_five": "All five sparks! Bonus unlocked!",
    "coach_stash_complete": "Critter stash complete. Nice catching!",
    "coach_stash_bonus": "That's the whole stash. Enjoy the bonus!",
    "coach_stash_sparkle": "Five for five! Time to sparkle.",

    # 9.30-o: approved lines (voice-lines-draft-3.md)
    "coach_wrong_touch_gap": "Give your buddies a little room. Try a square with a gap.",
    "coach_wrong_touch_corner": "Careful, buddies can't touch, even at the corners.",
    "coach_wrong_row_one": "One buddy per row and column. This one already has one.",
    "coach_wrong_region_own": "Each colour gets just one buddy, and this one has its buddy.",
    "coach_wrong_any_close": "Not quite. Look for a spot that's safe.",
    "coach_wrong_any_ok": "That's okay. Take another look.",
    "coach_prize_spin": "Give the wheel a spin!",
    "coach_prize_lucky": "Feeling lucky? Let's find out.",
    "coach_prize_reward": "You earned this reward.",
    "coach_prize_surprise": "Here comes a surprise!",
    "coach_prize_nice": "A prize for you. Nicely done!",
    "coach_badge_nice": "You earned a new badge. Great job!",
    "coach_badge_hard": "That badge took real effort.",
    "coach_badge_proud": "A shiny new badge. Be proud!",
    "coach_badge_collect": "Another one for your collection.",
    "coach_hint_light": "This square is lit for you.",
    "coach_hint_start": "Start with this one.",
    "coach_hint_safe": "This spot is a safe bet.",
    "coach_hint_point": "Here's where I'd look.",
    "coach_hint_easy": "Take this square. It's a good one.",
    "coach_notbest_again": "Good clear. Try again and go a bit faster.",
    "coach_notbest_steady": "Steady win. Your best is still within reach.",
    "coach_notbest_learning": "You're learning this board. Keep going.",
    "coach_notbest_nice_win": "Nice win! You'll beat your time soon.",
    "coach_notbest_almost": "A win is a win. Chase that best next.",
    "coach_notbest_fresh": "Cleared! One more go could be your fastest.",
    "coach_notbest_calm": "Calm and steady wins boards. Speed comes next.",
    "coach_notbest_close2": "Not your fastest, but a strong finish.",
    "coach_notbest_rhythm": "You're finding your rhythm. Go again!",
    "coach_notbest_smile": "Board cleared. Smile, you're improving.",
    "coach_notbest_bank": "Bank that win. The record is next.",
    "coach_record_fast": "New best time. Look how quick you got!",
    "coach_idle_take": "Take your time. Whenever you're ready, tap a square.",
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
    # 9.30-i: approved thin-pool lines (voice-lines-draft-2.md)
    "old_record_nap": "New record. I didn't even get to finish my nap.",
    "old_record_teeth": "Faster than ever. I almost dropped my teeth.",
    "old_record_luck": "A new best? Beginner's luck. Probably. Maybe.",
    "old_record_showoff": "New record. Back in my day we called that showing off.",
    "old_record_rocking": "That was quick. My rocking chair's still rocking.",
    "old_record_pencil": "Fine, it's a record. I'll write it down. Where'd I put my pencil?",
    "old_trial_huh": "You beat the Trial. Huh. Didn't see that coming.",
    "old_trial_candy": "Double coins, eh? Don't spend it all on candy.",
    "old_trial_complaint": "Beat the clock, did ya? The clock's filing a complaint.",
    "old_daily_paper": "Daily done. Now I can read my paper in peace.",
    "old_daily_tomorrow": "That's today's. Come back tomorrow. I'll still be here. Probably.",
    "old_daily_everyday": "Every day, huh? Even I don't show up every day.",

    # 9.30-o: approved lines (voice-lines-draft-3.md)
    "old_good_stopped": "Even a stopped clock, and so on. Go on.",
    "old_good_carry": "Fine. I'll carry your bags. Just this once.",
    "old_good_twice": "Do that twice and I'll believe it.",
    "old_good_mild": "That was mildly acceptable.",
    "old_good_bones": "My bones felt that one. In a good way.",
    "old_good_newspaper": "That belongs in the newspaper. The small print.",
    "old_good_nod": "You get a nod. Don't spend it all at once.",
    "old_good_soup": "Not bad. Almost like my soup.",
    "old_good_hat": "I'd tip my hat, but I can't find my hat.",
    "old_good_decent": "Decent. Very decent. I said decent.",
    "old_good_kid": "Not bad, kid. Don't tell your mother I said so.",
    "old_good_bench": "I'll save you a spot on the bench for that one.",
    "old_good_radio": "That was smoother than my radio.",
    "old_good_cardigan": "That deserves a warm cardigan.",
    "old_good_bingo": "I haven't seen a move like that since bingo night.",
    "old_good_porch": "Sit on the porch with that one. You've earned it.",
    "old_good_gravy": "That's gravy. Thin gravy, but gravy.",
    "old_good_whistle": "I'd whistle, but my teeth are in the other room.",
    "old_good_rare": "A right answer. Rarer than a quiet pigeon.",
    "old_good_blink": "Blink and I'd have missed it. Then I did.",
    "old_good_weather": "Good. Weather's clearing up.",
    "old_good_fair": "Fair enough. Fair enough.",
    "old_aside_door": "Did somebody knock? No? Must be the door thinking again.",
    "old_aside_slippers": "Where did my slippers go? They were just here.",
    "old_aside_biscuit": "I could go for a biscuit. Hard ones. Like life.",
    "old_aside_weather": "Radio says rain. Radio also says a lot of things.",
    "old_aside_lawn": "Kids on my lawn again. Mentally.",
    "old_aside_crossword": "Seven letters, starts with S. Squares.",
    "old_aside_clock": "That clock's been slow since Thursday.",
    "old_aside_neighbour": "The neighbour's dog is judging me.",
    "old_aside_mail": "Did the mail come? I'm expecting nothing, as usual.",
    "old_aside_nap": "I was resting my eyes. Not sleeping. Resting.",
    "old_aside_stairs": "Stairs got longer overnight, I swear.",
    "old_aside_phone": "Phone's ringing. Nope, that's my ears.",
    "old_aside_lemon": "Smells like lemon in here. Or is it me?",
    "old_aside_ache": "My elbow says something's coming. Could be lunch.",
    "old_aside_whistle": "Somebody's whistling. Is it me? It's me.",
    "old_hint_mapquest": "Fine, here's a hint. Don't get used to being led around.",
    "old_hint_crutch": "That hint's a crutch. Lean on it, sure.",
    "old_hint_giveup": "Hints already? I've waited longer for a bus.",
    "old_notbest_slow": "Won it. Slower than your best. Fine. Slow is my speed.",
    "old_notbest_sunday": "Nice win. Took a nice Sunday stroll, did you?",
    "old_notbest_snail": "You won. A snail sent a postcard while you thought.",
    "old_notbest_stroll": "Cleared. You took the scenic route.",
    "old_notbest_pension": "A win at a pensioner's pace. I approve, sort of.",
    "old_notbest_crawl": "Won it. Your best time is still out in front. Way out.",
    "old_undo_merry": "Round and round like a merry-go-round.",
    "old_undo_pendulum": "You swing like a pendulum. Pick a side.",
    "old_undo_sweep": "Sweeping it away and putting it back. Quite the housekeeper.",
    "old_undo_dial": "Turning that undo like a radio dial. Find a station!",
    "old_wrong_aim": "Your aim's worse than mine, and I've got cataracts.",
    "old_wrong_bird": "A pigeon would have picked better.",
    "old_wrong_sideways": "You went sideways. Squares don't go sideways.",
    "old_wrong_seat": "That square's already got a seat.",
    "old_wrong_nope": "Nope. Nope. And nope again.",
    "old_wrong_cheese": "That's the wrong cheese, kid.",
    "old_wrong_map": "You're lost. Want directions?",
    "old_wrong_cane": "I'd poke that move with my cane.",
    "old_nearmiss_close": "Close. A closer look next time.",
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
