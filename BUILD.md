# Game sign-in chooser-first simplification — TEST BUILD ONLY

**Branch:** `cooper/game-auth-chooser-2026-11-07`, branched fresh from `main` @ `68f83655` (live build 9.32-i).
**Status:** nothing merged, nothing live. Production untouched — Tony tests the branch preview first.
**Checkout:** this worktree of the shared clone at `~/workspace/roman-game/roman-game-main` (a direct
`git clone` into `~/workspace/` failed with an index-pack write error; a worktree of the existing,
verified clone — whose `origin/main` was re-fetched and confirmed at `68f83655` — is the same code).

---

## 1. How the game's sign-in works TODAY (map, before the change)

The game has **two parallel sign-in systems that never talk to each other** (verified against this
checkout; consistent with the repo's own `SIGNIN-NAME-FIX-PLAN.md`).

### A. The real account — Supabase email code (passwordless), `src/cloud/`

- `src/cloud/cloud.ts` is the only real account system. It lazily loads supabase-js against the shared
  project `oelsglmfkpzbueqysvdm` (**the same Supabase project the romansgame.com website accounts use** —
  one account system) with the publishable key, RLS-gated, `persistSession: true`.
- Sign-in calls (unchanged by this task): `sendMagicLink(email)` →
  `sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` — one email carries both a
  magic link and a code; `verifyEmailCode(email, token)` → `sb.auth.verifyOtp({ type: 'email' })`.
  Account creation and sign-in are **the same call** (`shouldCreateUser: true`): there is no password
  anywhere in the game, and no separate create-account backend. After verification, a one-time name
  step (`savePlayerName(name, consent)` → `players` row insert; the server derives the unique public
  leaderboard name) completes the account.
- UI: `CloudScoresButton` in `src/cloud/CloudScores.tsx`, mounted on the home screen ("☁ Save my
  scores") and the win screen. It opens a portal modal (`.start-sheet.cloud-sheet`, card
  `.start-sheet-card` — `position: fixed; inset: 0; place-items: center`, card `max-height: 100%;
  overflow-y: auto`, so it already scrolls internally) with sheet states
  `'email' | 'sent' | 'name' | 'account' | 'parent'`:
  - **email sheet (today's opener):** an email field **plus three consent checkboxes stacked on the
    same screen** (I'm 13 or older / Terms+Privacy / newsletter opt-in) and one button, "Email me a
    sign-in link". If 13+ is unticked on submit it diverts to the `parent` sheet ("Ask a parent to
    sign up for you… You can keep playing everything without one").
  - **sent sheet:** enter the code from the email (or tap the link).
  - **name sheet:** one-time leaderboard name (profanity-checked client-side, `NAME_MAX` 24).
  - **account sheet:** signed-in state, Switch player / Sign out.
  - Consent (13+ and opt-in only — Terms is not persisted) lives in localStorage
    `rg.cloud.consent.v1` (`loadConsent`/`saveConsent` in cloud.ts).
- Session → `loadPlayer()` fills the module-level `CloudState` (`status`, `email`, `name`,
  `publicName`, `pending`); finished games queue scores in localStorage and `flushScores()` sends them
  only when signed in **and** named.

### B. The legacy local "profile" — no server at all, Save & settings screen

- `signInWithEmail(email, displayName?)` in `src/game/storage.ts` makes **no network call and verifies
  nothing**: it writes a `Profile` to localStorage `roman.profile.v1` and merges guest progress into
  it. The Save & settings screen (`screen === 'profile'` in `src/App.tsx`) renders this form
  (Email + Display name + "Save with email") whenever no local profile exists, and the profile card
  otherwise. It is completely independent of the cloud session (the known two-systems confusion —
  a separate, already-planned fix; **out of scope here**).

### What that means for Tony's model

- There is **no password field and no three-path chooser** (no For me / For my child / I'm a kid) in
  the game today — nothing to remove on that front.
- Tony's "sign in screen (name/email + password)" maps, in this game's real auth, to the **email +
  emailed-code** screens; "create account screen with the age verification" maps to the sign-up side of
  the same OTP call plus the one-time name step. The restructure below is purely which screens show,
  in what order: **chooser first, the 13+/Terms/newsletter questions move to the Create side only**,
  and the sign-in side shrinks to email → code. All auth calls, payloads, validation rules and consent
  wording are reused exactly.

## 2. The change (this branch)

`src/cloud/CloudScores.tsx` only (plus its regression tests and the build tag):

- New opening sheet state `'start'` — the **chooser**: heading "Save your scores", the existing
  one-line explanation, and exactly two first-class buttons: **Sign in** (primary) and
  **Create account**, plus "Not now" (Close always reachable; the scrim also closes).
- **Sign in** → email screen (email field + "Email me my sign-in code" button; NO checkboxes) →
  code screen (unchanged mechanics; retitled "Sign in with code") → box closes on success (the
  one-time name step still appears if this player has never set a leaderboard name — existing
  behaviour; a named player's success lands on the account screen only if they arrived via the code
  screen, as today).
- **Create account** → create screen (email field + the SAME consent checkbox block, byte-identical
  wording: 13 or older / Terms+Privacy / newsletter) → submit runs the identical validation
  (13+ unticked → parent screen; Terms unticked → same error; bad email → same error) and the
  identical `sendMagicLink` call → code screen (headed "Enter your code to finish") → name screen →
  box closes when the name is saved.
- The shared `email` state means **typed values are never wiped** switching between the sign-in and
  create screens (each form screen carries a quiet switch link to the other). Consent checkbox state
  is likewise shared component state.
- Signed-in behaviour unchanged: the button opens the account sheet (or the name sheet if unnamed).
  The account sheet gains a **Close** button first (Done kept) so Close is reachable there too.
- Build tag bumped to `build 9.32-j-dev` (repo convention from the return-link branch: letter bump,
  `-dev` suffix while unmerged).

## 3. Verification

**Commit:** `ab5b0e56ab4ceb27a9d2af018830c98ffac9cfa9` on `cooper/game-auth-chooser-2026-11-07`
(pushed to origin; **not merged** — `main` still `68f83655`, production untouched).

**Harness (`npm test`):**
- Baseline on clean `68f83655` in this worktree: **246 tests, 239 pass, 10 fail** — the known
  pre-existing set (3× 9.30-u SEO-file checks, Endless source check, claimFieldTreats, heard-lines
  reachable, heard summary total, save cleaning, `scripts/replay.test.ts`, treats coin-sink).
  Honest note: matching the brief's "same 10 failures", but the totals on *current* main measure
  246, not the brief's 249 (that count included the return-link branch's own added tests/files).
  A first run before `npm install` completed showed 226 tests / 11 fails — the extra failure was
  `scripts/kit-news.test.ts` failing to *load* (`@xmldom/xmldom` missing, no node_modules yet);
  with dependencies installed it passes and the counts above hold.
- After the change: **252 tests, 245 pass, 10 fail** — failing-name list diffed against baseline:
  **identical set, no new failures.** The +6 are the new `scripts/game-auth-chooser.test.ts` checks
  (chooser shape, create-only consent, shared email field, unchanged auth calls, Close reachability,
  build tag) — all pass.

**Build:** `tsc -b` clean; `vite build` green (run via node directly — `npm install` here needed
`--no-bin-links` because this filesystem refuses the chown npm attempts on bin shims; Netlify's
build environment is unaffected).

**Browser verification** (`verify.mjs`, headless Chrome over CDP against the locally served
production build of this branch; machine-readable results in `verify-report.json`): **14/14 PASS** —
chooser opens first with exactly [Sign in · Create account · Not now] and **zero input fields**;
sign-in screen replaces it (one email field, **zero checkboxes**); create screen replaces it with the
typed email intact and the 3 consent questions (13-or-older first); switching back keeps the email;
a bad email shows the app's inline error with the value kept and **nothing sent** (validation path
only — no real account, no email); "Not now" closes; at the chrome-shrunk **390×664** the tallest
screen (create) fits fully with every control reachable (card is 466px at that height, nothing cut
off; the card also scrolls internally if a taller state ever needs it).
Screenshots: `auth-chooser-phone390.png`, `auth-signin-phone390.png`, `auth-create-phone390.png`,
`auth-create-phone390-shrunk.png`, `auth-chooser-desktop.png`, `auth-signin-desktop.png`
(visually inspected: chooser and sign-in are exactly Tony's model).

**Branch preview:** https://cooper-game-auth-chooser-2026-11-07--romans-game.netlify.app — live
(HTTP 200), and its served JS bundle was content-checked: it contains the new chooser strings and
the `9.32-j-dev` build tag, i.e. the preview really is this branch's build (no secret-scan failure —
branch previews inherit the site env with `SECRETS_SCAN_OMIT_KEYS=SUPABASE_URL`).

**Blockers / open items:** none for the test build. Two sequencing notes for whoever merges later:
(1) this branch and `cooper/site-return-link-2026-11-07` both bump `src/buildTag.ts` (theirs
`9.32-j`, this one `9.32-j-dev`) — a trivial conflict to resolve at merge time; (2) the game's TWO
sign-in systems (this cloud box vs the unverified local "Save with email" form on Save & settings)
remain independent — untouched here per scope; the repo's `SIGNIN-NAME-FIX-PLAN.md` already covers
that unification as its own job.

---

## 4. Round 2 — Tony's corrections from testing on his phone (Nov 7, ~18:15 EST)

Tony's priority note: the cleanup matters most **in the game** ("this is on the game, not
romansgame.com"). Two defects, both fixed on this same branch, presentation/flow only —
no auth calls, payloads, validation, or consent wording touched.

### 4a. The on-screen keyboard covered the field being typed in

On his phone, tapping the email field opened the keyboard over the lower half of the screen
and the field disappeared under it ("you can't see shit"). The sheet was centred on the full
screen height, so the keyboard — which only shrinks the *visual* viewport — covered it.

Fix (`src/cloud/CloudScores.tsx` + `src/App.css`):
- While the box is open, an effect tracks `window.visualViewport`: on every resize/scroll it
  writes `--rg-vv-top` / `--rg-vv-height` onto the sheet element, and `.start-sheet.cloud-sheet`
  is sized/positioned by those properties, so the whole panel lives inside the still-visible
  area above the keyboard. (No keyboard → properties equal the full viewport; desktop and the
  no-`visualViewport` fallback behave exactly as before.)
- A `focusin` listener (plus the viewport sync itself) checks the focused input/textarea: if
  it sits outside the visible strip, it is scrolled into view (centred) inside the
  internally-scrolling card. This covers every typing screen the box has — sign-in email,
  create email, code entry, and the one-time name step all live in the same sheet element.

### 4b. A way back to romansgame.com on the panel itself

"You need a button somewhere or a link on that page that takes you to romansgame.com." Every
sheet in the box (chooser, sign in, create, code, name, parent, account) now ends with a small
footer link: **Visit romansgame.com** → `https://romansgame.com/`, `target="_blank"`,
`rel="noopener"` (`.cloud-site-link`, gold, centred). Panel-level only — the separate
home-screen button on `cooper/site-return-link-2026-11-07` is untouched and unentangled.

### Verification (round 2)

- **Harness:** 254 tests, 244 pass, **10 fail — the failing-name list is byte-identical to the
  pre-round-2 baseline** (252/10 on this branch before these commits; the +2 are the new
  round-2 regression checks in `scripts/game-auth-chooser.test.ts`, both passing). `tsc -b`
  clean, vite build green.
- **Browser (`verify.mjs`, 18/18 PASS** — the 14 round-1 checks plus 4 new): the footer link
  is present with the exact label/href/target/rel and *visible* on the chooser, and present on
  the form screens. **Keyboard emulation:** with a field focused at 390×844, the visible area
  was shrunk to **390×400** (the strip a phone keyboard leaves) and the focused field measured:
  sign-in email field at y 110–154 of the 400px visible strip, whole card inside it
  (y 18–382); create email field at y 104–147, card y 12–388. Screenshots:
  `auth-keyboard-signin-390.png` and `auth-keyboard-create-390.png` (focused field, cursor in
  it, fully inside the visible frame, footer link visible under the buttons on the sign-in
  shot), plus `auth-chooser-phone390.png` (footer link under "Not now", visually inspected).
  The code and name screens sit behind a real emailed code / an existing session, so they
  can't be reached in a no-real-account test; they share the same sheet element, viewport
  tracking, and focus handling, so the fix covers them by construction.
- **Branch preview:** rebuilt on the same URL after the round-2 push — the preview's served JS
  bundle changed (new asset hash) and was content-checked: it contains `cloud-site-link`,
  `--rg-vv-height`, and "Visit romansgame.com", so the preview really is the round-2 build.
- **Commits:** `9ec212c` on top of round 1's `ab5b0e5` + `c9e625e`, pushed to origin
  (`main` still `68f83655` — nothing merged, production untouched).

---

## §5 — The name+password switch (Nov 7 evening, Tony: "Just fix it and put it up", ~18:31 EST)

Scope executed: `GAME-PASSWORD-SCOPE.md`. The game moves onto the SAME shared door as
romansgame.com (`/api/auth/*`, absolute URLs to `https://romansgame.com` — the game's own
`/api/*` is its checkout functions and stays untouched). The chooser screens, the round-2
keyboard fix and the panel site link from rounds 1–2 all survive. Build tag: **9.32-k-dev**.

### Phase 0 — verifications (as far as available access allows)

- **Q1 — Turnstile hostname coverage for play.romansgame.com: CANNOT be confirmed from code
  or this machine.** It is a Cloudflare dashboard setting; no dashboard credentials here.
  Code facts: production `/api/auth/config` (fetched live Nov 7 ~18:32 EST) returns site key
  `0x4AAAAAAFfTs2hm1baT01HK`, mode "live"; server-side siteverify is hostname-agnostic, so
  coverage is purely a widget-render question. Handling per the brief: in-game signup's
  person check **fails closed exactly like the website** (no token → the signup route
  answers `turnstile_required` 403 before any account write; the game shows "finish the
  person check, then tap again"). If the hostname is not covered, in-game signup blocks
  truthfully at that step and the dashboard item is the named blocker — it is the SAME
  outstanding Cloudflare item as the website ejection finding; Tony/GB own that dashboard.
- **Q2 — Supabase OTP settings / email rate limits: dashboard-only, no read access.** The
  code door's calls are untouched by this build, so today's configuration keeps working;
  the claim depends on the code door only as its bootstrap.
- **Q3 — account counts (game-born / dual): NOT obtainable** — no service-role key on this
  machine (rg-site-work carries only `.env.example`). The counts size importance only; the
  claim flow's dual stop does not depend on them. Open item for whoever holds the key.
- **Live CORS probe (Nov 7 ~18:32 EST):** an OPTIONS preflight to production
  `/api/auth/signin` from Origin
  `https://cooper-game-auth-chooser-2026-11-07--romans-game.netlify.app` returned 204 with
  **no** `access-control-allow-origin` header → branch previews cannot call production auth
  until the widening in the claim branch ships (held for release, below). The preview is
  therefore for Tony's visual/flow check; live-API behaviour is proven by the stubbed
  browser harness, not by the preview.

### Phase 1 — game client onto the shared door (this branch)

`src/cloud/cloud.ts` — added the shared-door layer; the code door
(`sendMagicLink`/`verifyEmailCode`), queue/scores/cards/`loadPlayer` untouched:
- `AUTH_BASE = 'https://romansgame.com'`, `authPost`, `adoptApiSession` (setSession with
  the API's token pair), `authErrorMessage` (the website's `auth-client.js` wording,
  ported — errors read identically on both doors).
- `signInWithPassword` — `stay_signed_in: true`; captchaToken only on the server's
  `turnstile_required` retry. `createAccount` — `age_choice` (`13_plus`/`under_13`),
  `terms_accepted`, `marketing_opt_in`, optional email, captchaToken.
- Turnstile plumbing: site key from `/api/auth/config`; `renderTurnstile` lazy-loads the
  explicit-render script, 30 s timeout, resolves null when the widget can't run → every
  gated caller fails closed.
- `claimAccount` (Bearer = live session token; the server's `dual_account` message is
  surfaced verbatim), `recoverStart`/`recoverCode`/`recoverFinish` on
  `/api/auth/recover/lost/*` (finish sends `{reset_token, user_id, new_password,
  stay_signed_in: true}` and adopts the returned session), `addRecoveryEmail`
  (Bearer → `/api/auth/email-add`), `signOutEverywhere` (best-effort API signout, then
  local signOut).
- `CloudState.authKind` + `probeAuthKind` (once per user per session: POST
  `/api/auth/session` with the bearer → 200 = 'password'; fallback = synthetic
  `@players.romansgame.invalid` address ⇒ 'password', real address ⇒ 'code'). Sign-out
  resets the probe.

`src/cloud/CloudScores.tsx` — full rewrite of the panel; 12 sheets:
`start | signin | create | emailcode | sent | name | account | parent | forgot | reset |
claim | addemail`.
- Chooser unchanged in shape, plus a third ghost button **"Sign in with an email code"**
  (the code door, demoted to claim bootstrap + fallback).
- Sign-in = player name + password + a first-class **Forgot your password?** button;
  success closes the box for named players (Tony's model).
- Create = name/password/confirm + ONE shared email field whose label flips with the age
  tick ("Recovery email (optional)" / "Grown-up's email (required for a child's account)")
  + the same 3 consent rows, byte-identical wording. **The age record is the server's
  now** — the payload carries `age_choice`/`terms_accepted`; the old localStorage-only
  consent is kept only as a device marker. Under-13 → grown-up email required, enforced
  client-side AND server-side. Captcha gate fails closed; tokens are single-use and
  cleared after every gated call.
- **Production truth found while verifying (stub corrected to match):** a website signup
  writes `players.display_name` = the FIRST name of the sign-in name
  (`publicDisplayName`), so after an in-game create the leaderboard name already exists
  and the box simply closes — there is no name step to show. The name step still serves
  code-door players with no name yet, and after an API create the consent questions are
  NOT re-asked (the server holds the age record).
- Claim sheet (Phase 2 UI) — from the account sheet when the account is a code account
  (`authKind !== 'password'`, not just-claimed), and right after a code sign-in when the
  player came in through the claim errand. Copy separates the sign-in name from the
  leaderboard name ("your leaderboard name doesn't change"). Under-13 claim is refused
  in-game with an honest pointer to romansgame.com (a grown-up makes child accounts
  there). Success → account sheet + the note "from now on you sign in with your name +
  password…".
- Forgot (Phase 3) — recovery email + the support line for no-email accounts
  (support@romansgame.com) → reset sheet: 6-digit code → grant; multi-account picker
  when the email covers more than one account; new password + confirm; finish needs a
  FRESH person-check token; the finish signs the player back in and the box closes.
  In-game reset completes by CODE; the emailed link remains a supported website-side
  finish.
- Add-email sheet (Phase 3) — from the account sheet for password accounts; the confirm
  email completes it (the note says so). The account sheet never displays the synthetic
  login email.
- One captcha state machine shared across sheets; its render waits for the widget
  container to actually mount (a sheet swap mid-flow re-mounts the box — keying the
  render on the sheet alone restarted nothing there; found and fixed during browser
  verification).
- The keyboard/visualViewport effect and the "Visit romansgame.com" footer link ride on
  ALL 12 sheets, untouched from round 2.

`src/App.css` — +3 rules (`.cloud-captcha`, `.cloud-field-label`, `.cloud-note`).
`src/buildTag.ts` — `9.32-k-dev` (deliberately past the return-link branch's `9.32-j`;
sequencing in the release checklist).

### Phase 2 — the claim endpoint (site repo, test branch)

Branch **`cooper/auth-claim-2026-11-07`** in `~/workspace/rg-site-work`, commit
**`768457d`** "Add POST /api/auth/claim: game-born accounts claim a website name+password
login" (base `b4df3f5`). NOT deployed anywhere; production untouched.
- Handler `claimAccount` in `netlify/lib/authHandler.ts` + thin wrapper
  `netlify/functions/auth-claim.ts` (path `/api/auth/claim`) + `_redirects` line 10:
  `/api/auth/claim /.netlify/functions/auth-claim 200`.
- Contract: Bearer = the live OTP session token. Body `{name, password, age_choice,
  terms_accepted: true, marketing_opt_in?, captchaToken?}`. Errors: 401 unauthenticated ·
  409 `already_claimed` (a profiles row exists) · 409 `dual_account` + a plain-words
  support message (the real email is a verified recovery email of a DIFFERENT player —
  never merge, never create) · 422 `no_email` (auth email missing or already synthetic) ·
  422 age_required/terms_required/name_rejected/weak_password(+hint) · 409
  name_taken/age_locked. Captcha: required in production contexts via `captchaOk(ctx,
  true)` — fail closed; skippable only in preview/test Turnstile modes. Per-user rate
  limit mirroring `rename_user` (`claim_user`).
- Same user ID throughout: backend `getAuthUserEmail` + `claimAccount` — ONE
  `admin.updateUserById` sets the password AND swaps the auth email real→synthetic (the
  commit point, last step); profiles + account_recovery upserts land before it with the
  real email filed as VERIFIED recovery; `players.age_13_plus` updated;
  `players.display_name` NOT touched (scores/card/leaderboard name carry by
  construction). Age choice + flags are stamped before the claim write, so a half-claim
  finishes on retry — idempotent/resumable.
- Response: `sessionBody`+`withFlags` **without a minted `session` field**, on purpose —
  the game's existing OTP session stays valid after the email swap (sessions are
  token-based), so the client keeps the pair it already holds. `linkKidsByEmail`
  best-effort for 13_plus claims; audit event `claim`.
- **CORS widening (the Phase 1 one-liner):** `authPolicy` `allowedOrigin` also accepts
  game branch previews `cooper-<slug>--romans-game.netlify.app`
  (`GAME_BRANCH_PREVIEW_HOST`) — ships in this same commit, so previews can call
  production auth the moment this branch deploys.
- Tests: `tests/auth-claim.test.js` — 15 tests (happy path, under_13, already-claimed,
  dual-account with NO writes, name taken, weak/pwned password, half-claim resume, 401,
  production captcha, backend units) + a CORS branch-preview test in
  `tests/auth-policy.test.js`. **Re-run independently Nov 7 evening: 23/23 pass.**
  Full site suite on the branch as it sits in the working tree: 89 tests / 88 pass — the
  one failure ("purchase cards: claims spend a copy…") is **pre-existing and unrelated**:
  it fails because of UNCOMMITTED purchase-retirement edits sitting in the rg-site-work
  working tree on top of the claim commit (with those five files stashed, the suite shows
  the in-flight retirement state instead — either way, no claim test fails and the claim
  commit itself is clean). Whoever lands the purchase-retirement work owns that test;
  flagged here so the release step re-checks it.

### Phase 3 — in-game recovery + add-email

Shipped in the game client above (forgot → recover/lost start|code|finish; add-email
from the account sheet). The emailed reset LINK also remains a website-side finish —
in-game reset completes by code, so the player never leaves the game.

### Phase 4 — NOT DONE (Tony's separate call)

The code door stays alive as the claim bootstrap; nothing in this build closes it, and
no grace-period clock exists anywhere. Retiring it + the grace length is Tony's call.

### Verification evidence

- **Type/build:** `tsc -b` clean; `vite build` green.
- **Game harness (`npm test`): 260 tests / 250 pass / 10 fail.** Baseline (round-2 head
  `90e7f21`): 254 / 244 / 10. The failing-name set is the SAME pre-existing 10 (3× 9.30-u
  index/llms/robots, Endless-from-Remix, claimFieldTreats, two heard-lines voice-audit
  checks, save-migration, replay suite, treats-sink) — **zero auth failures**, +6 net new
  tests, all passing (chooser shape kept; password sign-in on the shared door; create
  payload/age-record/captcha gate; code door demoted; claim shape + dual_account;
  recover/lost wiring + multi-account picker; email-add; shared-field counts).
  Note: the summary-era worry about a flaky "9.30-t pot is split" parade test did not
  reproduce in the final runs — it is not in the failing set.
- **Browser (`node verify.mjs`): 47/47 PASS** against the production build of this
  branch, fully stubbed seam (fetch stub injected before the app loads: romansgame.com
  `/api/auth/*` scripted, Supabase REST/auth local, Turnstile replaced by a fake widget
  issuing `stub-turnstile-token`; NO real account, NO real email, production never
  called). Coverage: chooser shape + footer link; sign-in wrong/right password (payload
  asserted: name+password+`stay_signed_in: true`; the website's own error copy verbatim);
  forgot fail-closed → start (202 + token) → wrong code (`code_invalid` copy) → right
  code → grant → finish (payload asserted) → signed in, box closed; add-email round
  trip; create captcha gate (NOTHING posted without a token) + signup payload
  (age_choice/terms/captcha/stay) + box closes with the server-written leaderboard name;
  **claim end-to-end** (code sign-in → account sheet → claim → dual stop message shown
  verbatim → success payload asserted → claim button gone); typed values survive
  sign-in↔create switching both ways; 390×664 fit; **keyboard re-verified on the NEW
  password forms** — create screen's Password field AND the sign-in password field,
  focused at 390×844 then the visible area shrunk to 390×400: both fields measured
  fully inside the visual viewport (create: y 170–213 of 400; sign-in: y 155–198).
  Screenshots: `auth-chooser/signin/create/reset/account-claim/claimed-phone390.png`,
  `auth-create-phone390-shrunk.png`, `auth-keyboard-create-390.png`,
  `auth-keyboard-signin-390.png`, desktop pair. Machine record: `verify-report.json`.
  Harness fixes made along the way (all in the harness/stub, not the app): the stub now
  answers `/auth/v1/otp` + `/auth/v1/verify` (the code door's real endpoints), each run
  starts from wiped storage (a crashed run's leftover session otherwise boots the app
  signed in), and the claim leg ticks only unticked consent boxes (shared consent state).
- **Payments — verified untouched, not assumed:** the game's
  `netlify/functions/create-checkout.ts` contains ZERO auth/session/bearer references
  (grep-clean); the game's `/api/*` remains its own functions; the game's auth calls go
  to absolute `https://romansgame.com/api/auth/*` only. The site's adult-buying gate is
  website-side and untouched. No payment file appears in either branch's diff.
- **Website production untouched:** no deploy was run by this task; the claim branch is
  committed only. The game branch is pushed for its preview only; `main` is still
  `68f83655`.

### Production-release checklist — HELD for the coordinator's release word

Do these IN ORDER, only on the release word. Phase 4 is NOT part of this release.

**A. Claim endpoint → romansgame.com production (manifest surgery, site discipline):**
1. Land `cooper/auth-claim-2026-11-07` (`768457d`) onto the site deploy tree
   (`~/workspace/checkout-prod-build/site` + `rg-site-work` sources as the tree
   requires). FIRST reconcile the uncommitted purchase-retirement edits in the
   rg-site-work working tree — they are a separate workstream; do not sweep them into
   this deploy, and re-run the full site suite so its one known failure is explained
   before shipping.
2. `python3 ~/workspace/checkout-prod-build/sync_news.py` BEFORE the deploy (house
   rule — an unsynced deploy deletes the publisher's newest articles).
3. Deploy via `deploy_prod_publish.py` or
   `custom.legacy-netlify/bin/netlify_deploy_with_functions.py` ONLY (never the plain
   legacy script — it strips the functions). Files map: SHA-1 digests; functions by
   digest, with the NEW `auth-claim` function zip in classic-Lambda format (bundle the
   adapter with esbuild `--platform=node --format=cjs`, zip as `auth-claim.js` +
   `package.json` type commonjs) OR digest-reuse if a staging deploy already uploaded
   the identical zip. Judge the deploy by `available_functions` on the published deploy
   + live probes, never by upload responses.
4. Assert `/_redirects` is IN the outgoing file map and contains the new line
   `/api/auth/claim /.netlify/functions/auth-claim 200` AND the existing routes
   (count them; the file carries the auth + progress + cards rules — diff against the
   publisher tree's copy before deploying).
5. Post-deploy probes: `GET /.netlify/functions/create-checkout` →
   `{"enabled":true}`; `GET /api/auth/config` → 200; an unauthenticated POST to
   `/api/auth/claim` → the handler's own 401 JSON (not 404/502); an OPTIONS preflight
   to `/api/auth/signin` from the game branch-preview origin → 204 WITH
   `access-control-allow-origin` (proves the CORS widening shipped).
6. Regenerate `production-manifest.json` from the deploy's `/deploys/{id}/files`
   (strip leading `/` from paths), run `news-publisher-interlock.py` → INTERLOCK PASS.
7. Re-verify the live pages + published deploy id again ~15 minutes later (the
   news-publish race runs both ways).

**B. Game merge → play.romansgame.com production:**
1. Merge order for the two waiting branches: **`cooper/site-return-link-2026-11-07`
   first** (tag `9.32-j`), then **`cooper/game-auth-chooser-2026-11-07`** (this branch).
   Both touched `src/buildTag.ts`: return-link set `9.32-j`, this branch set
   `9.32-k-dev`. Resolve the conflict by taking the LATER letter and dropping the dev
   suffix: merged production tag = **`9.32-k`**. No other file overlaps (return-link:
   home-screen anchor + its test; this branch: cloud/auth + App.css + harness/verify).
2. Production build env: `SECRETS_SCAN_OMIT_KEYS=SUPABASE_URL` must be set for the
   game site build (the Oct 24 secret-scan false positive on the public Supabase URL);
   durable fix still owed: record it in the game repo's `netlify.toml`.
3. Gate before merge: `tsc -b` clean, `npm test` failure set = the known 10 named
   above (no new names), `node verify.mjs` 47/47 on the merged tree.
4. After the game deploy: fresh-visit check on play.romansgame.com as a real visitor —
   chooser opens, sign-in with a test account closes the box, the account sheet shows
   the claim button for a code-born test account. (Any live round trip uses ONLY a
   designated test account, and only once the endpoint from step A is live.)

**C. Explicitly NOT in this release:** Phase 4 (code-door retirement / grace length —
Tony's separate call); the Cloudflare Turnstile hostname item (Q1 — dashboard,
Tony/GB); the Supabase OTP settings question (Q2 — dashboard); the account counts (Q3
— needs the service-role key holder).
