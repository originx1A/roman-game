/** What Supabase Auth returned. Only the fields the sign-in sheet needs. */
export interface AuthFailure {
  message?: string
  code?: string
  status?: number
}

const GENERIC_SEND = "Couldn't send the link. Check the email and try again."

/**
 * Plain sentence for a failed magic link or email code.
 * Known failures get a fixed sentence. Anything else keeps the server's own words,
 * so a new failure is not hidden behind the generic line.
 */
export function explainSignInError(error: AuthFailure | null | undefined, fallback = GENERIC_SEND): string {
  const message = error?.message?.trim() ?? ''
  const code = (error?.code ?? '').toLowerCase()
  const blob = `${code} ${message}`.toLowerCase()
  if (blob.includes('captcha')) {
    return "Sign-in is blocked by a captcha check. This page doesn't send one."
  }
  if (error?.status === 429 || code.includes('over_email_send_rate_limit') || /rate limit|too many requests|over_request_rate_limit/.test(blob)) {
    return 'Too many tries, wait a few minutes.'
  }
  if (/redirect/.test(blob) && /not allowed|invalid|mismatch/.test(blob)) {
    return "This page isn't allowed to receive the sign-in link."
  }
  if (/signups? not allowed|signup_disabled/.test(blob)) return 'New sign-ups are turned off.'
  if (/error sending (confirmation|magic link|recovery|otp) email|error sending email/.test(blob)) {
    return 'The email service refused to send. Try again in a few minutes.'
  }
  if (message && message.length <= 180) return message
  return fallback
}
