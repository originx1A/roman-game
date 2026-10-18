/**
 * Stripe Checkout wallets.
 *
 * `card` is what makes Apple Pay and Google Pay show up on the phone
 * (Face ID or fingerprint). A typed card stays on the page as the fallback.
 * Link is a one-tap saved payment, so it is off.
 * No Customer is created, and the card is not saved for a later one-tap buy.
 *
 * Apple Pay still needs the domain registered in the Stripe Dashboard.
 * That step is not done here. See the pull request notes.
 */
export const CHECKOUT_WALLETS = {
  payment_method_types: ['card'] as ['card'],
  payment_method_options: {
    card: { setup_future_usage: 'none' as const },
  },
  wallet_options: {
    link: { display: 'never' as const },
  },
  saved_payment_method_options: {
    payment_method_save: 'disabled' as const,
  },
}
