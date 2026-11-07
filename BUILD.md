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

*(filled in below as the runs complete — harness comparison, build, preview, browser checks)*
