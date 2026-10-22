# Auth API for the game login screen

Cooper’s screen calls these. This repo does not draw that screen. Primary sign-in is the player name and a password. Email is recovery only: a code to the address saved on the account. The in-game email-code sheet (magic link and the code from that email) still works. Tony may keep it as an option.

Preview: `https://deploy-preview-63--romans-game.netlify.app`

Apply `supabase/migration-010-account-flags.sql` in the Supabase SQL editor after migration 009. The app does not run it. It creates `public.account_flags` only. It does not alter tables from 001–009 and it does not write `players.age_13_plus`.

Every password, signup, recovery, and code call still sends `captchaToken` (or `turnstile_token`). Supabase Attack Protection checks it. This repo does not hold the captcha secret. A missing or rejected token is `403` `{error:"turnstile_required"}` and is not a wrong password. Reset the widget after every try.

`stay_signed_in` defaults to true. Sessions persist: access token about 1 hour, refresh through `POST /api/auth/refresh`. Stay on: 30 days idle or 90 days from sign-in. Stay off: 12 hours from sign-in. After `POST /api/auth/signin` or signup, keep both tokens and call `persistServerSession(access_token, refresh_token)` so this origin restores the same login. The storage key is `sb-oelsglmfkpzbueqysvdm-auth-token`.

## Sign in and sign up

`POST /api/auth/signin`

```json
{ "name": "Cool Kid", "password": "lantern-river-stone", "captchaToken": "...", "stay_signed_in": true }
```

`200` with `user_id`, public `display_name` (first word only), `session.access_token`, `session.refresh_token`, `stay_signed_in`, `absolute_until`, and `flags`.

`POST /api/auth/signup` is the same body plus optional `email` or `recovery_email`. That address is the recovery mailbox. It is not the login. `201` returns the same session shape and signs them in.

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
  "marketing_answered_at": null
}
```

If `age_confirmed_at` is set, do not ask the 13+ question again on any device. If `terms_accepted_at` is set, do not ask for the terms again. If `marketing_answered_at` is set, do not ask the mail question again.

Send the answers on signup, sign-in, or `POST /api/auth/flags` with the bearer access token:

```json
{ "age_confirmed": true, "terms_accepted": true, "terms_version": "2026-10-20", "marketing_opt_in": false }
```

`age_confirmed: true` sets `age_confirmed_at` once. A later `false` does not clear it. Terms need `terms_version` (1–40 characters) or they are not stored. `marketing_opt_in` is stored only the first time it is a boolean. `POST /api/auth/flags` returns `{flags}` and `401` without a bearer token.

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

## Email recovery

`POST /api/auth/recover/email/start` with `{ "name", "captchaToken" }` returns `202` `{ok:true}` whether or not that name has a recovery email.

`POST /api/auth/recover/email/finish` with `{ "name", "code", "new_password", "captchaToken" }` returns a session or `401`.

The code lasts 10 minutes. Five wrong tries burn it. The in-game email code (`sendMagicLink` / `verifyEmailCode`) is still available for the existing sheet.
