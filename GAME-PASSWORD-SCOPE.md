# Game accounts → name + password (email for recovery only) — SCOPING REPORT

**Status: SCOPING ONLY.** No code changed, no branches written, no deploys.
**Tony's ruling (Nov 7, ~18:26 EST):** the GAME's accounts should match the website's model —
player **name + password** to sign in, **email for recovery only** (forgot → email reset).
Today the game is passwordless: email → emailed code/link → in (`signInWithOtp`).
**Question this report answers:** how big is the switch, what could break, and what's the least-pain path?

All findings below are from code read on Nov 7, 2026: the game checkout
(`~/workspace/game-auth-simplify-2026-11-07/`, branch `cooper/game-auth-chooser-2026-11-07` off live main
`68f83655`), the live website client (`~/workspace/checkout-prod-build/site/js/`), and the website auth
backend sources (`~/workspace/rg-site-work/netlify/`).

---

## Bottom line (for Tony, plain terms)

- **The good news: this is a reconnection, not a rebuild.** The website's name+password system and the
  game's email-code system already live in the **same account database** (same Supabase project,
  `oelsglmfkpzbueqysvdm`). A website account and a game account are the **same kind of user record**,
  and the game already stores scores, leaderboard names, and the Unseen card against that record's ID.
- **The seam is real but narrow:** today the two doors **do not find each other**. A game player
  (email-code account) has **no row in the website's name directory** (`profiles`) and no password, so
  the website can't sign them in; a website player (name+password account) has **no leaderboard row**
  (`players`) until the game creates one, and their Supabase login address is a **made-up address**
  (`name@players.romansgame.invalid`), so the game's email-code door can't find them either. One
  database, two front doors, no hallway between them — **yet**.
- **The endpoints the game needs already exist and already accept the game's address.** The website's
  auth API (`/api/auth/*` on romansgame.com) was built origin-aware: its allow-list in
  `authPolicy.js` explicitly includes `play.romansgame.com` and branch-deploy previews of the game
  site. The game would call the **same** endpoints the website calls; it would **not** need its own
  auth backend.
- **Existing game players keep everything.** Their scores/cards hang off their user ID, which doesn't
  change. The migration is: sign in **once** the old way (email code), then **choose a name + password
  once**, and from then on it's name+password everywhere, with the email kept as the recovery address.
- **Honest size: this is a focused multi-day piece of work, not an afternoon toggle** — roughly:
  a small server addition (a "claim your account" step), a rework of the game's sign-in box
  (the chooser screens from this week's build mostly survive), and a careful migration + test pass.
  Phased plan in §5. The riskiest part is not the code; it's the **one-time claim flow** and the
  **person-check (Turnstile) inside the game** — both flagged in §6.

---

## 1. Backend reality — how website accounts actually work

**Yes: the website's password is a real password credential in Supabase Auth** — with a custom layer
in front of it, not instead of it.

- Signup goes through our own Netlify function (`POST /api/auth/signup` →
  `netlify/lib/authHandler.ts` → `SupabaseAuthBackend.createAccount` in `netlify/lib/authBackend.ts`),
  which calls the Supabase **admin API** `auth.admin.createUser({ email, password, email_confirm: true })`.
  The password is hashed and stored by Supabase itself (`auth.users.encrypted_password`, bcrypt —
  the backend even reads that hash back via `bcryptjs.compare` in one fallback path).
- **The trick:** the "email" on a website account is **synthetic**:
  `loginEmail(normalizedName)` = `<normalized-name>@players.romansgame.invalid`
  (`netlify/lib/authCrypto.ts`, `LOGIN_DOMAIN = 'players.romansgame.invalid'`).
  The player's real email is **not** the login; it lives separately in the `account_recovery` table
  (`recovery_email`, set only after the owner confirms it by code/link; `pending_email` before that).
  That's exactly Tony's model: **name + password is the key; email is recovery only.**
- Sign-in (`passwordGrant`) is a genuine Supabase `signInWithPassword({ email: synthetic, password })`
  via a throwaway service-role client; on success the handler returns a real Supabase
  **session pair** (access + refresh token) in the JSON body, and the website client stores it with
  `client.auth.setSession(...)` — i.e., after the door, both systems hold the **same kind of session**
  in the **same project**. Stay-signed-in/device bookkeeping (`auth_devices`) is extra website-side
  machinery on top.
- Alongside the auth user, signup writes two rows keyed by the **same user ID**:
  `players` (via `playerInsert`: display/public name, age flag) and `profiles` (the name directory:
  `player_id`, `display_name`, `name_normalized` — how the website finds an account by typed name),
  plus `account_flags` / `age_choices` (age choice is recorded server-side and **locked** once chosen)
  and, when an email was given, an `account_recovery` row with a hashed verify code.

### The `/api/auth/*` endpoints the game would need (all POST, JSON, on romansgame.com)

Full route list lives in `checkout-prod-build/site/js/accounts-config.js` (`nameAuth`) and the
`_redirects` in the deploy tree; handlers are thin wrappers over `authHandler.ts`.

| Endpoint | Takes | Returns / does |
|---|---|---|
| `POST /api/auth/signup` | `{ name, password, age_choice ('13_plus'|'under_13'), terms_accepted: true, email? (recovery/parent), marketing_opt_in?, captchaToken }` | 201 + `{ user_id, player_name, display_name, session{access_token, refresh_token}, recovery_email_pending?, parent_email_pending?, age_choice }`. Errors: `name_taken` 409, `age_required` 422, `terms_required` 422, `turnstile_required` 403, rate limits 429. Under-13 → parent email required; parent gets an approval email. |
| `POST /api/auth/signin` | `{ name, password, captchaToken? }` — `name` may also be a **verified recovery email**, which routes to a code-based sign-in branch instead | 200 + same session body (+ flags, `recovery_email`, linked-kids info). Errors: `invalid_credentials` 401, lockouts 429 after repeated failures, `turnstile_required` 403 (person-check kicks in after failures, not on first try). |
| `POST /api/auth/lookup` | `{ identifier }` (name or email) | `{ exists }` — the website's one-box routing uses it to send people to the right door. |
| `POST /api/auth/recover/lost/start` | `{ email, captchaToken }` | Emails a **reset code + link** to the account's verified recovery address (10-minute life). Anti-enumeration: answers the same whether or not it sent. |
| `POST /api/auth/recover/lost/code` | `{ email, code, captchaToken }` **or** `{ link_token }` | Validates the code/link; returns the account(s) it unlocks. |
| `POST /api/auth/recover/lost/finish` | code/link proof + `{ new password fields }` (exact field names to lift from the handler when building) | Sets the new password (`admin.updateUserById({ password })`), revokes other sessions. |
| `POST /api/auth/refresh` | `{ refresh_token }` (per handler) | New session pair. |
| `POST /api/auth/session` | bearer access token | Session/account check. |
| `POST /api/auth/signout` | bearer | Revokes (scope-aware). |
| `POST /api/auth/verify-email` / `/resend` | code or `?id=&token=` link | Confirms a pending recovery email. |
| `POST /api/auth/email-add` | bearer + email | Adds/changes the recovery email later (this is what lets a **no-email** account gain recovery — the path the website's help page already promises). |
| `POST /api/auth/rename` | bearer + new name | Renames in `profiles`, `players`, **and** rewrites the synthetic login email. |
| `POST /api/auth/parent-approve` | link token | Parent approves a child account's email (the link in the recovery email itself is built on romansgame.com — see §6). |

Supporting cast the website also uses: `/api/progress`, `/api/cards/*` — all keyed by the same user ID.

**Captcha reality (matters for §2/§6):** signup always expects a Turnstile token; sign-in only after
failures pile up. The functions verify the token server-side (`verifyTurnstile` in `authPolicy.js`),
and the production **site key's hostname allow-list is a Cloudflare dashboard setting** — code can't
prove play.romansgame.com is on it (see Open Questions).

---

## 2. Can the game use the same system?

**Yes — and the door was clearly built expecting it.** Differences are client-side, not a new backend.

Evidence:

- **CORS/origins are already handled.** `authCorsHeaders(origin)` → `allowedOrigin()` in
  `netlify/lib/authPolicy.js` returns the caller's origin for:
  `romansgame.com`, `www.romansgame.com`, **`play.romansgame.com`**, hub staging previews
  (`deploy-preview-N--romansgame-hub-staging.netlify.app`), and **game previews**
  (`GAME_PREVIEW_HOST = /^deploy-preview-\d+--romans-game\.netlify\.app$/`), plus localhost
  off-production. Responses carry `access-control-allow-headers: authorization, content-type` and
  `allow-methods: POST, OPTIONS`, and OPTIONS preflight is answered. Sessions travel in the
  **JSON body + `Authorization: Bearer` header — no cross-domain cookies anywhere**, so the
  cross-origin call from play.romansgame.com to romansgame.com is a plain fetch, not a cookie problem.
- **Caveat — branch previews:** the game's *branch* previews
  (`cooper-...--romans-game.netlify.app`, the URL Tony tests builds on) do **not** match
  `GAME_PREVIEW_HOST` (deploy-preview only). A one-line regex widening in `authPolicy.js`
  (website-side deploy) fixes testability; production origin already works.
- **Session landing in the game is the website's own trick:** take `session.access_token` /
  `refresh_token` from the response and call `sb.auth.setSession(...)` on the game's existing
  supabase-js client (the website does exactly this in `applyNameSession`). From that moment the game
  is in its world it already understands: `loadPlayer()` reads `players` by `session.user.id`,
  scores flush, `claim_unseen_card` RPC runs. `persistSession: true` is already set.
- **The game keeps a few things of its own:**
  - **Anonymous score queue** (localStorage, per-user keys) — unchanged; it already re-homes guest
    scores to whoever signs in.
  - **Its own Netlify functions** (`/api/*` on the game site: checkout, gifts, kit) — the game's
    `public/_redirects` sends `/api/*` to the **game's** functions, so the game must call the auth
    API by **absolute URL** (`https://romansgame.com/api/auth/...`), never a relative `/api/auth`.
    (Precedent exists: `subscribeNews` falls back to an absolute cross-origin POST to Kit.)
  - **Payments are untouched by this change** (see §6): the game's checkout functions don't read the
    player's identity at all today (verified: no auth/user references in
    `netlify/functions/create-checkout.ts`), and the website's adult-buying gate lives on the website.

**What exactly differs, game vs website client:**
1. Absolute vs relative API URLs (above).
2. The game needs a **Turnstile widget** for signup (and for sign-in after failures) rendered with the
   production site key — subject to the Cloudflare hostname question in §6.
3. The game currently speaks to Supabase directly for sign-in (`signInWithOtp`/`verifyOtp`); those two
   calls are replaced by fetches to the auth API + `setSession`. Everything downstream of a session
   (players row, scores, card RPC, queue) is **unchanged**.

---

## 3. THE SEAM — one account, or two?

**Today: two half-accounts that share a database but cannot find each other.** This is the heart of it.

**What is genuinely shared already:**
- One Supabase project, one `auth.users` table. A user ID minted by the game (OTP) and one minted by
  the website (password) are the same species of record.
- The **`players` table is the shared identity spine**: `id` = auth user ID (`supabase/schema.sql`),
  holding `display_name` + server-derived unique `public_name` (migration-002), `age_13_plus`,
  `marketing_opt_in`. Scores (`scores.player_id` — by user ID) and the Unseen card
  (`claim_unseen_card` RPC) hang off it.
- The website's **own signup already writes a `players` row** (`playerInsert` in `createAccount`) —
  so a website-born account is *already* game-ready at the data level: the first time that user signs
  into the game, `loadPlayer()` finds their row and their name is already there.
- Cards/progress on the website side are likewise keyed by the same user ID (website session's
  `user_id` drives `/api/progress` and `/api/cards/*`).

**Where the seam splits today:**

| | Game-born account (email code) | Website-born account (name + password) |
|---|---|---|
| `auth.users.email` | the player's **real email** | **synthetic** `name@players.romansgame.invalid` |
| Password | **none** (passwordless) | real bcrypt password in Supabase |
| `players` row | yes — created at the one-time name step | yes — created at signup |
| `profiles` row (website name directory) | **NO** | yes |
| `account_recovery` row | **NO** (the email is the login itself) | yes, if an email was given + verified |
| Website can sign them in? | **No** — no name in `profiles`, no password | n/a |
| Game can sign them in? | yes (code) | **No** — `signInWithOtp` to a synthetic `.invalid` address goes nowhere; the game has no password door |

**Collision cases, as they play out TODAY:**
- *Game player goes to the website and creates an account with the same email as the recovery email:*
  they get a **second, separate user ID**. Two identities: game scores/cards under ID #1, website
  cards/progress/purchases under ID #2. Nothing links them; nothing warns. (The website does have
  parent/child linking machinery — `parent_links`, `linkKidsByEmail` — but that's a parent↔child
  relationship, not a same-person merge, and it doesn't move scores or cards.)
- *Website player opens the game and types their email:* `signInWithOtp` happily creates a **brand-new
  OTP account** under that email (`shouldCreateUser: true`) — again a second identity, with a fresh
  `players` row and empty scores, while their real account sits untouched.
- *Name collisions:* the game's public leaderboard names (`players.public_name`, unique) and the
  website's login names (`profiles.name_normalized`, unique) are **two different uniqueness spaces**.
  Nothing stops "Dragon" the website login and "Dragon" the game public name being different people;
  conversely a website player's `players.display_name` is written from their website name at signup,
  so their game leaderboard name is pre-set from it.

**After Tony's change, done right, the seam closes like this:**
- One door (name+password API) for both sites; the game-born player **claims** their existing ID by
  adding the missing `profiles` row + password to the *same* user (see §4). No new ID is ever minted
  for an existing player, so scores, card, and leaderboard name carry by construction.
- The OTP door in the game is retired for sign-in (kept, at most, as the one-time claim bootstrap and
  as the website's existing email-code sign-in branch behind `signin` when the identifier is an email —
  that branch already exists server-side).

---

## 4. Migration — existing game players (email-code accounts)

**Least-pain path (recommended): claim-on-next-sign-in.**

1. Player opens the game, taps Sign in → the game checks (via `/api/auth/lookup` with their email, or
   a small dedicated probe) whether that email belongs to a **game-born** account with no password yet.
2. They prove it's theirs **once, the old way**: the emailed code (the flow they already know —
   `verifyOtp` gives a live session on the same user ID).
3. With that session live, they complete a one-time **"Give your account a name + password"** step:
   pick a player name (checked against `profiles` for availability; their existing leaderboard name
   can be offered as the default if free) and a password, tick the same age/terms answers **once**
   server-side (their in-game consent answers from the name step carry over as the pre-fill — see §5).
4. A **new small endpoint** (working title `POST /api/auth/claim`, bearer = the OTP session) does the
   server work in one transaction-ish pass: writes the `profiles` row, sets the password
   (`admin.updateUserById({ password })` — the same call the reset flow uses), **swaps the auth login
   email from the real email to the synthetic** `name@players.romansgame.invalid` (the same swap
   `renameAccount` already performs when a website user renames), records the real email as the
   **verified** recovery email in `account_recovery`, stamps age choice + flags.
   - The email swap is the step that makes the account *fully* website-shaped. It must happen
     atomically with the password set, and it's the one genuinely new backend behaviour in this whole
     project — it deserves its own tests.
5. From then on: name+password in the game **and** on the website, same account, same ID. The code
   door closes behind them.

**Fallbacks:**
- A player who never claims keeps playing as today during a grace period (OTP still works) — recommend
  keeping the claim prompt gentle and repeatable, not a hard wall, and deciding any hard cut-off as a
  separate later call.
- A game player who *already* made a separate website account (the §3 collision): **out of scope for
  v1, named honestly** — a true merge (moving scores/cards between IDs) is its own project. The claim
  flow should at least **detect** it (their recovery email already belongs to another ID) and stop with
  a plain "you have two accounts — write to support" message rather than creating a third.

**What could break (migration-specific):**
- **Mid-claim abandonment** (password set, email not yet swapped, etc.) → the endpoint must be
  idempotent and resumable: re-running claim on a half-claimed account finishes it instead of erroring.
- **Email swap vs live session:** changing `auth.users.email` under a live OTP session — the session
  itself is token-based and survives, but this exact sequence needs a live-fire test on a throwaway
  account before any real player touches it.
- **Leaderboard name mismatch:** if their game public name's base is taken as a *login* name by
  someone else, they pick a different login name — their **public leaderboard name does not change**
  (different column, different space). Copy in the claim screen must say that plainly or it will feel
  like losing their name.
- **Stay-signed-in expectations:** game sessions are already persistent localStorage sessions; after
  claim, refresh rotates through GoTrue as today. No cookie/domain issue (tokens, not cookies).

---

## 5. The build, sized honestly

**Overall: a real project, phased — think days of focused work per phase plus test time, not hours.**
The reuse is high (endpoints, email machinery, session plumbing, the game's downstream), but identity
work is exactly where "small" changes hide teeth, and Tony's rule applies: test copy first, his phone
check before anything merges.

### Phase 0 — Decisions + two verifications (before any code)
- Confirm the Cloudflare/Turnstile hostname allowance for the production site key covers
  `play.romansgame.com` (dashboard-only fact — Open Question Q1).
- Decide the branch-preview CORS widening (one line in `authPolicy.js`) so Tony can test game branch
  previews against the real API.
- Decide wording: the game's create screen must collect **name + password + confirm**, the age
  question, Terms, optional recovery email, optional newsletter — mirroring the website's one-door
  form (the chooser structure from this week's build carries over; the fields behind "Create account"
  change).
- Decide the under-13 shape in-game (parent email + approval, exactly as the website — the endpoint
  already enforces it; the game UI needs the parent screen it already has, rewired).

### Phase 1 — Game client: password door for *website-born* accounts (no migration yet)
- `src/cloud/cloud.ts`: add an auth-API client (absolute base `https://romansgame.com`), replace
  `sendMagicLink`/`verifyEmailCode` sign-in path with: sign-in (name+password → `setSession`),
  sign-up (→ `/api/auth/signup`, then `setSession`), refresh/sign-out alignment, keep
  `loadPlayer`/queue/scores/card exactly as they are.
- `src/cloud/CloudScores.tsx`: rework sheets — chooser stays; Sign in becomes name+password
  (+ "Forgot?" → recovery, §5 Phase 3); Create becomes name/password/confirm + age/terms +
  optional recovery email + newsletter. The existing keyboard/visual-viewport and
  "Visit romansgame.com" work from round 2 carries over untouched.
- Turnstile widget in the game (site key from `/api/auth/config`, the way the website fetches it).
- Test: harness parity (same pre-existing failure set), fresh-visit browser pass incl. keyboard
  states, website-born test account signs into the game and sees its name + a flushed score.

### Phase 2 — The claim (migration)
- New endpoint `POST /api/auth/claim` in `authHandler.ts` (+ function wrapper + `_redirects` line on
  the hub) implementing §4 step 4, with rate limits and audit events mirroring the other routes.
- Game UI: the claim sheet (name availability via `/api/auth/lookup`, password set, defaults from
  existing leaderboard name), the dual-account detection stop, resumability.
- Test: throwaway OTP account → claim → old code door closed, name+password works in **both** game
  and website, scores/card intact; abandon-mid-claim and retry; taken-name path; dual-account path.

### Phase 3 — In-game recovery (forgot → reset)
- "Forgot your password?" on the game's sign-in sheet → `/api/auth/recover/lost/start` (email) →
  code entry in-game → `/api/auth/recover/lost/code` → new password → `/api/auth/recover/lost/finish`.
  The emailed **link** lands on romansgame.com (the email link base is derived from the request that
  sends it — `requestEmailLinkBase(req)`; a game-originated start call needs care so the link and the
  code both stay usable; the code path is fully in-game regardless).
- Also in this phase: "Add a recovery email" for claimed/no-email accounts (`/api/auth/email-add`
  exists; game account sheet gains the row) — this is what makes Tony's "email for recovery" true for
  people who signed up without one.
- Test: full loop with a throwaway account, incl. wrong/expired code and the no-recovery-email
  message (which must say, as the website does, that name+password is the only key — and offer the
  support line).

### Phase 4 — Cut-over + cleanup (Tony's explicit go required)
- Retire the game's OTP sign-in entry points (keep the code only inside claim/recovery plumbing),
  retire the chooser build's now-dead email-code screens, update help copy in-game and on
  `accounts-help.html` (it currently describes the emailed code as "the backup" sign-in — that
  sentence changes), decide the legacy localStorage "Save with email" profile (system B in the
  BUILD.md map — already a known separate cleanup; this project should not silently absorb it, but
  the sign-in story gets more confusing if it lingers — flag for Tony).
- Grace-period call: how long un-claimed game accounts keep the code door.

### Consent/age handling under the new model (explicitly)
- Today the game records consent **only on the device** (localStorage `rg.cloud.consent.v1`) and the
  name step writes `age_13_plus: true` onto the `players` row. The website model records the age
  choice **server-side, permanently, locked** (`age_choices`), stamps `account_flags`
  (age confirmed, terms version), and **requires a parent email + approval for under-13**.
- Under the new model the game's create flow inherits the website's rules wholesale via the signup
  endpoint (it validates `age_choice` and `terms_accepted` server-side and refuses without them) —
  the game's local consent copy becomes a pre-fill, never the record. For claimants, their existing
  in-game 13+ attestation (they could not have a name without it) is the honest pre-fill for the
  one-time server stamp.

---

## 6. Risks & flags

- **Payments: NOT touched, verified.** Game checkout functions don't consult player identity;
  website buying stays adult-gated on the website as today; no payment code changes in any phase.
  One adjacent truth: a claimed child account signing into the game changes nothing about buying —
  the game's shop never had an account gate to begin with.
- **Cross-domain sessions: none.** Tokens in bodies/headers, `setSession` on both sides; no cookies
  cross romansgame.com ↔ play.romansgame.com. The one cross-domain surface is the recovery/verify
  **email links**, which are built from the sending request's base — game-originated emails need the
  link target decided deliberately (Phase 3).
- **Turnstile in the game** is the biggest unknown-shaped risk: if the production site key's
  Cloudflare hostname list doesn't include play.romansgame.com, the widget fails closed and
  **nobody can create an account in-game** until it's added (dashboard change — Tony/GB lane, same
  item already flagged for the website sheet). Sign-in is safer (captcha only after failures, and
  the backend has a proven-hash fallback path), signup is not.
- **Rate limits & lockouts are shared:** the API's per-name/per-IP failure budgets mean a kid
  fumbling a password in the game can lock the name for the website too, and vice versa. That's
  correct behaviour for one account, but support copy should expect it.
- **Name-space confusion** (§3): login names vs leaderboard public names are different uniquenesses.
  All claim/create copy must keep them straight or players will think their name was "taken" by
  themselves.
- **The stale-tree / deploy discipline:** Phase 2 touches the hub (new function) — it must ride the
  manifest-surgery path with `_redirects` asserted, functions by digest, exactly like the Nov 7
  deploys, or it will clobber the evening's auth work.
- **Session lifetime:** website sessions carry stay-signed-in absolute windows (`auth_devices`);
  game sessions are GoTrue defaults. Signing into the game via the API inherits the API's
  `stay_signed_in` semantics in the response — the game should pass `stay_signed_in: true` to match
  its current always-persistent behaviour. Small, easy to miss, test it.

---

## 7. Open questions (unknowable from code — named, not guessed)

- **Q1 (Cloudflare dashboard):** does the production Turnstile site key `0x4AAAAAAFfTs2hm1baT01HK`
  allow hostname `play.romansgame.com`? And is the widget in managed/non-interactive mode? (Same
  dashboard item already outstanding from the website ejection finding.)
- **Q2 (Supabase dashboard):** are OTP/magic-link sign-ups still enabled project-wide, and what is the
  email rate limit? The claim bootstrap depends on the code door staying alive at least until
  migration ends.
- **Q3 (data):** how many game-born accounts exist, and how many of them also have a `profiles` row
  (i.e., already dual)? A service-role count query answers it; it sizes the claim flow's importance
  and the dual-account stop. (Not run — scoping only, and it needs the service key.)
- **Q4 (policy, Tony's call):** grace period for un-claimed accounts, and whether the game's
  under-13 parent-approval emails should link to romansgame.com pages (as the endpoint builds them)
  or get game-branded copies.

---

## Appendix — evidence index (where each fact lives)

- Game OTP sign-in, session, players/scores/card plumbing: `game-auth-simplify-2026-11-07/src/cloud/cloud.ts`
  (`sendMagicLink`, `verifyEmailCode`, `savePlayerName`, `loadPlayer`, `syncCard`), `src/cloud/CloudScores.tsx`.
- Game schema (players.id = auth user; scores by user; public_name uniqueness): `supabase/schema.sql`,
  `supabase/migration-002-public-names.sql`, `supabase/migration-004-unseen-card.sql`.
- Synthetic login email: `rg-site-work/netlify/lib/authCrypto.ts` (`LOGIN_DOMAIN`, `loginEmail`).
- Real password credential + admin create + players/profiles/recovery writes:
  `rg-site-work/netlify/lib/authBackend.ts` (`createAccount`, `passwordGrant`, `setPassword`).
- Endpoint surface + payloads: `rg-site-work/netlify/lib/authHandler.ts` (routes, `signup`, `signin`,
  `recoverLost*`, `sessionBody`), client contract in `checkout-prod-build/site/js/accounts-config.js`,
  `accounts.js` (`postNameAuth`, `onNameSignIn`, `onNameSignUp`, `applyNameSession`), `js/auth-client.js`
  (`signupBody`).
- CORS allow-list incl. play.romansgame.com + game deploy previews: `rg-site-work/netlify/lib/authPolicy.js`
  (`allowedOrigin`, `GAME_PREVIEW_HOST`, `authCorsHeaders`).
- Game `/api/*` is the game's own functions: `game-auth-simplify-2026-11-07/public/_redirects`, `netlify.toml`,
  `netlify/functions/` (checkout has no identity use).
