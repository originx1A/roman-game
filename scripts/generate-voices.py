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
}

OLDTIMER_LINES = {
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
