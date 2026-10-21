# Cart

`POST /api/cart` checks a cart and, once prices exist, opens one Stripe Checkout Session.

The body is `{items:[{sku, qty}], gift?:{mode:'linked_child'|'code', child_user_id?}, reauth_token}`. A price or currency sent by the browser is ignored.

Rules:

- SKUs come from `config/products.json`. An unknown SKU is `422 unknown_sku`.
- Quantity is 1–5. Six is `422 bad_qty`. More than 10 lines is `422 too_many_lines`.
- `starter_bundle` must be quantity 1. A second one is `409 starter_owned` if the account already has the starter entitlement (`starter` or `starter_bundle`) or a pending cart still holds it.
- US (`x-country: US` or `cf-ipcountry: US`) uses the USD list. Every other country, and a missing country, uses the CAD list.
- Both lists ship with `unitAmount: null` and an empty `stripePriceId`. A cart that is otherwise valid returns `409 prices_not_ready`. No amount is invented, and Stripe is not called.
- When a list has amounts and Stripe price ids, the handler writes a `pending` cart (30 minutes), then creates one Checkout Session with `adaptive_pricing.enabled`, those price ids, `metadata.cart_id` and `metadata.user_id`, and `client_reference_id` set to the cart id. The same payment gate as the existing pack checkout still applies (signed in, payments on, re-auth). Link and wallets are not turned off on this session.

The existing `POST /api/create-checkout` pack route is unchanged. It still sells the current test-mode coin list. This cart does not copy those amounts.

Coins are still credited only from the Stripe webhook. This route does not grant coins.
