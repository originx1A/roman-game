/** One-time answers stored on account_flags. A set timestamp is never cleared. */

export type AccountFlags = {
  ageConfirmedAt: string | null
  termsAcceptedAt: string | null
  termsVersion: string | null
  marketingOptIn: boolean
  marketingAnsweredAt: string | null
}

export function emptyAccountFlags(): AccountFlags {
  return {
    ageConfirmedAt: null,
    termsAcceptedAt: null,
    termsVersion: null,
    marketingOptIn: false,
    marketingAnsweredAt: null,
  }
}

export function accountFlagsBody(flags: AccountFlags) {
  return {
    age_confirmed_at: flags.ageConfirmedAt,
    terms_accepted_at: flags.termsAcceptedAt,
    terms_version: flags.termsVersion,
    marketing_opt_in: flags.marketingOptIn,
    marketing_answered_at: flags.marketingAnsweredAt,
  }
}

function sameFlags(left: AccountFlags, right: AccountFlags): boolean {
  return (
    left.ageConfirmedAt === right.ageConfirmedAt &&
    left.termsAcceptedAt === right.termsAcceptedAt &&
    left.termsVersion === right.termsVersion &&
    left.marketingOptIn === right.marketingOptIn &&
    left.marketingAnsweredAt === right.marketingAnsweredAt
  )
}

export function flagsChanged(left: AccountFlags, right: AccountFlags): boolean {
  return !sameFlags(left, right)
}

/** Accept a yes for 13+, a terms acceptance, and one marketing answer. Later calls cannot undo them. */
export function mergeAccountFlags(current: AccountFlags, body: Record<string, unknown>, nowIso: string): AccountFlags {
  const next: AccountFlags = { ...current }
  if (next.ageConfirmedAt == null && body.age_confirmed === true) next.ageConfirmedAt = nowIso
  if (next.termsAcceptedAt == null && body.terms_accepted === true) {
    const version = typeof body.terms_version === 'string' ? body.terms_version.trim() : ''
    if (version.length >= 1 && version.length <= 40) {
      next.termsAcceptedAt = nowIso
      next.termsVersion = version
    }
  }
  if (next.marketingAnsweredAt == null && typeof body.marketing_opt_in === 'boolean') {
    next.marketingOptIn = body.marketing_opt_in
    next.marketingAnsweredAt = nowIso
  }
  return next
}
