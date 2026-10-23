/**
 * Public Turnstile site key. Safe to ship to the browser.
 * The secret is in Supabase Auth → Attack Protection. It is not in this repo.
 * Supabase checks the token when a call passes options.captchaToken.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFfTs2hm1baT01HK'

export const TURNSTILE_HOSTS = ['romansgame.com', 'play.romansgame.com', 'www.romansgame.com'] as const

/** Cloudflare client code: this page's hostname is not on the widget. */
export function turnstileHostMessage(code: string | null): string | null {
  if (code === '110200') return "This address isn't on the captcha list."
  return null
}
