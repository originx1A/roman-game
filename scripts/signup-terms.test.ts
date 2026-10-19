import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sheet = readFileSync(new URL('../src/cloud/CloudScores.tsx', import.meta.url), 'utf8')
const cloud = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')

test('sign-up sheet requires Terms and Privacy, and leaves the news box unchecked', () => {
  assert.match(sheet, /I agree to the/)
  assert.match(sheet, /href="https:\/\/romansgame\.com\/terms"/)
  assert.match(sheet, /href="\.\/privacy\.html"/)
  assert.match(sheet, /Please agree to the Terms and Privacy\./)
  assert.match(sheet, /I'm 13 or older/)
  assert.match(sheet, /useState\(\(\) => loadConsent\(\)\?\.optIn \?\? false\)/)
  assert.match(sheet, /const \[terms, setTerms\] = useState\(false\)/)
  assert.doesNotMatch(sheet, /oelsglmfkpzbueqysvdm/)
  assert.match(cloud, /https:\/\/oelsglmfkpzbueqysvdm\.supabase\.co/)
})

test('sign-in sheet keeps the magic link and accepts the 6-digit code', () => {
  assert.match(sheet, /Tap the link in your email, or enter the 6-digit code/)
  assert.match(sheet, /aria-label="6-digit code"/)
  assert.match(sheet, /verifyEmailCode\(email, code\)/)
  assert.match(cloud, /verifyOtp\(\{ email: email\.trim\(\), token: code, type: 'email' \}\)/)
  assert.match(cloud, /signInWithOtp/)
})
