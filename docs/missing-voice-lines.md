# Missing voice lines

Lines on the release-candidate branch that are hidden, or that show one sentence while a different recording plays, because no file says that sentence. Drop each recording at the target path. The file name is the clip id plus `.mp3`.

Nothing in this list was wired from another repo. `originx1A/rz-loop-bus` was searched (handoffs, video voice folders, keeper-line, and the romansgame folder). The only game-line audio there is `handoffs/2026-10-20-unseen-voices/`, eight files that are already in `public/voices/`. The video voiceover is the Empty Throne trailer and does not say any sentence below.

## Already recorded, so not listed again

These eight play their own files. They are the stand-ins named later.

- `old_remind_pets` — Your buddy's looking a bit peaky. Go look in on the Stable. They might need a treat.
- `old_remind_coins` — That coin pile is getting smug. Spend some. The Stable sells treats and buddies. Rewards will take the rest.
- `old_remind_daily` — Today's Daily is still sitting there. I checked. It hasn't done itself.
- `old_remind_remix` — New Remix boards. Every three days, like clockwork. Go on, before I solve them out of boredom.
- `old_remind_streak` — That streak of yours is hanging by a thread. One Daily today and it lives. I'm not saying I'm worried. I'm saying the fire is.
- `old_remind_signin` — phones and tablets. You keep winning and then leaving it on this phone. Sign in, and the scores come with you. No password. I'm not carrying them.
- `old_remind_signin_computer` — computers. You keep winning and then leaving it on this computer. Sign in, and the scores come with you. No password. I'm not carrying them.
- `old_jab_computer` — computers, in the phone-jab moment. Have you ever used a computer before?

`old_jab_phone` was already in the game.

## Win lines

Every win-pool clip (cheer, record, near miss, not your best, Trial clear, Daily done, and the Unseen's after-win heckle) is in the voice catalog, has an mp3 under `public/voices/`, and has caption text. None of those lines are hidden for lack of a recording. The win sheet shows Roman's line only when that catalog clip is attached.

`comments.ts` still has an unused fallback caption, `Roman says: okay, next!`, for a clip id that has no caption. No win-pool clip hits it, so there is no file to record for it.

## Shop

Bundle and coin-pack cards are labels, prices, and contents. This build has no shop or bundle sentence for a character to say, so there is no shop clip in the list.

## The list

Same rows as `docs/missing-voice-lines.csv`. Speaker is who should record it. Status `stand-in` means the pop-up is visible and a different clip plays. Status `hidden` means the sentence is not shown and nothing plays.

## Guide warnings (stand-in: old_remind_pets)

### old_guide_hungry_lupa

- Speaker: Unseen
- Line: Your wolf pup is starving. I can hear its stomach from the void. Embarrassing.
- Trigger: Guide warning when Lupa is owned and hungry (lowest mood wins).
- Target: `public/voices/old_guide_hungry_lupa.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder, which does not say this.

### old_guide_hungry_aquila

- Speaker: Unseen
- Line: Your eagle is starving. I can hear its stomach from the void. Embarrassing.
- Trigger: Guide warning when Aquila is owned and hungry (lowest mood wins).
- Target: `public/voices/old_guide_hungry_aquila.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder, which does not say this.

### old_guide_hungry_leo

- Speaker: Unseen
- Line: Your lion cub is starving. I can hear its stomach from the void. Embarrassing.
- Trigger: Guide warning when Leo is owned and hungry (lowest mood wins).
- Target: `public/voices/old_guide_hungry_leo.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder, which does not say this.

### old_guide_hungry_invictus

- Speaker: Unseen
- Line: Your war horse is starving. I can hear its stomach from the void. Embarrassing.
- Trigger: Guide warning when Invictus is owned and hungry (lowest mood wins).
- Target: `public/voices/old_guide_hungry_invictus.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder, which does not say this.

### old_guide_hungry_nox

- Speaker: Unseen
- Line: Your halloween owl is starving. I can hear its stomach from the void. Embarrassing.
- Trigger: Guide warning when Nox is owned and hungry (lowest mood wins).
- Target: `public/voices/old_guide_hungry_nox.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder, which does not say this.

### old_guide_drowsy

- Speaker: Unseen
- Line: Your defender's about to fall asleep on the job. Feed it. Or don't. I enjoy watching failure.
- Trigger: Guide warning when no buddy is hungry, and the lowest-mood buddy is okay with mood under 45.
- Target: `public/voices/old_guide_drowsy.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Same sentence for every buddy. The tap still opens that buddy in the Stable.

### old_guide_meh_lupa

- Speaker: Unseen
- Line: Your wolf pup looks miserable. Have you tried... playing better?
- Trigger: Guide warning when no buddy is hungry or drowsy, and Lupa is the lowest-mood okay buddy.
- Target: `public/voices/old_guide_meh_lupa.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder.

### old_guide_meh_aquila

- Speaker: Unseen
- Line: Your eagle looks miserable. Have you tried... playing better?
- Trigger: Guide warning when no buddy is hungry or drowsy, and Aquila is the lowest-mood okay buddy.
- Target: `public/voices/old_guide_meh_aquila.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder.

### old_guide_meh_leo

- Speaker: Unseen
- Line: Your lion cub looks miserable. Have you tried... playing better?
- Trigger: Guide warning when no buddy is hungry or drowsy, and Leo is the lowest-mood okay buddy.
- Target: `public/voices/old_guide_meh_leo.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder.

### old_guide_meh_invictus

- Speaker: Unseen
- Line: Your war horse looks miserable. Have you tried... playing better?
- Trigger: Guide warning when no buddy is hungry or drowsy, and Invictus is the lowest-mood okay buddy.
- Target: `public/voices/old_guide_meh_invictus.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder.

### old_guide_meh_nox

- Speaker: Unseen
- Line: Your halloween owl looks miserable. Have you tried... playing better?
- Trigger: Guide warning when no buddy is hungry or drowsy, and Nox is the lowest-mood okay buddy.
- Target: `public/voices/old_guide_meh_nox.mp3`
- Status: stand-in (plays `old_remind_pets`)
- Notes: Bubble shows this sentence. Audio is the pets reminder.


## Guide opportunities and progress that play a coins or streak reminder

### old_guide_nox

- Speaker: Unseen
- Line: That Halloween owl won't be here forever. Unlike me. I'm always here.
- Trigger: Guide opportunity when Nox is unsold, on sale, and 3 or fewer days remain in the Halloween window.
- Target: `public/voices/old_guide_nox.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: Bubble shows this sentence. Audio is the coins reminder.

### old_guide_afford

- Speaker: Unseen
- Line: You've got coins just... sitting there. The Stable has something with your name on it.
- Trigger: Guide opportunity when the cheapest on-sale unowned buddy costs no more than the coin balance.
- Target: `public/voices/old_guide_afford.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: Same sentence for every buddy. Audio is the coins reminder.

### old_guide_badge

- Speaker: Unseen
- Line: You could be earning more coins per win. But sure, leave money on the table.
- Trigger: Guide opportunity when a badge the player already owns can be ranked up with the current coins.
- Target: `public/voices/old_guide_badge.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: Opens Rewards. Audio is the coins reminder.

### old_guide_coins_lupa

- Speaker: Unseen
- Line: {count} more coins and Lupa is yours. That's... what, a week of mediocre play?
- Trigger: Guide progress when Lupa is the cheapest on-sale unowned buddy and the coin gap is from 1 to 2,000.
- Target: `public/voices/old_guide_coins_lupa.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: The live sentence uses the gap with en-US grouping (1,000). One file cannot match every count. Record this pattern. Thousands use a comma.

### old_guide_coins_aquila

- Speaker: Unseen
- Line: {count} more coins and Aquila is yours. That's... what, a week of mediocre play?
- Trigger: Guide progress when Aquila is the cheapest on-sale unowned buddy and the coin gap is from 1 to 2,000.
- Target: `public/voices/old_guide_coins_aquila.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: The live sentence uses the gap with en-US grouping (1,000). One file cannot match every count. Record this pattern. Thousands use a comma.

### old_guide_coins_leo

- Speaker: Unseen
- Line: {count} more coins and Leo is yours. That's... what, a week of mediocre play?
- Trigger: Guide progress when Leo is the cheapest on-sale unowned buddy and the coin gap is from 1 to 2,000.
- Target: `public/voices/old_guide_coins_leo.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: The live sentence uses the gap with en-US grouping (1,000). One file cannot match every count. Record this pattern. Thousands use a comma.

### old_guide_coins_invictus

- Speaker: Unseen
- Line: {count} more coins and Invictus is yours. That's... what, a week of mediocre play?
- Trigger: Guide progress when Invictus is the cheapest on-sale unowned buddy and the coin gap is from 1 to 2,000.
- Target: `public/voices/old_guide_coins_invictus.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: The live sentence uses the gap with en-US grouping (1,000). One file cannot match every count. Record this pattern. Thousands use a comma.

### old_guide_coins_nox

- Speaker: Unseen
- Line: {count} more coins and Nox is yours. That's... what, a week of mediocre play?
- Trigger: Guide progress when Nox is the cheapest on-sale unowned buddy and the coin gap is from 1 to 2,000.
- Target: `public/voices/old_guide_coins_nox.mp3`
- Status: stand-in (plays `old_remind_coins`)
- Notes: The live sentence uses the gap with en-US grouping (1,000). One file cannot match every count. Record this pattern. Thousands use a comma.

### old_guide_streak

- Speaker: Unseen
- Line: Win tomorrow and that's {days} days. Don't choke.
- Trigger: Guide progress when the daily streak is 2 or more. {days} is the streak plus 1, so the first sentence is "Win tomorrow and that's 3 days. Don't choke."
- Target: `public/voices/old_guide_streak.mp3`
- Status: stand-in (plays `old_remind_streak`)
- Notes: The live number changes every day. The stand-in is the streak reminder, which does not say this sentence.


## Card-progress guides (hidden, no audio)

### old_guide_card_01

- Speaker: Unseen
- Line: You're 1 pieces from my card. One. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 49 pieces (90% or more). Tag card-90. Left of 1 also cannot be the 80% line, because 90% wins.
- Target: `public/voices/old_guide_card_01.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_02

- Speaker: Unseen
- Line: You're 2 pieces from my card. Two. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 48 pieces (90% or more). Tag card-90. Left of 2 also cannot be the 80% line, because 90% wins.
- Target: `public/voices/old_guide_card_02.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_03

- Speaker: Unseen
- Line: You're 3 pieces from my card. Three. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 47 pieces (90% or more). Tag card-90. Left of 3 also cannot be the 80% line, because 90% wins.
- Target: `public/voices/old_guide_card_03.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_04

- Speaker: Unseen
- Line: You're 4 pieces from my card. Four. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 46 pieces (90% or more). Tag card-90. Left of 4 also cannot be the 80% line, because 90% wins.
- Target: `public/voices/old_guide_card_04.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_05

- Speaker: Unseen
- Line: You're 5 pieces from my card. Five. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 45 pieces (90% or more). Tag card-90. Left of 5 also cannot be the 80% line, because 90% wins.
- Target: `public/voices/old_guide_card_05.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_06

- Speaker: Unseen
- Line: You're 6 pieces from my card. Six. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 44 pieces (80% and under 90%). Tag card-80.
- Target: `public/voices/old_guide_card_06.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_07

- Speaker: Unseen
- Line: You're 7 pieces from my card. Seven. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 43 pieces (80% and under 90%). Tag card-80.
- Target: `public/voices/old_guide_card_07.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_08

- Speaker: Unseen
- Line: You're 8 pieces from my card. Eight. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 42 pieces (80% and under 90%). Tag card-80.
- Target: `public/voices/old_guide_card_08.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_09

- Speaker: Unseen
- Line: You're 9 pieces from my card. Nine. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 41 pieces (80% and under 90%). Tag card-80.
- Target: `public/voices/old_guide_card_09.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.

### old_guide_card_10

- Speaker: Unseen
- Line: You're 10 pieces from my card. Ten. Even you can't mess this up.
- Trigger: Card-progress guide, hidden. 50-piece card, 40 pieces (80% and under 90%). Tag card-80.
- Target: `public/voices/old_guide_card_10.mp3`
- Status: hidden
- Notes: guideVoiceClip returns null for card- tags, so this pop-up is not shown.


## Leaderboard tease (hidden, no audio)

### old_tease_low

- Speaker: Unseen
- Line: Go check out your score on the scoreboard. Scroll down... further down... more down.
- Trigger: Signed-in win, rank worse than 10, and this was not also a new best that landed in the top ten. Not repeated if the last tease was also low.
- Target: `public/voices/old_tease_low.mp3`
- Status: hidden
- Notes: leaderboardTease situation "low". scheduleLeaderboardTease saves the rank and does not show or play the line.

### old_tease_best

- Speaker: Unseen
- Line: New best. Don't frame it yet. Go see if the scoreboard even noticed.
- Trigger: Signed-in win that is a new best and the new rank is worse than 10.
- Target: `public/voices/old_tease_best.mp3`
- Status: hidden
- Notes: leaderboardTease situation "best". scheduleLeaderboardTease saves the rank and does not show or play the line.

### old_tease_top

- Speaker: Unseen
- Line: Top ten. Your name is up where people can see it. Go look before someone sits on it.
- Trigger: Signed-in win in the top ten (new best, or a repeat visit to the top ten). Not repeated if the last tease was also top.
- Target: `public/voices/old_tease_top.mp3`
- Status: hidden
- Notes: leaderboardTease situation "top". scheduleLeaderboardTease saves the rank and does not show or play the line.

### old_tease_passed

- Speaker: Unseen
- Line: Someone just walked past you on the scoreboard. I watched. It was a little rude. Go look.
- Trigger: Signed-in win whose rank number is worse than the rank saved last time.
- Target: `public/voices/old_tease_passed.mp3`
- Status: hidden
- Notes: leaderboardTease situation "passed". scheduleLeaderboardTease saves the rank and does not show or play the line.


## Buddy pop-outs with no audio

### buddy_win_ave

- Speaker: buddy
- Line: Ave!
- Trigger: Win with a buddy, and the run was not a record, level-up, new star, or Trial clear.
- Target: `public/voices/buddy_win_ave.mp3`
- Status: hidden
- Notes: Win-screen buddy bubble. No clip is played for this text. Roman's separate win line still uses a catalog recording.

### buddy_win_best

- Speaker: buddy
- Line: New best!
- Trigger: Win with a buddy that sets a new best time or score.
- Target: `public/voices/buddy_win_best.mp3`
- Status: hidden
- Notes: Win-screen buddy bubble. No clip is played for this text. Roman's separate win line still uses a catalog recording.

### buddy_win_level

- Speaker: buddy
- Line: Level {n}!
- Trigger: Win with a buddy that levels up. {n} is the new level, from 2 to 30.
- Target: `public/voices/buddy_win_level.mp3`
- Status: hidden
- Notes: Win-screen buddy bubble. No clip is played for this text. Roman's separate win line still uses a catalog recording.

### buddy_win_star

- Speaker: buddy
- Line: New star!
- Trigger: Win with a buddy that earns a prestige star.
- Target: `public/voices/buddy_win_star.mp3`
- Status: hidden
- Notes: Win-screen buddy bubble. No clip is played for this text. Roman's separate win line still uses a catalog recording.

### buddy_win_victory

- Speaker: buddy
- Line: Victory!
- Trigger: Trial clear with a buddy, when it is not a record, level-up, or new star.
- Target: `public/voices/buddy_win_victory.mp3`
- Status: hidden
- Notes: Win-screen buddy bubble. No clip is played for this text. Roman's separate win line still uses a catalog recording.

### buddy_tap_ave

- Speaker: buddy
- Line: Ave!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_ave.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_again

- Speaker: buddy
- Line: Again!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_again.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_heehee

- Speaker: buddy
- Line: Hee hee!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_heehee.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_play

- Speaker: buddy
- Line: Let’s play!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_play.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_roma

- Speaker: buddy
- Line: Roma!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_roma.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_pat

- Speaker: buddy
- Line: Pat pat!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_pat.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_more

- Speaker: buddy
- Line: One more board?
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_more.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.

### buddy_tap_best

- Speaker: buddy
- Line: Best buddy!
- Trigger: Home screen, tap the active buddy. One of these eight lines, not the same line twice in a row. The bubble clears after 1.6 seconds.
- Target: `public/voices/buddy_tap_best.mp3`
- Status: hidden
- Notes: HomePet TAP_LINES. No audio. The apostrophe in Let’s play! is the curly apostrophe in the source.


## New on-screen lines with no audio

### narrator_nudge_home

- Speaker: narrator
- Line: Tap Share, then Add to Home Screen.
- Trigger: Home, between rounds, on an iPhone or iPad that is not already installed. Dismiss hides it for good.
- Target: `public/voices/narrator_nudge_home.mp3`
- Status: hidden
- Notes: On screen in this build. Nothing plays it. Not a Roman or Unseen line today.

### narrator_nudge_ping

- Speaker: narrator
- Line: Get a ping when friends challenge you?
- Trigger: Home, between rounds, when notifications exist and the device is not the iOS browser case.
- Target: `public/voices/narrator_nudge_ping.mp3`
- Status: hidden
- Notes: On screen in this build. Nothing plays it. Not a Roman or Unseen line today.

### narrator_nudge_account

- Speaker: narrator
- Line: You can keep this player from Account whenever you want.
- Trigger: Home, between rounds, when notifications are unavailable and it is not the iOS install case.
- Target: `public/voices/narrator_nudge_account.mp3`
- Status: hidden
- Notes: On screen in this build. Nothing plays it. Not a Roman or Unseen line today.

### narrator_signin_sheet

- Speaker: narrator
- Line: Get on the leaderboard and keep your scores on any device. We'll email you a sign-in link and the code from your email. No password.
- Trigger: Sign-in sheet, before a code is sent. This is the sheet copy, not the Unseen home reminder.
- Target: `public/voices/narrator_signin_sheet.mp3`
- Status: hidden
- Notes: On screen in this build. Nothing plays it. Not a Roman or Unseen line today.

### narrator_rotate

- Speaker: narrator
- Line: Turn the phone upright. The board is paused.
- Trigger: Phone held sideways during a board. The board is paused until the phone is upright.
- Target: `public/voices/narrator_rotate.mp3`
- Status: hidden
- Notes: On screen in this build. Nothing plays it. Not a Roman or Unseen line today.

