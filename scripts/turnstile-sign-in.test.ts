import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { TURNSTILE_SITE_KEY, turnstileHostMessage } from '../src/game/turnstileSite.ts'

test('a hostname rejection from Turnstile has its own sentence', () => {
  assert.equal(turnstileHostMessage('110200'), "This address isn't on the captcha list.")
  assert.equal(turnstileHostMessage('110100'), null)
})

test('the public site key matches the accounts branch and is not a secret', () => {
  const other = execSync('git show origin/cursor/accounts-auth-migration-009-e6c9:src/game/turnstileSite.ts', { encoding: 'utf8' })
  const found = other.match(/TURNSTILE_SITE_KEY = '([^']+)'/)
  assert.ok(found, 'accounts branch has a site key')
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  assert.equal(hash(TURNSTILE_SITE_KEY), hash(found[1]))
  assert.match(TURNSTILE_SITE_KEY, /^0x[A-Za-z0-9_-]{20,}$/)
  const needle = ['TURNSTILE', 'SECRET'].join('_')
  const tree = execSync(`git grep -l ${needle} -- . ':!node_modules' || true`, { encoding: 'utf8' })
  assert.equal(tree.trim(), '')
})

test('magic link and email code both send the captcha token', () => {
  const source = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
  assert.match(source, /signInWithOtp\(\{[\s\S]*captchaToken/)
  assert.match(source, /verifyOtp\(\{[\s\S]*captchaToken/)
  const sheet = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
  assert.match(sheet, /sendRecoveryCode\(email, token\)/)
  assert.match(sheet, /verifyEmailCode\(email, code, token\)/)
  assert.match(sheet, /captcha\.reset\(\)/)
})
