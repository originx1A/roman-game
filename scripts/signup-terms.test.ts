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

test('sign-in sheet keeps the magic link and accepts a 6 to 10 digit code', () => {
  assert.match(sheet, /Tap the link in your email, or enter the code from your email/)
  assert.match(sheet, /aria-label="the code from your email"/)
  assert.match(sheet, /inputMode="numeric"/)
  assert.match(sheet, /maxLength=\{10\}/)
  assert.match(sheet, /verifyEmailCode\(sentEmail \|\| signInEmail\(email\), digits\)/)
  assert.match(cloud, /token\.replace\(\/\\s\/g, ''\)/)
  assert.match(cloud, /\\d\{6,10\}/)
  assert.match(cloud, /verifyOtp\(\{ email: address, token: code, type \}\)/)
  assert.match(cloud, /signInWithOtp/)
  assert.doesNotMatch(sheet, /6-digit/)
  assert.doesNotMatch(cloud, /6-digit/)
})
