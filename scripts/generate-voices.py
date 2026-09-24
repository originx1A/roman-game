#!/usr/bin/env python3
"""Generate voices — PLAIN text only (never SSML-as-text; that made Jenny read markup aloud)."""
from __future__ import annotations

import asyncio
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
    print(f"wrote {path.name} ({path.stat().st_size} bytes)")


async def main() -> None:
    for name, text in ROMAN_LINES.items():
        await save(ROMAN_VOICE, text, OUT / f"{name}.mp3", rate="+4%", pitch="+0Hz")

    for name, text in COACH_LINES.items():
        # Brighter, more uplifting coach — still natural human speech
        await save(COACH_VOICE, text, OUT / f"{name}.mp3", rate="+10%", pitch="+6Hz")

    for name, text in GIGGLE_LINES.items():
        await save(GIGGLE_VOICE, text, OUT / f"{name}.mp3", rate="+18%", pitch="+22Hz")

    print("done")


if __name__ == "__main__":
    asyncio.run(main())
