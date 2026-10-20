# Missing Unseen voice lines

These sayings are wired up. The game shows the words and stays silent until a recording exists.

Each line has a clip id. Put the file at `public/voices/<id>.mp3`, then add that id to `VOICE_LINES` in `src/game/voiceLines.ts` (the value is `/voices/<id>.mp3`). `playReminderLine` will use the catalog clip. If the mp3 is already in `public/voices` and not in the catalog yet, the Home reminder still plays that file.

No audio files for these lines were in the project when this list was written.

## old_remind_pets

Your buddy's looking a bit peaky. Go look in on the Stable. They might need a treat.

## old_remind_signin

You keep winning and then leaving it on this phone. Sign in, and the scores come with you. No password. I'm not carrying them.

## old_remind_coins

That coin pile is getting smug. Spend some. The Stable sells treats and buddies. Rewards will take the rest.

## old_remind_daily

Today's Daily is still sitting there. I checked. It hasn't done itself.

## old_remind_remix

New Remix boards. Every three days, like clockwork. Go on, before I solve them out of boredom.

## old_remind_streak

That streak of yours is hanging by a thread. One Daily today and it lives. I'm not saying I'm worried. I'm saying the fire is.

## Computer versions

Phones and tablets keep the phone wording. A computer is a fine pointer on a window at least 900px wide (`(pointer: fine)` and not `(pointer: coarse)`). Anything else, including a device we cannot read, keeps the phone line. The user agent is not used.

### old_jab_phone

The phone and tablet recording is already in the game (`public/voices/old_jab_phone.mp3`). It says: Is this your first time holding a phone?

On a computer that recording does not play. The line on screen is:

Have you ever used a computer before?

The computer version needs a recording. Until that file exists, computers show the words and stay silent.

### old_remind_signin

The phone wording is listed above and has no audio yet. On a computer the words are:

You keep winning and then leaving it on this computer. Sign in, and the scores come with you. No password. I'm not carrying them.

The computer version needs a recording too. Do not play the phone recording on a computer.
