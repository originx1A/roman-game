# Terms draft — payment owner (not live)

Status: draft for Tony. This is not the live Terms. Do not publish it, and do not copy it into the privacy page or the in-game legal line, until Tony approves the wording.

## Recovery email

An email address saved on an account is for recovery only. It does not permit purchases. A parent email on a kid account is the recovery address for that account. It does not make the sender the owner and it does not let the kid account spend.

## Who owns charges

Whoever adds a payment method, once Stripe and the card network have verified that payment method, is the legal owner of that account. The account is then marked owner = adult. The flag, the time it was set, and the email Stripe collected are stored on the account. That person is responsible for all charges on the account, including purchases made by anyone they let use the device.

At the payment step the account shows this notice:

> This account is now yours. You're responsible for all purchases on it.

There is no separate checkbox. Typing an email does not accept this clause and does not turn spending on.

## Use of the device

Authorized use by anyone the owner lets use the device isn't refundable. Leaving the account signed in on a child's device is the owner's choice. Charges made while it stays signed in are the owner's charges.

## Disputes

Roman's Game keeps Stripe evidence for disputes: the time a payment method was attached or removed, the device that did it, and the Stripe customer and payment-method identifiers. Card numbers are not stored in the account database.

## Removing the card

Removing the card returns the account to kid mode. Kid mode cannot make purchases. A later verified payment method sets owner = adult again. Evidence of the earlier card stays on file.
