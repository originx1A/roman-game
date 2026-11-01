/**
 * Phone screenshots of the sign-in / create-account sheet.
 * Usage: node scripts/auth-popup.screenshots.mjs http://127.0.0.1:5173
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = process.argv[2] || 'http://127.0.0.1:5173'
const out = '/opt/cursor/artifacts/auth-popup'
mkdirSync(out, { recursive: true })

const sizes = [
  { w: 375, h: 667, name: '375x667' },
  { w: 390, h: 844, name: '390x844' },
]

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const notes = []
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2 })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByTestId('cloud-save').click()
  await page.getByTestId('auth-signin').waitFor()
  const signin = await measure(page)
  notes.push({ size: size.name, view: 'signin', ...signin })
  if (!signin.locked || !signin.fits || signin.fontSize !== '16px' || signin.noPassword) {
    throw new Error(`signin ${size.name} failed ${JSON.stringify(signin)}`)
  }
  await page.screenshot({ path: `${out}/signin-${size.name}.png` })
  await page.getByRole('button', { name: 'New here? Create an account' }).click()
  await page.getByTestId('auth-signup').waitFor()
  const signup = await measure(page)
  notes.push({ size: size.name, view: 'signup', ...signup })
  if (!signup.locked || !signup.fits || signup.fontSize !== '16px' || signup.noPassword) {
    throw new Error(`signup ${size.name} failed ${JSON.stringify(signup)}`)
  }
  await page.screenshot({ path: `${out}/signup-${size.name}.png` })
  await page.getByRole('button', { name: 'Not now' }).click()
  await page.getByTestId('auth-sheet').waitFor({ state: 'detached' })
  const closed = await page.evaluate(() => ({
    paused: document.documentElement.classList.contains('rg-cursor-fx-paused'),
    auth: document.documentElement.classList.contains('rg-auth-open'),
  }))
  if (closed.paused || closed.auth) throw new Error(`sheet did not restore cursor/scroll ${JSON.stringify(closed)}`)
  await page.close()
}
await browser.close()
console.log(JSON.stringify(notes, null, 2))

async function measure(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="auth-sheet"]')
    const input = sheet?.querySelector('input')
    const fontSize = input ? getComputedStyle(input).fontSize : ''
    const rect = sheet?.getBoundingClientRect()
    const text = document.body.innerText || ''
    return {
      locked: document.documentElement.classList.contains('rg-auth-open') && document.documentElement.classList.contains('rg-cursor-fx-paused'),
      scrollY: window.scrollY,
      fits: !!rect && rect.top >= -1 && rect.left >= -1 && rect.bottom <= window.innerHeight + 1 && rect.right <= window.innerWidth + 1,
      height: rect?.height ?? 0,
      inner: window.innerHeight,
      fontSize,
      noPassword: /No password/i.test(text),
      position: sheet ? getComputedStyle(sheet).position : '',
    }
  })
}
