# Cart

`POST /api/cart` checks a cart and, once prices exist, opens one Stripe Checkout Session.

The body is `{items:[{sku, qty}], gift?:{mode:'linked_child'|'code', child_user_id?}, reauth_token}`. A price or currency sent by the browser is ignored.

Rules:

- SKUs come from `config/products.json`. An unknown SKU is `422 unknown_sku`.
- Quantity is 1–5. Six is `422 bad_qty`. More than 10 lines is `422 too_many_lines`.
- `starter_bundle` must be quantity 1. It can be bought again. The price follows how many Starters the receiving account already has: C$2.99 / US$1.49, then C$3.49 / US$1.99, then C$4.49 / US$2.49. The contents stay 8,000 coins and 5 treats. A linked child is the receiving account. A gift code has no account yet, so it uses the first price. Quantity 2 is `422 starter_qty`.
- US (`x-country: US` or `cf-ipcountry: US`) uses the USD list. Every other country, and a missing country, uses the CAD list.
- Both lists ship with `unitAmount: null` and an empty `stripePriceId`. A cart with an unpriced non-Starter line returns `409 prices_not_ready` and Stripe is not called. A Starter line is priced in code, so it does not need a Stripe price id.
- When every line is ready, the handler writes a `pending` cart (30 minutes), then creates one Checkout Session with `adaptive_pricing.enabled`, `metadata.cart_id` and `metadata.user_id`, and `client_reference_id` set to the cart id. A line with a Stripe price id is sent as that price. A Starter line is sent as `price_data` at the stepped amount. The same payment gate as the existing pack checkout still applies (signed in, payments on, re-auth). Link and wallets are not turned off on this session.

`POST /api/create-checkout` prices a Starter the same way for the signed-in account. A gift on that route uses the first price. Other packs stay on their one Canadian amount. This cart does not copy those pack amounts.

Coins are still credited only from the Stripe webhook. This route does not grant coins.
