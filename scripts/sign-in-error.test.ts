import assert from 'node:assert/strict'
import { test } from 'node:test'
import { explainSignInError } from '../src/cloud/signInError.ts'

test('captcha, rate limit, and redirect failures say what actually happened', () => {
  assert.equal(
    explainSignInError({
      status: 400,
      code: 'captcha_failed',
      message: 'captcha protection: request disallowed (no captcha_token found)',
    }),
    "Sign-in is blocked by a captcha check. This page doesn't send one.",
  )
  assert.equal(
    explainSignInError({ status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }),
    'Too many tries, wait a few minutes.',
  )
  assert.equal(
    explainSignInError({ message: 'Email rate limit exceeded' }),
    'Too many tries, wait a few minutes.',
  )
  assert.equal(
    explainSignInError({ message: 'redirect uri is not allowed' }),
    "This page isn't allowed to receive the sign-in link.",
  )
  assert.equal(explainSignInError({ message: '' }), "Couldn't send the link. Check the email and try again.")
  assert.equal(
    explainSignInError({ message: 'Token has expired or is invalid' }, "That code didn't work. Check it and try again."),
    'Token has expired or is invalid',
  )
})
