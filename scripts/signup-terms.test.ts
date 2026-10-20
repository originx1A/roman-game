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

test('the website link is on home, the logo, and account, and opens in a new tab', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const home = app.slice(app.indexOf("{screen === 'home'"), app.indexOf("{screen === 'how'"))
  const account = app.slice(app.indexOf("{screen === 'profile'"), app.indexOf('<section className="leaderboard">'))
  assert.match(home, /data-testid="home-site-link"/)
  assert.match(home, /Visit romansgame\.com/)
  assert.match(app, /data-testid="brand-site"/)
  assert.match(account, /data-testid="account-website"/)
  assert.match(account, />\s*Website\s*</)
  const brandAt = app.indexOf('data-testid="brand-site"')
  const brand = app.slice(Math.max(0, brandAt - 240), brandAt + 40)
  for (const chunk of [home, account, brand]) {
    assert.match(chunk, /href="https:\/\/romansgame\.com"/)
    assert.match(chunk, /target="_blank"/)
    assert.match(chunk, /rel="noopener"/)
  }
  assert.equal(app.includes("hideChrome = screen === 'play'"), true)
  const logo = app.slice(app.indexOf('data-testid="site-logo"') - 280, app.indexOf('data-testid="site-logo"') + 220)
  assert.match(logo, /href="https:\/\/romansgame\.com"/)
  assert.match(logo, /target="_blank"/)
  assert.match(logo, /rel="noopener"/)
  assert.match(logo, /aria-label="Visit romansgame\.com"/)
  assert.match(logo, /src="\/images\/site-logo\.png"/)
  assert.doesNotMatch(logo, /🏰/)
})

test('sign-in sheet keeps the magic link and accepts a 6 to 10 digit code', () => {
  assert.match(sheet, /Tap the link in your email, or enter the code from your email/)
  assert.match(sheet, /aria-label="the code from your email"/)
  assert.match(sheet, /inputMode="numeric"/)
  assert.match(sheet, /maxLength=\{10\}/)
  assert.match(sheet, /signInCode\(code\)\.length < 6/)
  assert.match(sheet, /verifyEmailCode\(/)
  assert.match(cloud, /token\.replace\(\/\\s\/g, ''\)/)
  assert.match(cloud, /slice\(0, 10\)/)
  assert.match(cloud, /\\d\{6,10\}/)
  assert.match(cloud, /signInWithOtp/)
  assert.doesNotMatch(cloud, /\\d\{8\}/)
  assert.doesNotMatch(sheet, /maxLength=\{8\}/)
})
