/**
 * Public Turnstile site key. Safe to ship to the browser.
 * The secret stays in Supabase Auth → Attack Protection. It is not in this repo.
 * Same key as the accounts branch (src/game/turnstileSite.ts there).
 * Supabase checks the token when a call passes options.captchaToken.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFfTs2hm1baT01HK'

/** Hosts Cooper listed for this widget. A preview host has to be added in Cloudflare too. */
export const TURNSTILE_HOSTS = ['romansgame.com', 'play.romansgame.com', 'www.romansgame.com'] as const

/** Cloudflare client code: this page's hostname is not on the widget. */
export function turnstileHostMessage(code: string | null): string | null {
  if (code === '110200') return "This address isn't on the captcha list."
  return null
}
