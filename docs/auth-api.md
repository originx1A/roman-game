# Auth API for the game login screen

Cooper’s screen calls these. This repo does not draw that screen. Primary sign-in is the player name and a password. Email is recovery only: a code to the address saved on the account. "Can't get in?" uses that address to show the player name and set a new password. The in-game email-code sheet (magic link and the code from that email) still works. Tony may keep it as an option.

Preview: `https://deploy-preview-63--romans-game.netlify.app`

`supabase/migration-013-account-flags.sql` is the script already applied in production as `migration_013_account_flags`. The app does not run it. It creates `public.account_flags` only. It does not alter tables from 001–009 and it does not write `players.age_13_plus`. `010` is `player_board`, so this file is not numbered 010.

`supabase/migration-014-age-and-owner.sql` is the next script for Tony to paste. It adds `age_choices`, `parent_email_holds`, and `payment_evidence`, and three columns on `account_flags`: `owner_role`, `owner_assumed_at`, `owner_email`. The app does not run it.

Every password, signup, recovery, and code call still sends `captchaToken` (or `turnstile_token`). Supabase Attack Protection checks it. This repo does not hold the captcha secret. A missing or rejected token is `403` `{error:"turnstile_required"}` and is not a wrong password. Reset the widget after every try.

`stay_signed_in` defaults to true. Sessions persist: access token about 1 hour, refresh through `POST /api/auth/refresh`. Stay on: 30 days idle or 90 days from sign-in. Stay off: 12 hours from sign-in. After `POST /api/auth/signin` or signup, keep both tokens and call `persistServerSession(access_token, refresh_token)` so this origin restores the same login. The storage key is `sb-oelsglmfkpzbueqysvdm-auth-token`.

## Sign in and sign up

`POST /api/auth/signin`

```json
{ "name": "Cool Kid", "password": "lantern-river-stone", "captchaToken": "...", "stay_signed_in": true }
```

`200` with `user_id`, public `display_name` (first word only), `session.access_token`, `session.refresh_token`, `stay_signed_in`, `absolute_until`, and `flags`.

`POST /api/auth/signup` is the same body plus required `age_choice` (`13_plus` or `under_13`) and optional `email` or `recovery_email`. Missing `age_choice` is `422` `{error:"age_required"}` and no account is created. There is no default. `13_plus` may save that address as their own recovery mailbox and a code is sent there. `under_13` does not save it and no mail goes to the child: the address is held until the parent opens the link in `POST` response field `parent_email_pending`. That link is `GET /api/auth/parent-approve?token=...`. Opening it saves the address as the kid's recovery email. It does not create a parent account and it does not allow purchases. An email alone is recovery only.

The login email inside Supabase is `<normalized-name>@players.romansgame.invalid`. The screen never shows or collects that address.

Errors: `401` `{error:"invalid_credentials"}` (unknown name, wrong password, and a banned account look the same), `409` `{error:"name_taken"}`, `429` `{error:"rate_limited"}`, `422` `name_rejected` or `weak_password` (with `hint`), `403` `{error:"turnstile_required"}`.

## One-time confirmations

`flags` on sign-in, sign-up, refresh, and `POST /api/auth/session`:

```json
{
  "age_confirmed_at": null,
  "terms_accepted_at": null,
  "terms_version": null,
  "marketing_opt_in": false,
  "marketing_answered_at": null,
  "owner_role": null,
  "owner_assumed_at": null,
  "owner_email": null
}
```

If `age_confirmed_at` is set, do not ask the 13+ question again on any device. If `terms_accepted_at` is set, do not ask for the terms again. If `marketing_answered_at` is set, do not ask the mail question again.

Send the answers on signup, sign-in, or `POST /api/auth/flags` with the bearer access token:

```json
{ "age_confirmed": true, "terms_accepted": true, "terms_version": "2026-10-20", "marketing_opt_in": false }
```

`age_confirmed: true` sets `age_confirmed_at` once. A later `false` does not clear it. A `13_plus` signup sets it. An `under_13` signup does not. Terms need `terms_version` (1–40 characters) or they are not stored. `marketing_opt_in` is stored only the first time it is a boolean. `POST /api/auth/flags` returns `{flags}` and `401` without a bearer token. The screen cannot set `owner_role`. That changes only when Stripe verifies a payment method, or when the card is removed.

Signup and `POST /api/auth/session` also return `age_choice`: `13_plus`, `under_13`, or `null` (unanswered). Unanswered is not under-13.

## Parent email, family, and the payment owner

`POST /api/auth/parent-email` with the bearer token, `captchaToken`, and `recovery_email` holds a parent address for an `under_13` account. `13_plus` is `403` `{error:"recovery_email_only"}` because that account saves its own recovery email. The hold is not a saved recovery address until the parent opens the link.

`POST /api/auth/family` with the bearer token is for a `13_plus` account that has its own email. `action` is `list`, `reset`, or `remove`. `reset` uses `child_user_id` and `new_password` and the same re-auth as parent recovery. `remove` sets the link to revoked. A kid account is `403` `{error:"not_parent"}`. When a `13_plus` account is created with an email that is already a kid's approved recovery address, those kids are linked onto this family list. Accepting a QR parent link does not require payments to be on.

Kid mode cannot buy. `flags.owner_role` becomes `adult` only after Stripe verifies a payment method (`checkout.session.completed` for a paid or setup session, or `payment_method.attached`). The time and the Stripe customer email are stored with the flag. `POST /api/payments/setup` starts card setup and does not charge. `POST /api/payments/remove` detaches the card and clears the flag, which returns the account to kid mode. Evidence (time, device, Stripe ids) is kept. The payment step shows: "This account is now yours. You're responsible for all purchases on it." The draft clause is `docs/terms-parent-purchases.md`. It is not on the live legal pages.

## Session check and logout

On load and when the window gains focus, the game calls `recheckSession()`. That refreshes a token that is inside a minute of expiry, then `POST /api/auth/session` with `Authorization: Bearer <access_token>` and body `{}`.

`200` is `user_id`, `display_name`, `flags`, `stay_signed_in`, `absolute_until`. `401` is `{error:"invalid_credentials"}` or `{error:"session_expired"}`. A network failure keeps the saved session.

Logout is `signOutEverywhere()`: `POST /api/auth/signout` with the bearer token and `{ "all_devices": true }`, then `signOut({ scope: 'global' })`. Other devices drop the session on their next load or focus. `204` on success. Sign-out of this device only remains `signOut()` (profile switch).

`POST /api/auth/refresh` with `{ "refresh_token": "..." }` returns a new session or `401` `{error:"session_expired"}`. Use this path. The Supabase client’s own refresh does not enforce the 30-day and 90-day limits.

## New or existing

`POST /api/auth/account`

```json
{ "name": "Cool Kid" }
```

`200` `{ "account": "existing" }` or `{ "account": "new" }`. An `email` field is ignored and is never looked up, so the response cannot tell anyone which addresses exist. A missing or illegal name is `422` `{error:"name_rejected"}` whether or not an email was sent. This route does not take a captcha token, so it does not use up the token sign-in needs. It is limited to 30 checks per IP per 15 minutes and 120 per IP per day. Over that, `429` `{error:"rate_limited"}`.

## Can't get in

This is the screen for a forgotten player name and a forgotten password. The button label is "Can't get in?". The player does not have to remember the name. Email stays the recovery address and is never shown as the player name.

1. The player enters the email address.
2. `POST /api/auth/recover/lost/start` with `{ "email", "captchaToken" }`.
3. The player enters the 6-digit code from that email.
4. `POST /api/auth/recover/lost/code` with `{ "email", "code", "captchaToken" }`.
5. The screen lists `accounts[].player_name`. A parent mailbox also lists linked kid accounts (`role` is `kid`). The player picks one `user_id` and types a new password.
6. `POST /api/auth/recover/lost/finish` with `{ "reset_token", "user_id", "new_password", "captchaToken" }`.
7. The response is a session for that same `user_id`. Keep both tokens and call `persistServerSession(access_token, refresh_token)`. Saved progress stays on that account.

Start always answers `202`:

```json
{ "ok": true, "message": "If that email is on an account, we sent a code" }
```

That sentence is the same when the address is unknown, misspelled, or not saved yet. Do not show a different line for those cases. An address that is only a held under-13 parent link (not approved yet) is not on an account, so no mail is sent, and the sentence stays the same.

The code step returns `200`:

```json
{
  "reset_token": "...",
  "accounts": [
    { "user_id": "...", "player_name": "Bright Fox", "role": "account" },
    { "user_id": "...", "player_name": "Cool Kid", "role": "kid" }
  ]
}
```

`player_name` is the full player name. It is not the email and not the part before `@`. `role` `kid` is a linked child on a parent mailbox, or an under-13 account that uses this address for recovery. Finish returns the usual session fields plus `player_name`. `display_name` on that session is still the public first word.

A code lasts 10 minutes. It is single-use. The first time it is accepted, it is consumed and the screen uses `reset_token` for the password step (also 10 minutes, single-use). One wrong entry invalidates the code immediately. Show `That code didn't work. Enter your email to get a new one.` and go back to the email step. The API returns `401`:

```json
{ "error": "code_invalid", "message": "That code didn't work. Enter your email to get a new one.", "step": "email" }
```

`step` is `email`. Asking for a new code invalidates any older code and any unused reset token for that mailbox. A weak new password is `422` `{error:"weak_password", hint}` and does not use up the reset token, so the player can type another password without going back. A missing captcha token is `403` `{error:"turnstile_required"}`.

Sends are limited to 3 per mailbox per hour and 10 recovery calls per IP per hour. Over that, `429` `{error:"rate_limited"}`. The limit response is the one case that does not use the sent-a-code sentence.

The older name routes still work for a player who knows the name: `POST /api/auth/recover/email/start` with `{ "name", "captchaToken" }` returns `202` `{ok:true}` whether or not that name has a recovery email, and `POST /api/auth/recover/email/finish` with `{ "name", "code", "new_password", "captchaToken" }` returns a session. Those codes follow the same single-use rule. The in-game email code (`sendMagicLink` / `verifyEmailCode`) is still available for the existing sheet.
