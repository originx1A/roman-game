import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const ui = rd('../src/cloud/CloudScores.tsx')
const cloud = rd('../src/cloud/cloud.ts')
const tag = rd('../src/buildTag.ts')
const css = rd('../src/App.css')

/** Slice one sheet's JSX block: from its `sheet === '<name>'` marker to the next sheet marker (or the portal close). */
function block(name: string): string {
  const marks = [...ui.matchAll(/sheet === '(\w+)'/g)]
  const i = marks.findIndex((m) => m[1] === name)
  assert.ok(i >= 0, `sheet '${name}' exists`)
  const from = marks[i].index!
  const to = i + 1 < marks.length ? marks[i + 1].index! : ui.indexOf('document.body', from)
  return ui.slice(from, to)
}

test('9.32-j-dev: sign-in opens on a chooser — Sign in / Create account, no form fields', () => {
  // Tony 2026-11-07: the box opens on two options only; each pick swaps in its own screen.
  assert.match(ui, /type Sheet = null \| 'start' \| 'signin' \| 'create'/)
  // Signed-out visitors land on the chooser, not on a form.
  assert.match(ui, /: 'start'\)/)
  const start = block('start')
  assert.match(start, />\s*Sign in\s*</)
  assert.match(start, />\s*Create account\s*</)
  assert.doesNotMatch(start, /<input/, 'chooser carries no form fields')
  assert.doesNotMatch(start, /consentChecks/, 'chooser carries no checkboxes')
})

test('9.32-k-dev: sign-in is player name + password on the shared door (no code on the door)', () => {
  // Tony 2026-11-07: the game matches the website — name + password signs in,
  // email is recovery only. The code door survives only as the claim bootstrap.
  const signin = block('signin')
  assert.match(signin, /type="password"/, 'sign-in has a password field')
  assert.match(signin, /autoComplete="current-password"/)
  assert.match(signin, /value=\{loginName\}/, 'sign-in asks the player name')
  assert.match(signin, /Forgot your password\?/, 'forgot is one tap from sign-in')
  assert.doesNotMatch(signin, /Email me my sign-in code/, 'the code is no longer the sign-in door')
  assert.match(ui, /await signInWithPassword\(loginName, pass/, 'sign-in posts to the shared API')
  assert.match(cloud, /'\/api\/auth\/signin'/, 'the sign-in call is the website’s endpoint')
  assert.match(cloud, /stay_signed_in: true/, 'the game stays signed in, as it always has')
  assert.match(cloud, /AUTH_BASE = 'https:\/\/romansgame\.com'/, 'auth is called by absolute URL, never this site’s /api')
})

test('9.32-k-dev: create collects name + password + confirm; the age answer is the server record', () => {
  const create = block('create')
  assert.match(create, /value=\{createName\}/)
  assert.equal((create.match(/type="password"/g) ?? []).length, 2, 'password + confirm on create')
  assert.match(create, /Recovery email \(optional\)/, 'email is framed as recovery for grown-ups')
  assert.match(create, /Grown-up's email \(required/, 'an unticked age box makes it a grown-up’s required email')
  assert.match(ui, /await createAccount\(\{/, 'create posts to the shared API')
  assert.match(cloud, /age_choice: input\.age13 \? '13_plus' : 'under_13'/, 'the age choice is sent to the server, not just kept on the device')
  assert.match(cloud, /terms_accepted: input\.terms/)
  assert.match(cloud, /'\/api\/auth\/signup'/)
  // Signup fails closed without the person check, exactly like the website.
  assert.match(ui, /if \(!cap\.token\) \{\s*askCaptcha\(\)/, 'create asks for the person check before it will submit')
})

test('9.32-k-dev: the email-code door is demoted to a bootstrap sheet, not the front door', () => {
  const start = block('start')
  assert.match(start, /Sign in with an email code/, 'the code door is still reachable for older accounts')
  const emailcode = block('emailcode')
  assert.match(emailcode, /Email me my sign-in code/)
  assert.match(emailcode, /await sendCode\(\)/)
  assert.match(cloud, /signInWithOtp/, 'the OTP calls themselves are untouched (claim bootstrap)')
  assert.match(cloud, /shouldCreateUser: true/)
})

test('9.32-k-dev: the claim gives an email-code account its name + password (same account)', () => {
  const claim = block('claim')
  assert.match(claim, /Give your account a name \+ password/)
  assert.match(claim, /your leaderboard\s+name doesn't change/, 'the copy keeps login name and leaderboard name straight')
  assert.equal((claim.match(/type="password"/g) ?? []).length, 2, 'password + confirm on claim')
  assert.match(claim, /consentChecks/, 'the age/terms questions are answered once, server-side, at claim')
  assert.match(ui, /await claimAccount\(\{/)
  assert.match(cloud, /'\/api\/auth\/claim'/)
  assert.match(cloud, /dual_account/, 'a second website account stops the claim instead of making a third')
  const account = block('account')
  assert.match(account, /canClaim/, 'the account sheet offers the claim to code accounts')
  assert.match(account, /Give your account a name \+ password/)
})

test('9.32-k-dev: forgot runs the shared recover/lost steps, fully in-game by code', () => {
  const forgot = block('forgot')
  assert.match(forgot, /Email me a reset code/)
  assert.match(forgot, /support@romansgame\.com/, 'no-recovery-email accounts get the honest support path')
  assert.match(ui, /await recoverStart\(recEmail, cap\.token\)/)
  assert.match(ui, /await recoverCode\(recEmail, resetCode, cap\.token\)/)
  assert.match(ui, /await recoverFinish\(grant, pickUser, pass, cap\.token\)/)
  assert.match(cloud, /'\/api\/auth\/recover\/lost\/start'/)
  assert.match(cloud, /'\/api\/auth\/recover\/lost\/code'/)
  assert.match(cloud, /'\/api\/auth\/recover\/lost\/finish'/)
  const reset = block('reset')
  assert.match(reset, /grant\.accounts\.length > 1/, 'a shared email makes the player pick the account')
})

test('9.32-k-dev: a signed-in account can add a recovery email', () => {
  const account = block('account')
  assert.match(account, /Add a recovery email/)
  assert.match(ui, /await addRecoveryEmail\(addEmail\)/)
  assert.match(cloud, /'\/api\/auth\/email-add'/)
})

test('9.32-j-dev: the 13+ / Terms / newsletter questions live on the create screen only', () => {
  const signin = block('signin')
  assert.doesNotMatch(signin, /consentChecks/, 'sign-in screen asks no consent questions')
  assert.doesNotMatch(signin, /age13/, 'the age question never appears on sign-in')
  assert.doesNotMatch(signin, /type="checkbox"/)
  const create = block('create')
  assert.match(create, /consentChecks/, 'create screen carries the questions')
  assert.match(ui, /I'm 13 or older/, 'the age verification is still asked (on create)')
})

test('9.32-k-dev: shared fields — switching doors never wipes typed values', () => {
  assert.equal((ui.match(/value=\{email\}/g) ?? []).length, 1, 'exactly one input is bound to the shared email state')
  assert.equal((ui.match(/value=\{loginName\}/g) ?? []).length, 2, 'the sign-in name is shared by sign-in and claim')
  assert.match(ui, /New here\? Create account instead/)
  assert.match(ui, /Already have an account\? Sign in instead/)
})

test('9.32-k-dev: the one-time name step still completes a code sign-in', () => {
  // The OTP plumbing itself is unchanged; the name step still writes the players row.
  assert.match(ui, /await sendMagicLink\(email\)/)
  assert.match(ui, /await verifyEmailCode\(email, code\)/)
  assert.match(ui, /await savePlayerName\(name,/)
  assert.match(ui, /Please agree to the Terms and Privacy\./)
  assert.match(ui, /Type a full email address\./)
})

test('9.32-j-dev: close is reachable on every sheet, including the account sheet', () => {
  for (const name of ['start', 'signin', 'create', 'sent', 'emailcode', 'forgot']) assert.match(block(name), /Not now/, `${name} sheet can be closed`)
  assert.match(block('claim'), /Not now/, 'claim sheet can step back')
  assert.match(block('addemail'), /Back/, 'add-email sheet can step back')
  assert.match(block('account'), />\s*Close\s*</, 'account sheet has a Close button')
  assert.match(ui, /start-sheet-scrim" onClick=\{\(\) => setSheet\(null\)\}/, 'the scrim closes the box')
})

test('9.32-k-dev: build tag bumped for the password switch', () => {
  assert.match(tag, /build 9\.32-k-dev/)
})

test('9.32-j-dev round 2: the panel keeps the field being typed in above the phone keyboard', () => {
  // Tony 2026-11-07, testing on his phone: the on-screen keyboard covered the email /
  // code / name fields ("you can't see shit"). The sheet must follow the visual viewport
  // and scroll the focused field into view inside the card.
  assert.match(ui, /window\.visualViewport/, 'the sheet tracks the visual viewport')
  assert.match(ui, /setProperty\('--rg-vv-height'/, 'sheet height follows the visible area')
  assert.match(ui, /setProperty\('--rg-vv-top'/, 'sheet top follows the visible area')
  assert.match(ui, /addEventListener\('focusin'/, 'focusing a field re-checks its visibility')
  assert.match(ui, /scrollIntoView\(\{ block: 'center' \}\)/, 'the focused field is scrolled into view')
  assert.match(css, /\.start-sheet\.cloud-sheet \{[^}]*--rg-vv-height/, 'CSS sizes the account sheet to the visible viewport')
})

test('9.32-j-dev round 2: every sheet in the box carries the link back to romansgame.com', () => {
  // Tony 2026-11-07: "you need a button somewhere or a link on that page that takes you
  // to romansgame.com" — a small footer link on the panel itself, on every sheet.
  assert.match(ui, /href="https:\/\/romansgame\.com\/" target="_blank" rel="noopener"/)
  assert.match(ui, />\s*Visit romansgame\.com\s*</)
  const footers = (ui.match(/\{siteLink\}/g) ?? []).length
  assert.ok(footers >= 12, `footer link rendered on every sheet (found ${footers})`)
  for (const name of ['start', 'signin', 'create', 'sent', 'name', 'parent', 'account', 'emailcode', 'forgot', 'reset', 'claim', 'addemail'])
    assert.match(block(name), /\{siteLink\}/, `${name} sheet carries the footer link`)
})
