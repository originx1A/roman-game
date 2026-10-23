# Roman's Game master list (Tony, 2026-10-22)

Where this list conflicts with earlier instructions, this list wins. Build 9.33-m against items 1–24 only. Items 25–30 are owned elsewhere: Cooper's login PR draws the game login screen, and the sign-in backend stays in PR #63. This PR does not build that screen or that backend. Items 33–38 are recorded here only. They are built in PR #63 and Cooper's login PR. This PR does not change that code.

1. The Roman logo/header goes to game HOME (never the website). A small separate 'romansgame.com' link opens in a new tab, in the header of home and menu screens, never on the board during play.
2. Every screen (Play, Rewards, Stable, Share, Save) has a clear way back Home, on PC and phone.
3. One Play button. Modes (Daily, Endless, Remix) are picked from a small mode picker, with one control per job, no duplicates and no do-nothing buttons. Mix it up is removed.
4. The coin button (50¢) opens the player panel: stats, coin balance and coin shop. It must never do nothing.
5. Phone home fits with no scroll, using small side-by-side buttons. The 🏆 Leaderboard button sits on phone home AND during a game.
6. PC: the mini-leaderboard goes to the RIGHT OF THE GAME BOARD during play (top players, own rank, See all). The left-side treat float stays clear. NO leaderboard panel or button on PC home.
7. PC home, Rewards and Stable fit with no scroll: grid or side-by-side, no stacking.
8. See all on PC opens the full board centred and already expanded, with Close. Phone opens it full page.
9. The Victory card fits one phone screen: Share full width, the rest paired, no 'undos'.
10. No clipped or overlapping text anywhere. No yellow '?' over titles. The Unseen never covers text.
11. The mobile play screen stays as large as possible. Thumbs-up and similar stay reachable but off the play area.
12. Minimal on-screen text. How to play stays.
13. Board tabs: Everyone/Friends/Groups plus Week/Month. Small tags beside names (group tag, friend tag, 👑/⭐).
14. Tap your own name to see your info. Tap another player for Add friend / Ask to join their group, with Pending/Accepted states and Cancel.
15. A Requests inbox to accept or decline. Decline clears it.
16. Unfriend and Leave group.
17. + Create a group is visible on the Groups tab, plus My group.
18. Group name = adjective + noun from kid-safe lists plus a #number, enforced server-side. The Leader renames with the same picker.
19. Ranks 👑 Leader > ⭐ Captain (max 2) > Member. Next-in-line marker. When the Leader leaves, the crown goes to the longest-standing active Captain, else the longest-standing member. The founder can leave. If the last member leaves, the group closes and its points stay. A rejoining ex-leader comes back as a Member. The crown holder can remove members inactive 30+ days.
20. Other groups show name, rank, score and member count only. Only your own group shows its members.
21. Groups hold 1 to 10 players, with no coin sharing and no chat. Points stay with the group they were earned in.
22. Signed out: the controls are visible, and tapping one opens sign-in ('Sign in to add friends and join groups').
23. Change only what each item needs, and don't reset built work. Recheck connected screens after each change. QA screenshots at 1280x800, 1440x900, 390x844 and 375x667 for every touched screen, including a signed-in state for 14 to 19, plus a button table, in qa/9.33-d/.
24. EVERYTHING works, including sound: music, sound effects, Unseen voice lines and the mute/volume controls, on PC and phone. Verify that the audio files load (no 404s, check network logs in Playwright), that sounds trigger on the right events and that mute works. Test every button on every screen, plus a full play-through: start, place buddies, win, Victory, Next board, Home.
25. Owned elsewhere. The 'I'm 13 or older' box and every other one-time confirmation are asked ONLY at account creation and stored ON the account server-side. A returning user is never asked again on any device. The box itself stays for legal reasons, and under-13s go to the parent-linked path. Closing the app or restarting the phone does not ask again. The server flag means no 13+ box and no one-time question on a later sign-in. Cooper's login PR draws this. PR #63 stores it. PR #68 does not.
26. Owned elsewhere. Sign-in is email, then a 6-digit code, then done (Supabase email OTP). The field still accepts a 6 to 8 digit token when the email sends one. The session stays on this device until logout or the storage is cleared. Closing the app or restarting the phone stays signed in, with no prompts. Signing in again happens only after that, or on a new device. Item 29 is the order: name and password first, email code only for recovery. Cooper's login PR draws this. PR #63 stores it. PR #68 does not.
27. Owned elsewhere. A visible Log out button (in the player panel / You). Logout calls supabase.auth.signOut({ scope: 'global' }) so the romansgame.com session is revoked too. On load and window focus, re-check the session (getUser) and show signed-out if it was revoked. A network miss keeps the saved session. Cooper's login PR draws this. PR #63 stores it. PR #68 does not.
28. Owned elsewhere. The first sign-in screen has one box, 'Player name or email', and asks one question per screen. Kids can also use a picture password. Recovery and parent links stay as they are. No payments in login. Log out stays in the account sheet and in settings. Cooper's login PR draws this. PR #68 does not.
29. Owned elsewhere. The primary game sign-in is player name + password. Email is recovery only, behind 'Can't get in?' (it sends a code). All sign-up verifications (13+ and the rest) are stored on the account server-side, so after a cleared cache or on a new device, name + password goes straight in with no questions. Sign-up questions show only when no account exists for that name. The new-or-existing check never looks up an email, answers the same way either way, and is rate-limited. Cooper's login PR draws this. PR #63 stores it. PR #68 does not.
30. Owned elsewhere. Parent and kid accounts. An adult does the same one-time setup, and that setup includes their email. A kid can install the game and play for free with no email and no account. Registering a kid requires a parent: the parent makes the adult account first, then creates or approves the kid from the parent's profile, which unlocks the kid account. The kid account sits under the parent's email. The kid has no email of their own. The kid has their own player name and a password or a picture password, and can use that on the kid's device or on the parent's phone. Verifications stay on the account and are never asked again. Kid recovery goes through the parent. Where this disagrees with item 33, the kid has no email. Cooper's login PR draws this. PR #63 stores it. PR #68 does not, and it does not add payments to login.

What parent linking already exists, with no new code in this PR: PR #63 has `parent_links` from migration 008, `POST /api/parent-link` (the kid makes a token, the parent accepts it, and accepting does not require payments), `POST /api/auth/family` (`list`, `reset`, `remove`), and `POST /api/auth/recover/parent` (the parent sets a new password and signs the kid out). An under-13 signup can hold a parent address, and opening that link saves it as the kid's recovery email. That address-on-the-kid step is the part item 30 replaces. Neither PR #62 nor PR #63 creates the kid from the parent's profile. PR #62's accept required payments to be on. Use PR #63's accept.

## Recorded only — not built in this PR

Items 33–38 match Tony's master list. The work lives in PR #63 and Cooper's login PR. No code for these items ships in PR #68.

33. A parent can sign a kid up with only the kid's email, for recovery. No account is needed for that. Buying gifts needs a parent account.
34. Kid accounts can never buy. They can only view and receive.
35. Whoever adds a verified payment method takes over the account and is responsible for all charges.
36. No checkbox. One-line notice.
37. The 13+ question stays. Item 25 is the rule for when the login screen shows it: at account creation only, then stored on the account. Owned elsewhere, with item 25.
38. The login look is compact, with a smaller, less-rounded gold button and tighter spacing, no chunky pills.
