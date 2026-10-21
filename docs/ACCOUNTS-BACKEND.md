# Accounts and payments backend (test mode)

This is the server half of accounts, gifts, and checkout. Cooper builds the website, shop, help, and legal pages. Nothing here turns on live charges. `CHECKOUT_TEST_ONLY` in `netlify/lib/coinPacks.ts` stays `true`.

Do not run `supabase/migration-008-accounts-payments.sql` against the live project from an app or a script. Paste it in the Supabase SQL editor only after the checklist below. Do not apply the old draft `migration-005-coin-ledger.sql` from `cursor/stage1-economy-gates-99cc` (it was marked not applied and uses a different `player_saves` shape).

## What the server enforces

- Payments start off. `enable-payments` turns them on only after an adult (age of majority) attestation, a receipt email, and the terms tick. The time is stored. The email is the only new contact field, and only on `account_payments`.
- `players.age_13_plus` is read and never written. If it is not true, payments stay off. This migration does not add columns to `public.players`.
- Every checkout path (`create-checkout`, `confirm-checkout`, and the coin-credit claim) refuses a signed-out player, a parent lock, or payments that are off.
- `create-checkout` also requires a fresh per-purchase token from `purchase-reauth` or passkey `purchase-verify`. That check cannot be switched off. A `skipReauth` field in the body is ignored. There is no daily spending cap.
- A linked parent can turn payments off with the parent's own re-auth. The child cannot turn them back on. The parent can turn them on again; they come back only if the adult attestation is already stored.
- A child can have at most two pending or active parents. The child cannot delete or edit the parent's account. Accepting a link requires the parent account to already have payments on.
- Gift codes do not expire. They work once, bind to the first account that redeems them, and the buyer can cancel one before it is used. A refund or dispute voids the code. If it was already redeemed, the item and its coins are taken back on the server.
- Checkout is test mode only. A live Stripe secret is refused. Live webhook events are ignored.
- EU, EEA, and UK checkouts are refused when `x-country` or `cf-ipcountry` is one of those codes. If the header is missing, checkout is not blocked for that reason. Play is unaffected.
- Passkeys are registered for `romansgame.com`, so `play.romansgame.com` and later subdomains share them.
- The server does not store card numbers, billing addresses, or a switch that skips the purchase check. Stripe collects the billing address. Link stays off so a saved-card button cannot skip the phone check.

`public.save_progress` is not defined in migrations 001–007 or anywhere else in this repository. Migration 008 does not replace an existing function of that name. If the live database already has `save_progress`, the script leaves it unchanged. If it does not, the script creates `save_progress(profile_id text, blob jsonb, chapters jsonb, videos jsonb, cards jsonb)`, which writes only `player_saves` and `site_progress` for `auth.uid()`. The Netlify route `/api/save-progress` writes those same two tables with the service role and does not drop or alter the RPC.

## Env vars

Set these in Netlify. Never commit them and never log them.

| Name | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | yes | Stripe secret. Test mode accepts only a test key (`sk_test_...`, or a restricted test key `rk_test_...` / `rkcs_test_...`). A live key returns 503. |
| `STRIPE_WEBHOOK_SECRET` | yes | Signing secret for `/api/stripe-webhook` (`whsec_...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role for the new tables, coin credit, and revocation. Bypasses RLS. |
| `SUPABASE_URL` | no | Defaults to the romans-game project URL already in `netlify/lib/supabaseAdmin.ts`. |
| `URL` or `DEPLOY_PRIME_URL` | set by Netlify | Success and cancel URLs for Checkout. |

`ROMAN_OWNER_KEY` is only for the existing owner gift tool. Paid gift codes do not use it.

## Stripe dashboard (test mode)

Tony's test account is `acct_1UCGtsAn9Kkm2MZQ`. Do this in **test mode**, not live mode.

1. Settings → Payment methods: turn **Link off**. Leave **card** on. Apple Pay and Google Pay are wallets on the card method once the domain is verified.
2. Settings → Payments → Apple Pay: add and verify **`romansgame.com`** (the parent domain, not only `play.romansgame.com`). Google Pay uses the same card setup.
3. Developers → Webhooks → add endpoint `https://play.romansgame.com/api/stripe-webhook`.
   Events: `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`.
   Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Do not enable Stripe Link in a payment-method configuration. The Checkout session also sends `excluded_payment_method_types: ['link']` and `wallet_options.link.display = 'never'`.
5. The session asks the bank for 3D Secure whenever the card supports it (`request_three_d_secure: any`). The bank still decides whether to show a challenge. Billing address is required. The card is not saved for a later charge.

Checkout does not send a fixed list of payment method types, so Stripe uses that dashboard list (automatic / dynamic methods).

## Coin packs vs the Stripe test catalog

Checked 2026-10-21 in test mode. Active products on the account are Ringbreeze plans, not Roman's Game. The only Roman products are **inactive** and priced in **USD**:

| Stripe product | Id | Price | Amount | Active |
| --- | --- | --- | --- | --- |
| Coin Bag (500 coins) | `prod_VJzgJyJa7SLxsp` | `price_1UJLh9An9Kkm2MZQtJMOL1aR` | 499 USD | no |
| Coin Vault (3000 coins) | `prod_VJzkKFHyKMD9nv` | `price_1UJLkcAn9Kkm2MZQUd69PXd5` | 1999 USD | no |

The game charges the CAD list in `src/game/shopOffers.ts` via Checkout `price_data`. It does **not** use those Price ids.

| Pack id | Coins | CAD cents | Stripe test catalog |
| --- | --- | --- | --- |
| `coins_500` | 500 | 199 | USD 499 exists, inactive, different amount and currency |
| `coins_1400` | 1400 | 499 | no product |
| `coins_3200` | 3200 | 999 | no product (the inactive vault is 3000 coins at USD 1999) |
| `starter` | 300 | 299 | no product |
| `adventurer` | 1000 | 699 | no product |
| `stable` | 2500 | 1499 | no product |

Before live mode, create active CAD products (or Prices) that match this list and switch Checkout off ad-hoc `price_data` only when Tony says to. Do not reactivate the USD prices. Native App Store / Play product ids in `src/game/iap.ts` are a separate list and are not used by this backend.

## Endpoints

All routes are `POST` unless noted. Send `Authorization: Bearer <access token>` except the webhook and gift-code show is still authenticated. Bodies are JSON.

### `POST /api/enable-payments`

`{ "adult": true, "terms": true, "email": "parent@example.com" }`

Stores the receipt email, terms time (`terms_version` `2026-10-20`), and adult time, then sets `payments_enabled`. Refuses a parent lock, a missing adult tick, a bad email, or `age_13_plus` not true. Does not write `public.players`.

### `POST /api/purchase-reauth`

`{ "method": "pin" | "picture" | "password", "secret": "..." }`

Returns `{ "reauthToken", "expiresAt" }` for ten minutes, one purchase. `open` profile locks (no PIN set) do not count. Password works only for a real mailbox, not `@link.romansgame.invalid`.

Passkey: `POST /api/passkey` with `{ "action": "purchase-options" }`, then `{ "action": "purchase-verify", "ticket", "response" }`. That returns the same `reauthToken`. Relying party id is `romansgame.com`.

### `POST /api/create-checkout`

`{ "packId": "coins_500", "reauthToken": "...", "gift": false }`

`gift: true` mints a code for someone else instead of granting the pack to the buyer. Refuses live keys, payments off, parent lock, under-13, EU/UK when the geo header says so, a missing or used re-auth token, and a second Starter Pack. The price is the server CAD amount. Success URL is the site `/?checkout=success&session_id={CHECKOUT_SESSION_ID}`.

### `POST /api/confirm-checkout`

Existing coin return path. Now requires a signed-in account with payments on and no parent lock. Does not ask for a second re-auth token (the purchase already happened).

### `POST /api/coin-credit`

Claim path: same payments gate as confirm. If the purchase was revoked or blocked, the claim is refused. The first claim after the webhook still returns `duplicate: false` so the device can apply treats once (`device_claimed_at`). The legacy signed webhook branch still records `stripe_receipts` only. Point Stripe at `/api/stripe-webhook` for grant and revoke.

### `POST /api/stripe-webhook`

Stripe signature required. Test mode ignores live events.

- `checkout.session.completed` (paid, CAD amount matches the pack): records a purchase and an entitlement, credits coins with `apply_stripe_credit` (idempotent on the session id). `purpose=gift` mints a code and does not credit the buyer. The code is not in the webhook response.
- `charge.refunded` and `charge.dispute.created`: mark the purchase revoked, revoke the entitlement, subtract coins with `revoke_stripe_coins`, and void the gift code. A code that was already redeemed loses the item on the redeemer's account.

### `POST /api/redeem-gift-code`

- `{ "action": "redeem", "code": "GIFT-XXXX-XXXX" }` binds the code to this account. No card. No expiry check.
- `{ "action": "show", "sessionId": "cs_test_..." }` returns the code to the buyer who paid for it, until it is redeemed or voided.
- `{ "action": "cancel", "code": "..." }` the buyer cancels an unused code.

Owner `ROMA-` codes in the blob store are unchanged.

### `POST /api/parent-link`

- `{ "action": "create" }` the child gets `{ token, inviteUntil }`. The invite lasts 72 hours. The parent relationship does not. Put the token in a QR as `https://play.romansgame.com/?parent=<token>`.
- `{ "action": "accept", "token": "..." }` the parent must have payments on and must not be parent-locked. Max two parents.

### `POST /api/parent-payments`

`{ "childId", "action": "off" | "on", "reauthToken" }`

Caller must be an active parent of that child. Uses the parent's re-auth token, not the child's.

### `POST /api/recovery-code`

- `{ "action": "issue" }` returns a `SAVE-XXXX-XXXX` code once. Stored as a hash. No end date. At most five unused codes.
- `{ "action": "redeem", "code" }` one use. Returns a Supabase magic-link `token_hash` for that account. Does not reveal a password.

### `GET` and `POST /api/save-progress`

`POST { "profileId", "blob", "chapters", "videos", "cards" }` upserts `player_saves` and `site_progress` for `(player_id, profile_id)`. `profileId` is `[A-Za-z0-9_-]{1,64}`. The blob is rejected if it contains an email address or is over 256 KB. `GET ?profileId=` reads them back.

The client helper is `migrateLegacySaveKeys` in `src/game/namespacedSave.ts`. Call it when a profile becomes active. It copies keys such as `roman.wallet.v1` to `roman.<player id>.<profile id>.wallet.v1` and deletes the old key so the next person on the device does not inherit it. `rg.profiles.v1` and `rg.profiles.active` stay put (they are the account picker).

Direct RPC, when this migration created it (it will not if one already exists):

```text
save_progress(profile_id, blob, chapters, videos, cards)
```

Scores still go through `submit_score` / `public.scores`. This path does not write `public.players`.

## Cooper's read-only check before migration 008

Run these in the SQL editor as read-only. Do not apply 008 until they match. Do not run them from the game.

PR #59 migrations that must already be applied, in order:

1. `supabase/migration-005-leaderboard.sql` — `public.public_scores` includes `daily_date` and hides `practice`.
2. `supabase/migration-006-social.sql` — friends, passkeys, `profile_locks`, `player_balances`, `player_items`, `stripe_receipts`, `apply_stripe_credit`, `submit_score`.
3. `supabase/migration-007-cad-shop.sql` — `stripe_receipts` coins check is `(300, 500, 1000, 1400, 2500, 3200)` and `apply_stripe_credit` allows those amounts.

```sql
-- 005
select pg_get_viewdef('public.public_scores'::regclass);
-- expect daily_date in the select list, and mode distinct from practice

-- 006
select to_regclass('public.player_balances') as balances,
       to_regclass('public.passkeys') as passkeys,
       to_regclass('public.profile_locks') as locks,
       to_regclass('public.stripe_receipts') as receipts,
       to_regclass('public.player_items') as items;

-- 007
select pg_get_constraintdef(oid)
from pg_constraint
where conname = 'stripe_receipts_coins_check';
-- expect coins in (300, 500, 1000, 1400, 2500, 3200)

-- save_progress, before 008
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'save_progress';
-- zero rows: 008 will create save_progress(text, jsonb, jsonb, jsonb, jsonb)
-- one or more rows: 008 will not replace that function

-- player_saves must not be the unapplied draft shape
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'player_saves'
order by ordinal_position;
-- no rows, or player_id + profile_id. Stop if the only key column is user_id.

-- players columns, note them and compare after 008 (no new column)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'players'
order by ordinal_position;
```

After 008, `public.players` column list is unchanged. New tables: `account_payments`, `parent_links`, `purchase_reauths`, `purchases`, `entitlements`, `gift_codes`, `recovery_codes`, `player_saves`, `site_progress`, `coin_reversals`, `stripe_events`.

## Test purchase checklist

Use Stripe **test mode** and card **4242 4242 4242 4242**. Any future expiry, any 3-digit CVC, any postal code. Do not use a real card.

1. Env vars above are set. Migration 008 is applied on a non-production database first.
2. Sign in as an account with `age_13_plus` true. Call `enable-payments` with `adult: true`, `terms: true`, and a receipt email.
3. Call `purchase-reauth` (or the passkey purchase actions) and then `create-checkout` with that `reauthToken` and `packId: "coins_500"`.
4. Pay on the Stripe page with 4242 4242 4242 4242. Confirm Link is not offered. Billing address is required.
5. Optional 3DS challenge card: **4000 0027 6000 3184**.
6. Webhook `checkout.session.completed` grants the pack. Open `/?checkout=success&session_id=cs_test_...` while signed in so the device can apply treats once.
7. In the test dashboard, refund the payment. `charge.refunded` revokes the entitlement and the server coins.
8. Buy with `"gift": true`. `redeem-gift-code` `action: "show"` returns `GIFT-...`. A second account redeems it. A third account cannot. The code still works if you wait (no end date). Refunding voids it.
9. Link a parent (`parent-link` create / accept). Parent calls `parent-payments` `action: "off"` with the parent's re-auth. The child `create-checkout` and `enable-payments` both fail until the parent turns payments on.
10. Issue a `SAVE-` code, redeem it once, and confirm the second redeem fails.

Apple Pay and Google Pay in test mode also need a wallet set up on a device and the domain verification in step 2 of the dashboard list. The 4242 card is enough to prove the gate, the webhook, and the gift code.

## Before live mode

- Leave `CHECKOUT_TEST_ONLY` true until Tony says otherwise. This PR does not flip it.
- Apply migration 008 only after the read-only checklist. Never from the client.
- Create the missing CAD products. Do not turn the inactive USD prices back on.
- Webhook endpoint and events on the live endpoint, Link off, Apple Pay domain `romansgame.com`.
- Cooper: shop is a neutral price list only for accounts with payments on. No buy prompts, banners, or offers aimed at kids (Quebec). French terms before Quebec sales, or keep Quebec checkout off.
- Checkout disclosure (business name, mailing address that is not a home address, phone, email, CAD total, refund policy) is UI plus Stripe branding, not this API.
- Receipt email is transactional. No marketing mail from these endpoints.
- The parent-link "small card charge" from the COPPA note is not built. Linking currently requires the parent's payments to already be on.
- Server coin revocation does not by itself edit the on-device wallet. The claim path tells the device the first time; a later refund needs the client to re-read the server balance.
- EU/UK stay off until a representative and a DPIA exist. Confirm Netlify sends `x-country` in production so the block actually runs.
- Privacy policy, terms, refund copy, and the kids/parents help page are Cooper's, reviewed by Tony before launch.
