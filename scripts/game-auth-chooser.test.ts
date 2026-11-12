import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const rd = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const ui = rd('../src/cloud/CloudScores.tsx')
const cloud = rd('../src/cloud/cloud.ts')
const app = rd('../src/App.tsx')
const storage = rd('../src/game/storage.ts')
const hub = rd('../hub/hub.html')
const tag = rd('../src/buildTag.ts')
const css = rd('../src/App.css')
const passInput = rd('../src/components/PasswordInput.tsx')
const owner = rd('../src/components/OwnerGifts.tsx')

/** Tony Nov 12, 2026, ~10:46 (his direct word, overriding the earlier sheet
 * work): sign-in lives on the hub and the main website ONLY, NEVER in the
 * game. The game reads the hub session (same origin, shared localStorage):
 * signed in, scores save to the cloud; signed out, progress saves on this
 * device. One sign-in, one account. */

test('9.33-a22: no sign-in sheet in the game — no sheets, no auth forms, no Turnstile', () => {
  for (const gone of [
    'createPortal', 'role="dialog"', "sheet ===", 'type Sheet', 'start-sheet',
    'cloud-sheet', 'cloud-close', 'cloud-quiet', 'cloud-text-btn',
    'signInWithPassword', 'createAccount', 'claimAccount',
    'recoverStart', 'recoverCode', 'recoverFinish', 'addRecoveryEmail',
    'sendMagicLink', 'verifyEmailCode', 'savePlayerName', 'signOut',
    'signOutEverywhere', 'renderTurnstile', 'PasswordInput',
    'loadConsent', 'saveConsent', 'isProfane', 'visualViewport',
    'rg.game.bridge', 'auth-bridge',
  ]) assert.doesNotMatch(ui, new RegExp(gone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `the game carries no ${gone}`)
  for (const gone of [
    'signInWithPassword', 'createAccount', 'claimAccount',
    'recoverStart', 'recoverCode', 'recoverFinish', 'addRecoveryEmail',
    'sendMagicLink', 'verifyEmailCode', 'savePlayerName',
    'signOutEverywhere', 'renderTurnstile', 'authSiteKey',
    'loadConsent', 'saveConsent', 'subscribeNews', 'NAME_MAX',
  ]) assert.doesNotMatch(cloud, new RegExp(gone), `cloud.ts carries no ${gone}`)
  // The sheet CSS went out with the sheet; only the link's compact variant stays.
  for (const gone of [
    '.cloud-sheet', '.cloud-close', '.cloud-quiet', '.cloud-text-btn',
    '.cloud-checks', '.cloud-captcha', '.cloud-code', '.cloud-switch',
    '.cloud-site-link', '.cloud-err', '.cloud-note', '.cloud-field-label',
  ]) assert.doesNotMatch(css, new RegExp(gone.replace('.', '\\.')), `App.css carries no ${gone}`)
  assert.match(css, /\.cloud-btn\.is-compact/, 'the link keeps its compact variant')
})

test('9.33-a22: "Save my scores" is a link to the hub sign-in, not a button that opens a sheet', () => {
  assert.match(ui, /const HUB_SIGNIN = '\/\?signin=1'/, 'the hub sign-in entry is the hub root with ?signin=1')
  assert.match(ui, /href=\{HUB_SIGNIN\}/, 'signed out, the entry is a link')
  assert.match(ui, /Save my scores/, 'the entry keeps its name')
  assert.match(ui, /href="\/"/, 'signed in, the status links to the hub where the account lives')
  assert.match(ui, /Scores saving as/, 'signed in, the status names the player')
  assert.match(ui, /cloud\.publicName \?\? cloud\.name/, 'the leaderboard name is shown when there is one')
  assert.match(ui, /\(\$\{cloud\.pending\} waiting\)/, 'unsent scores are still counted on the link')
  assert.doesNotMatch(ui, /suggestedName/, 'no name is pre-filled anywhere — there is no form')
  assert.match(ui, /compact\?: boolean/, 'the win screen still gets its compact variant')
  assert.match(app, /<CloudScoresButton \/>/, 'home uses the link with no props')
})

test('9.33-a22: the game still reads the hub session — same origin, shared localStorage', () => {
  assert.match(cloud, /export async function initCloud/, 'the game boots its cloud state')
  assert.match(cloud, /sb\.auth\.getSession\(\)/, 'the session is read, never asked for')
  assert.match(cloud, /sb\.auth\.onAuthStateChange/, 'a hub sign-in lands here live')
  assert.match(cloud, /async function loadPlayer\(sb: SupabaseClient, session: Session \| null\)/, 'the player row loads off the session')
  assert.match(cloud, /await loadPlayer\(sb, data\.session\)/, 'initCloud loads the player off the restored session')
  assert.match(cloud, /export function saveScore/, 'scores still queue to the cloud when signed in')
  assert.match(cloud, /export async function flushScores/, 'the queue still flushes')
  assert.match(ui, /useEffect\(\(\) => onCloud\(setS\), \[\]\)/, 'the link subscribes to the cloud state')
  assert.match(app, /void initCloud\(\)/, 'the app still boots the cloud state')
})

test('9.33-a22: signing in merges the local save — it never wipes it', () => {
  // The score queue: games played while signed out belong to the player who
  // signs in now — the anonymous queue is appended to the account's queue.
  assert.match(cloud, /games played while signed out belong to the player who signs in now/)
  assert.match(cloud, /const anon = readQueue\(null\)/)
  assert.match(cloud, /writeQueue\(\[\.\.\.readQueue\(\), \.\.\.anon\]\)/)
  assert.match(cloud, /writeQueue\(\[\], null\)/, 'the anonymous queue is cleared only after the merge')
  // The device save: signing out of a local profile keeps its progress as a guest.
  assert.match(storage, /saveGuestProgress\(\{ clears: profile\.clears, totalScore: profile\.totalScore \}\)/)
  // The game save keys are never touched by the auth code.
  assert.doesNotMatch(cloud, /guestProgress|loadProfile|saveProfile|clearProfile/, 'auth never touches the game save')
})

test('9.33-a22: the Account screen has no sign-in form — it links to the hub', () => {
  for (const gone of ['handleSignIn', 'signInWithEmail', 'Save with email', 'emailInput', 'nameInput', 'auth-form'])
    assert.doesNotMatch(app, new RegExp(gone), `the Account screen carries no ${gone}`)
  assert.doesNotMatch(storage, /export function signInWithEmail/, 'the local sign-in function is gone')
  assert.match(app, /href="\/\?signin=1"/, 'the Account screen links to the hub sign-in')
  assert.match(app, />Sign in</, 'the Account screen offers Sign in')
  assert.match(app, /One account for the game, the hub, and romansgame\.com/, 'the copy says one account, once')
  assert.match(app, /cloud\.status === 'signed-in' && cloud\.name/, 'the Account screen shows the hub account when signed in')
  assert.match(app, /Manage on the hub/, 'a signed-in player manages the account on the hub')
  // The device-save card survives for existing local profiles — it is the
  // local cache, not an account, and its sign-out keeps the progress.
  assert.match(app, /signOutKeepDevice\(\)/, 'the device-save sign-out is still there')
  assert.match(app, /Device save \(not the account\)/, 'the card is labelled as the device save')
})

test('9.33-a22: the hub auto-opens its sheet when the game sends the player with ?signin=1', () => {
  assert.match(hub, /q\.get\('signin'\) === '1'/, 'the hub reads ?signin=1')
  assert.match(hub, /q\.delete\('signin'\)/, 'the param is stripped from the URL')
  assert.match(hub, /if \(askSignin\) \{ openSheet\(\); return; \}/, 'the sheet opens on arrival')
  assert.match(hub, /if \(askSignin\) openSheet\(\)/, 'a handoff code and a sign-in ask can arrive together')
})

test('9.33-a22: the cross-origin handoff still works — no sheet needed for it', () => {
  assert.match(cloud, /'\/api\/auth\/handoff\/mint'/, 'mint posts to the handoff endpoint')
  assert.match(cloud, /'\/api\/auth\/handoff\/redeem'/, 'redeem posts to the handoff endpoint')
  assert.match(cloud, /export async function mintHandoffCode/, 'the game can still mint a code for the website')
  assert.match(cloud, /export async function redeemHandoffCode/, 'the game can still redeem a website code')
  assert.match(cloud, /export function openWebsite/, 'outbound links still carry the sign-in over')
  assert.match(cloud, /new URLSearchParams\(window\.location\.search\)\.get\('sso'\)/, 'initCloud still redeems a ?sso= code on boot')
  assert.match(cloud, /stripSsoParam\(\)/, 'the code is stripped from the URL the moment it is read')
  assert.match(cloud, /adoptApiSession/, 'the redeemed session still lands on the client')
  assert.doesNotMatch(ui, /rg\.game\.bridge/, 'the game no longer bridge-checks — it has no sheet to open')
})

test('9.33-a22: the password eye still works where a password field remains', () => {
  // No password field is left in the game itself — the eye lives on in the
  // shared component, still used by the owner passphrase.
  assert.doesNotMatch(ui, /PasswordInput/, 'the game has no password fields left')
  assert.match(owner, /import \{ PasswordInput \}/, 'the owner passphrase still uses the shared field')
  assert.match(passInput, /type=\{show \? 'text' : 'password'\}/, 'the eye flips the field between hidden and readable')
  assert.match(passInput, /const \[show, setShow\] = useState\(false\)/, 'each field owns its eye state and starts hidden')
  assert.match(passInput, /type="button"[^>]*className="pass-eye"/, 'the eye is a plain button — it can never submit the form')
  assert.match(passInput, /aria-label=\{show \? 'Hide password' : 'Show password'\}/, 'the eye says what it does')
  assert.match(css, /\.pass-eye \{[^}]*position: absolute/, 'the eye rides inside the field, adding no width')
})

test('9.33-a22: build tag bumped for the sheet removal', () => {
  assert.match(tag, /build 9\.33-a22'/)
})
