# Name and password accounts

Migration `supabase/migration-009-accounts-auth.sql` is additive. Do not run it from the app or from CI. Tony or Cooper pastes it into the Supabase SQL editor after migration 008 is already applied. It creates new tables only. It does not alter `public.players` or any table from migrations 001–008.

`public.parent_links` has no `can_recover` column and this migration does not add one. An active parent link (`status = active`) is the recovery grant. It does not approve a payment.

`account_type` is not a column. `derived_account_type(player)` returns `adult` only when `payment_eligibility` has the attestation time, the terms time, the terms version, and a receipt email. Otherwise it returns `player`. Signup does not write that row. Age is not collected and `players.age_13_plus` is not written.

Cart tables (`carts`, `cart_items`) have no currency column. `POST /api/cart` is the writer. Prices live in `config/products.json` (a USD list for US buyers and a CAD list for everyone else). Both lists are empty until tokenomics. Adaptive Pricing is on in addition to that choice. See `docs/ACCOUNTS-CART.md`.

## Endpoints

The game host calls these. Cooper’s sign-in face should set `nameAuth.signIn` to `/api/auth/signin` and `nameAuth.signUp` to `/api/auth/signup`.

| Method and path | Success |
| --- | --- |
| `POST /api/auth/signup` | `201` with `user_id`, public `display_name` (first word), and `session.access_token` plus `session.refresh_token` |
| `POST /api/auth/signin` | `200` with the same session shape |
| `POST /api/auth/password/change` | `200 {ok:true}` and other sessions revoked |
| `POST /api/auth/recover/email/start` | `202 {ok:true}` whether or not the name exists |
| `POST /api/auth/recover/email/finish` | `200` with a session, or `401` |
| `POST /api/auth/recover/card` | `200` with a session and the new `qr_payload` |
| `POST /api/auth/recover/parent` | `200 {ok:true}` for an active parent link. No child session |
| `POST /api/auth/recovery-card/issue` | `200 {qr_payload}` |
| `POST /api/auth/refresh` | `200` with a new session, or `401` `{error:"session_expired"}` |
| `POST /api/auth/signout` | `204` |

Signup and sign-in accept `email` or `recovery_email`, and `captchaToken` or `turnstile_token`. `stay_signed_in` defaults to true. The face’s age checkbox is not part of the POST body and is ignored if sent.

Name accounts are created with the admin API and `email_confirm: true`. Confirm email is on for the project, and the synthetic `@players.romansgame.invalid` address is not a mailbox, so it must be confirmed at create time.

## Session length

Supabase is on the Free plan. Time-box and inactivity timeout are Pro-only and stay at 0 (never). This server enforces the limits instead.

Each sign-in writes an `auth_devices` row: `created_at` is the start, `last_seen_at` moves on `POST /api/auth/refresh` and on the bearer `/api/auth/*` calls. Stay signed in (the default): 30 days idle or 90 days from `created_at`, whichever comes first. Stay off: 12 hours from `created_at`. A row past either limit is revoked with `admin.signOut` and the call returns `401 {error:"session_expired"}`.

Cooper should refresh through `POST /api/auth/refresh` with `{refresh_token}`, not the Supabase client’s automatic refresh. The automatic path talks to Supabase directly, and the Free plan will not expire it.

Errors the face already matches: `401` `{error:"invalid_credentials"}` (unknown name, wrong password, and a banned account look the same), `409` `{error:"name_taken"}`, `429` `{error:"rate_limited"}`. `422` is `name_rejected` or `weak_password` (with `hint`). `403` is `{error:"turnstile_required"}`.

## Turnstile

Public site key, committed for the client: `0x4AAAAAAFfTs2hm1baT01HK`.

Hostnames already on the widget: `romansgame.com`, `play.romansgame.com`, `www.romansgame.com`, and the PR #67 preview. The PR #63 preview hostname that still needs adding is `deploy-preview-63--romans-game.netlify.app`.

`GET /api/auth-config` returns `turnstileSiteKey` and `turnstileHosts`. The existing passkey, Google, and VAPID fields are unchanged.

Tony has already stored the Turnstile secret in Supabase Auth → Attack Protection. This repo does not contain that secret and does not ask Cloudflare to check the token. Password grants, magic-link sends, and email-code checks pass the browser token through as `options.captchaToken`. Supabase accepts or rejects it. A captcha rejection is `403` and is not counted as a wrong password. The widget resets after every try because a token is single-use.

Signup requires a token before creating the user, then signs in with that same token. If Supabase rejects it, the new user is deleted. Sign-in requires a token on every attempt. Recovery start only checks that a token is present, because a Turnstile token is single-use and finish needs a fresh one. The purchase password check (`/api/purchase-reauth`) forwards `captchaToken` or `turnstile_token` the same way.

## What Tony clicks in Supabase

Auth → Sessions (Free plan):

- JWT expiry `3600` seconds, if that control is available
- Leave time-box and inactivity at 0. They are Pro-only and this server enforces 30 days idle / 90 days absolute
- Refresh token rotation on
- Reuse interval short (10 seconds is enough)

Redirect allow list:

- `https://romansgame.com/**`
- `https://www.romansgame.com/**`
- `https://play.romansgame.com/**`
- the PR preview, `https://deploy-preview-*--romans-game.netlify.app/**`
- `https://*--romansgame-hub-staging.netlify.app/**`

Attack Protection already has the Turnstile secret. Do not paste that secret into the repo or into a Netlify env var for these functions.

Optional Netlify env: `AUTH_PEPPER` (hashes for IPs, user agents, and email codes). If it is unset, the code uses the non-secret prefix `rg-auth-v1`, which is not a pepper. Set a long random value before production. `RESEND_API_KEY` sends recovery codes from `Roman's Game <support@romansgame.com>`. If it is unset, signup still succeeds and the code is not emailed.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are the existing function env vars. The publishable key already in the repo is not a secret.
