import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TURNSTILE_SITE_KEY, turnstileHostMessage } from '../src/game/turnstileSite.ts'

test('a hostname rejection from Turnstile has its own sentence', () => {
  assert.equal(turnstileHostMessage('110200'), "This address isn't on the captcha list.")
  assert.equal(turnstileHostMessage('110100'), null)
})

test('the public site key is the shared widget key and is not a secret', () => {
  assert.equal(TURNSTILE_SITE_KEY, '0x4AAAAAAFfTs2hm1baT01HK')
  assert.match(TURNSTILE_SITE_KEY, /^0x[A-Za-z0-9_-]{20,}$/)
  const widget = readFileSync(new URL('../src/cloud/useTurnstile.ts', import.meta.url), 'utf8')
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/)
  assert.equal(widget.includes('siteverify'), false)
  assert.equal(widget.includes('TURNSTILE_SECRET'), false)
})

test('magic link and email code both send the captcha token and reset the widget', () => {
  const source = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
  assert.match(source, /signInWithOtp\(\{[\s\S]*captchaToken/)
  assert.match(source, /verifyOtp\(\{[\s\S]*captchaToken/)
  assert.match(source, /sentCaptcha/)
  const sheet = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
  assert.match(sheet, /sendMagicLink\(address, token\)/)
  assert.match(sheet, /verifyEmailCode\(sentEmail \|\| signInEmail\(email\), digits, token\)/)
  assert.match(sheet, /captcha\.reset\(\)/)
  const purchase = readFileSync(new URL('../netlify/functions/purchase-reauth.ts', import.meta.url), 'utf8')
  assert.match(purchase, /options:\s*\{\s*captchaToken\s*\}/)
})
