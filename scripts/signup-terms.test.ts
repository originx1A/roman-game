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
  assert.match(sheet, /const \[optIn, setOptIn\] = useState\(false\)/)
  assert.match(sheet, /const \[terms, setTerms\] = useState\(false\)/)
  const age = sheet.split('data-testid="signup-age"')[1]?.split('data-testid="signup-terms"')[0] ?? ''
  assert.match(age, /I'm 13 or older/)
  assert.doesNotMatch(age, /I agree to the/)
  assert.doesNotMatch(age, /href=/)
  const terms = sheet.split('data-testid="signup-terms"')[1]?.split('data-testid="signup-news"')[0] ?? ''
  assert.match(terms, /I agree to the/)
  assert.match(terms, /Please agree to the Terms and Privacy\./)
  assert.doesNotMatch(terms, /I'm 13 or older/)
  assert.doesNotMatch(terms, /data-testid="age-13"/)
  const news = sheet.split('data-testid="signup-news"')[1]?.split("sheet === 'name'")[0] ?? ''
  assert.match(news, /type="checkbox"/)
  assert.doesNotMatch(news, /I'm 13 or older/)
  assert.doesNotMatch(news, /I agree to the/)
  assert.doesNotMatch(sheet, /askAge/)
  assert.doesNotMatch(sheet, /oelsglmfkpzbueqysvdm/)
  assert.match(cloud, /https:\/\/oelsglmfkpzbueqysvdm\.supabase\.co/)
})

test('sign-in is email then a 6-digit code, and still accepts a 6 to 8 digit token', () => {
  assert.match(sheet, /We'll send a 6-digit code/)
  assert.match(sheet, /Enter it here\. You can also tap the link in that email/)
  assert.match(sheet, /aria-label="6-digit code"/)
  assert.match(sheet, /inputMode="numeric"/)
  assert.match(sheet, /maxLength=\{8\}/)
  assert.match(sheet, /replace\(\/\\s\/g, ''\)/)
  assert.match(sheet, /verifyEmailCode\(email, code, token\)/)
  assert.match(cloud, /token\.replace\(\/\\s\/g, ''\)/)
  assert.match(cloud, /\\d\{6,8\}/)
  assert.match(cloud, /verifyOtp\(\{[\s\S]*email: email\.trim\(\),[\s\S]*token: code,[\s\S]*type: 'email',[\s\S]*captchaToken/)
  assert.match(cloud, /signInWithOtp/)
  assert.match(cloud, /signOut\(\{ scope: 'global' \}\)/)
})
