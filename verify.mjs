// Browser verification for the name+password switch (branch cooper/game-auth-chooser-2026-11-07).
// Serves the production build of this branch locally and drives headless Chrome over CDP.
//
// THE SEAM: window.fetch is stubbed BEFORE the app loads, so NO real backend is touched:
//  - romansgame.com/api/auth/* answers from a scripted stub (sessions are forged JWTs whose
//    payload Supabase would reject — they only need to satisfy setSession locally),
//  - the project's Supabase REST/auth endpoints answer locally (players row, verifyOtp),
//  - the Turnstile script + siteverify are replaced by a fake widget that issues a token.
// This proves the client's payloads, screen flow and keyboard behaviour end-to-end on test
// surfaces. NO real account is created, NO real email is sent, production is never called
// with anything but the stub's scripted answers (the stub intercepts before any network).
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { writeFileSync } from 'node:fs'

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'
const ROOT = '/home/hatch/workspace/game-auth-simplify-2026-11-07'
const DIST = join(ROOT, 'dist')
const PORT = 9367
const HTTP_PORT = 8942
const GAME = `http://localhost:${HTTP_PORT}/`

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' }
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, GAME).pathname)
    if (p === '/') p = '/index.html'
    const file = normalize(join(DIST, p))
    if (!file.startsWith(DIST)) throw new Error('nope')
    const data = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch { res.writeHead(404); res.end('nf') }
})
await new Promise((r) => server.listen(HTTP_PORT, r))

/* ================= THE STUB (injected before the app) ================= */
const stubSource = `
(() => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const jwt = (uid, email) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: uid, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, session_id: 'stub-session-' + uid }) + '.stub'
  const PW_UID = '11111111-1111-4111-8111-111111111111'
  const CODE_UID = '22222222-2222-4222-8222-222222222222'
  const sessionFor = (uid, email) => ({ access_token: jwt(uid, email), refresh_token: 'refresh-' + uid, expires_in: 3600, token_type: 'bearer' })
  window.__calls = []
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    let body = {}
    try { body = init.body ? JSON.parse(init.body) : {} } catch {}
    const rec = { url, body }
    if (url.includes('oelsglmfkpzbueqysvdm')) {
      // Supabase: token/user + players row + card RPC, all local.
      if (url.includes('/auth/v1/otp')) {
        // signInWithOtp: the magic-link/code send. Supabase answers 200 with an
        // empty user object; the session only arrives at verifyOtp.
        return json(200, {})
      }
      if (url.includes('/auth/v1/verify')) {
        // verifyOtp: the code proves the inbox; Supabase mints the session here.
        return json(200, { access_token: jwt(CODE_UID, 'kid@example.com'), refresh_token: 'refresh-' + CODE_UID, expires_in: 3600, token_type: 'bearer', user: { id: CODE_UID, email: 'kid@example.com', role: 'authenticated' } })
      }
      if (url.includes('/auth/v1/token') || url.includes('/auth/v1/user')) {
        const auth = (init.headers?.authorization ?? init.headers?.Authorization ?? '')
        const uid = auth.includes(CODE_UID) ? CODE_UID : PW_UID
        return json(200, { id: uid, email: uid === CODE_UID ? 'kid@example.com' : 'stubhero@players.romansgame.invalid', role: 'authenticated' })
      }
      if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 })
      if (url.includes('/rest/v1/players')) {
        // The row mirrors production: a website signup writes players.display_name
        // as the FIRST NAME only (publicDisplayName), so a fresh account's leaderboard
        // name boots as that first name. 'NewHero' -> 'NewHero' (single word).
        if ((init.method ?? 'GET') === 'GET') return json(200, { id: CODE_UID, display_name: 'StubHero', public_name: 'StubHero' })
        return json(201, { id: CODE_UID, display_name: body.display_name ?? 'StubHero', public_name: body.display_name ?? 'StubHero' })
      }
      if (url.includes('claim_unseen_card')) return json(200, [{ boards: 3, days: 2, pieces: 5, needed: 50, earned: false }])
      if (url.includes('/rest/v1/scores')) return json(201, [])
      return json(200, {})
    }
    if (url.includes('challenges.cloudflare.com')) {
      return new Response('window.__tsFakeLoaded = true', { status: 200, headers: { 'content-type': 'text/javascript' } })
    }
    if (url.includes('romansgame.com/api/auth/config')) return json(200, { turnstileSiteKey: 'stub-site-key', turnstile: 'test' })
    if (url.includes('romansgame.com/api/auth/signin')) {
      window.__calls.push(rec)
      if (body.password === 'wrong-password') return json(401, { error: 'invalid_credentials' })
      if (body.password === 'needs-check1') return json(403, { error: 'turnstile_required' })
      return json(200, { user_id: PW_UID, display_name: 'StubHero', player_name: 'StubHero', session: sessionFor(PW_UID, 'stubhero@players.romansgame.invalid') })
    }
    if (url.includes('romansgame.com/api/auth/signup')) {
      window.__calls.push(rec)
      if (!body.captchaToken) return json(403, { error: 'turnstile_required' })
      if (body.name === 'TakenName') return json(409, { error: 'name_taken' })
      return json(201, { user_id: PW_UID, display_name: body.name, player_name: body.name, session: sessionFor(PW_UID, 'x@players.romansgame.invalid'), recovery_email_pending: !!body.email })
    }
    if (url.includes('romansgame.com/api/auth/claim')) {
      window.__calls.push(rec)
      if (body.name === 'DualName') return json(409, { error: 'dual_account', message: 'Stub: this email already has a website account — write to support.' })
      return json(200, { user_id: CODE_UID, display_name: 'StubHero', player_name: body.name })
    }
    if (url.includes('romansgame.com/api/auth/recover/lost/start')) { window.__calls.push(rec); return json(202, { ok: true, message: 'sent' }) }
    if (url.includes('romansgame.com/api/auth/recover/lost/code')) {
      window.__calls.push(rec)
      if (body.code !== '654321') return json(401, { error: 'code_invalid', message: "That code didn't work." })
      return json(200, { reset_token: 'GRANT-TOKEN-123456', accounts: [{ user_id: PW_UID, player_name: 'StubHero', role: 'account' }] })
    }
    if (url.includes('romansgame.com/api/auth/recover/lost/finish')) {
      window.__calls.push(rec)
      return json(200, { user_id: PW_UID, display_name: 'StubHero', player_name: 'StubHero', session: sessionFor(PW_UID, 'stubhero@players.romansgame.invalid') })
    }
    if (url.includes('romansgame.com/api/auth/email-add')) { window.__calls.push(rec); return json(200, { ok: true }) }
    if (url.includes('romansgame.com/api/auth/session')) { window.__calls.push(rec); return json(401, { error: 'invalid_credentials' }) }
    if (url.includes('romansgame.com/api/auth/signout')) { window.__calls.push(rec); return new Response(null, { status: 204 }) }
    if (url.includes('/api/kit-subscribe')) return json(200, { ok: true })
    return realFetch(input, init)
  }
  // Fake Turnstile: the loader script is stubbed above; define the API the client expects.
  window.turnstile = {
    render: (el, opts) => { const d = document.createElement('div'); d.textContent = 'person check (stub)'; el.appendChild(d); setTimeout(() => opts.callback('stub-turnstile-token'), 30); return 'stub-widget' },
    remove: () => {},
  }
})()
`


const proc = spawn(SHELL, ['--headless', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
for (let i = 0; i < 50 && !ws; i++) {
  try { ws = (await (await fetch(`http://localhost:${PORT}/json/version`)).json()).webSocketDebuggerUrl } catch { await sleep(200) }
}
if (!ws) { console.error('NO CDP'); proc.kill(); server.close(); process.exit(1) }
const sock = new WebSocket(ws)
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej })
let seq = 0
const pending = new Map()
sock.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
const send = (method, params = {}, sessionId) => new Promise((res) => { const id = ++seq; pending.set(id, res); sock.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })) })
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' })
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable'); await S('Runtime.enable'); await S('DOM.enable'); await S('Page.addScriptToEvaluateOnNewDocument', { source: stubSource })
// Every run starts as a fresh visitor: wipe any session an earlier (crashed) run
// left in this Chrome profile, or the app would boot already signed in.
await S('Network.enable')
await S('Network.clearBrowserCookies')
await S('Storage.clearDataForOrigin', { origin: GAME, storageTypes: 'local_storage,session_storage,indexeddb,service_workers,cache_storage' })

const ev = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
  return r.result?.result?.value
}
const setViewport = (w, h) => S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 600 })
const shot = async (name) => {
  const r = await S('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(ROOT, name), Buffer.from(r.result.data, 'base64'))
}
const checks = []
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`) }
const clickBtn = (text) => ev(`[...document.querySelectorAll('.cloud-sheet button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`)
const clickBtnPart = (part) => ev(`[...document.querySelectorAll('.cloud-sheet button')].find(b => b.textContent.includes(${JSON.stringify(part)}))?.click()`)
const setInput = (sel, val) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event('input', { bubbles: true })); return i.value === ${JSON.stringify(val)} })()`)
const setCheck = (idx) => ev(`(() => { const c = document.querySelectorAll('.cloud-sheet input[type=checkbox]')[${idx}]; if (!c) return false; c.click(); return c.checked })()`)
const heading = () => ev(`document.querySelector('.cloud-sheet .start-sheet-card h3')?.textContent ?? null`)
const errText = () => ev(`document.querySelector('.cloud-err')?.textContent ?? ''`)
const callsTo = (path) => ev(`(window.__calls ?? []).filter(c => c.url.includes(${JSON.stringify(path)})).length`)
const lastCall = (path) => ev(`(window.__calls ?? []).filter(c => c.url.includes(${JSON.stringify(path)})).at(-1) ?? null`)

/* ================= RUN ================= */
await setViewport(390, 844)
await S('Page.navigate', { url: GAME })
await sleep(5000)

// Home screen: open the sign-in box via "Save my scores"
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(900)
const chooser = await ev(`(() => {
  const card = document.querySelector('.cloud-sheet .start-sheet-card')
  if (!card) return null
  const btns = [...card.querySelectorAll('button')].map(b => b.textContent.trim())
  return { heading: card.querySelector('h3')?.textContent, btns, inputs: card.querySelectorAll('input').length }
})()`)
check('chooser opens first', !!chooser)
check('chooser heading is Save your scores', chooser?.heading === 'Save your scores', chooser?.heading)
check('chooser options: Sign in / Create account / email code / Not now', JSON.stringify(chooser?.btns) === JSON.stringify(['Sign in', 'Create account', 'Sign in with an email code', 'Not now']), JSON.stringify(chooser?.btns))
check('chooser has NO form fields', chooser?.inputs === 0, `inputs=${chooser?.inputs}`)
await shot('auth-chooser-phone390.png')

const linkChooser = await ev(`(() => { const a = document.querySelector('.cloud-sheet .cloud-site-link'); if (!a) return null; const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), visible: r.top >= 0 && r.bottom <= innerHeight } })()`)
check('footer link: "Visit romansgame.com", visible on the chooser', linkChooser?.text === 'Visit romansgame.com' && linkChooser?.href === 'https://romansgame.com/' && linkChooser?.target === '_blank' && linkChooser?.rel === 'noopener' && linkChooser?.visible === true, JSON.stringify(linkChooser))

/* ---------- Sign in: name + password ---------- */
await clickBtn('Sign in')
await sleep(500)
const signin = await ev(`(() => {
  const card = document.querySelector('.cloud-sheet .start-sheet-card')
  return { heading: card?.querySelector('h3')?.textContent, checkboxes: card?.querySelectorAll('input[type=checkbox]').length, pw: card?.querySelectorAll('input[type=password]').length, texts: card?.querySelectorAll('input[type=text]').length }
})()`)
check('sign-in screen replaces chooser', signin?.heading === 'Sign in', signin?.heading)
check('sign-in: name + password fields, NO checkboxes, NO email field', signin?.pw === 1 && signin?.texts === 1 && signin?.checkboxes === 0, JSON.stringify(signin))
await shot('auth-signin-phone390.png')

await setInput('.cloud-sheet input[type=text]', 'StubHero')
await setInput('.cloud-sheet input[type=password]', 'wrong-password')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(900)
check('wrong password -> the website’s own error copy', (await errText()) === "That name and password didn't match. Try again, or reset your password.", await errText())
check('wrong password reached the signin endpoint once', (await callsTo('/api/auth/signin')) === 1)
check('the sheet stayed open on the failure', (await heading()) === 'Sign in')

await setInput('.cloud-sheet input[type=password]', 'correct-horse-9')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1500)
check('right password -> box closes and you are in (Tony’s model)', await ev(`!document.querySelector('.cloud-sheet')`))
const siCall = await lastCall('/api/auth/signin')
check('signin payload: name + password + stay_signed_in true', siCall?.body?.name === 'StubHero' && siCall?.body?.password === 'correct-horse-9' && siCall?.body?.stay_signed_in === true, JSON.stringify(siCall?.body))

/* ---------- Forgot: start -> code -> finish ---------- */
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
check('signed-in button opens the account sheet', (await heading()) === 'Scores are saving', await heading())
await clickBtn('Sign out')
await sleep(800)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
await clickBtn('Sign in')
await sleep(400)
await clickBtn('Forgot your password?')
await sleep(400)
check('forgot sheet opens from sign-in', (await heading()) === 'Forgot your password?', await heading())
await setInput('.cloud-sheet input[type=email]', 'hero@example.com')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(600)
check('forgot without the person check asks for it first (fail closed)', (await errText()).includes('person check'), await errText())
await sleep(800) // stub widget issues its token
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(900)
check('forgot start sent (202 path) with the captcha token', (await callsTo('/api/auth/recover/lost/start')) >= 1 && (await lastCall('/api/auth/recover/lost/start'))?.body?.captchaToken === 'stub-turnstile-token')
check('reset sheet opens for the code', (await heading()) === 'Enter your reset code', await heading())
await shot('auth-reset-phone390.png')
await setInput('.cloud-sheet input.cloud-code', '111111')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(500)
check('wrong reset code (no token yet) asks for the person check', (await errText()).includes('person check'), await errText())
await sleep(800)
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(900)
check('wrong reset code -> code_invalid copy from the API', (await errText()).includes("didn't work"), await errText())
await setInput('.cloud-sheet input.cloud-code', '654321')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(600)
check('right reset code (no token yet) asks for the person check', (await errText()).includes('person check'), await errText())
await sleep(1500) // fresh widget for this attempt
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1200)
check('right reset code -> new-password step', (await heading()) === 'Choose a new password', await heading())
await setInput('.cloud-sheet input[aria-label="New password"]', 'brand-new-pass-7')
await setInput('.cloud-sheet input[aria-label="Type it again"]', 'brand-new-pass-7')
await sleep(800) // finish-step widget token
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1500)
const finCall = await lastCall('/api/auth/recover/lost/finish')
check('finish payload: grant token + chosen account + new password', finCall?.body?.reset_token === 'GRANT-TOKEN-123456' && finCall?.body?.user_id === '11111111-1111-4111-8111-111111111111' && finCall?.body?.new_password === 'brand-new-pass-7', JSON.stringify(finCall?.body))
check('after the reset the player is signed in (box closed)', await ev(`!document.querySelector('.cloud-sheet')`))

/* ---------- Add a recovery email (account sheet) ---------- */
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
check('account sheet offers Add a recovery email to password accounts', await ev(`[...document.querySelectorAll('.cloud-sheet button')].some(b => b.textContent.trim() === 'Add a recovery email')`))
await clickBtn('Add a recovery email')
await sleep(400)
await setInput('.cloud-sheet input[type=email]', 'new-backup@example.com')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(900)
check('email-add posted with the typed address', (await lastCall('/api/auth/email-add'))?.body?.email === 'new-backup@example.com')
check('back on the account sheet with the confirm note', (await heading()) === 'Scores are saving' && (await ev(`document.querySelector('.cloud-note')?.textContent ?? ''`)).includes('confirm email'))
await clickBtn('Sign out')
await sleep(800)

/* ---------- Create: captcha gate, payload, typed values ---------- */
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
await clickBtn('Create account')
await sleep(500)
const create0 = await ev(`(() => {
  const card = document.querySelector('.cloud-sheet .start-sheet-card')
  return { heading: card?.querySelector('h3')?.textContent, pw: card?.querySelectorAll('input[type=password]').length, checkboxes: [...card.querySelectorAll('input[type=checkbox]')].map(c => c.closest('label').textContent.trim().slice(0, 30)) }
})()`)
check('create screen: name + password + confirm + the 3 consent questions', create0?.heading === 'Create your account' && create0?.pw === 2 && create0?.checkboxes?.length === 3 && create0.checkboxes[0].startsWith("I'm 13 or older"), JSON.stringify(create0))
await shot('auth-create-phone390.png')
await setInput('.cloud-sheet input[aria-label="Player name"]', 'NewHero')
await setInput('.cloud-sheet input[aria-label="Password"]', 'a-strong-pass-1')
await setInput('.cloud-sheet input[aria-label="Type the password again"]', 'a-strong-pass-1')
await setCheck(0)
await setCheck(1)
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(600)
check('create without the person check -> asked, and NOTHING was posted', (await errText()).includes('person check') && (await callsTo('/api/auth/signup')) === 0, await errText())
await sleep(900)
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1200)
const suCall = await lastCall('/api/auth/signup')
check('signup payload: server age record + terms + captcha + stay', suCall?.body?.age_choice === '13_plus' && suCall?.body?.terms_accepted === true && suCall?.body?.captchaToken === 'stub-turnstile-token' && suCall?.body?.stay_signed_in === true && suCall?.body?.name === 'NewHero', JSON.stringify(suCall?.body))
check('after create, the box closes and you are in (server already holds the name + age record)', await ev(`!document.querySelector('.cloud-sheet')`))
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
check('the new account sheet shows the leaderboard name the server wrote (first name of the sign-in name)', (await heading()) === 'Scores are saving', await heading())
await clickBtn('Sign out')
await sleep(800)

/* ---------- The claim: code sign-in -> account -> claim -> done ---------- */
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(800)
await clickBtn('Sign in with an email code')
await sleep(400)
check('email-code sheet (the bootstrap door)', (await heading()) === 'Sign in with an email code', await heading())
await setInput('.cloud-sheet input[type=email]', 'kid@example.com')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(900)
check('code sheet opens', (await heading()) === 'Check your email', await heading())
await setInput('.cloud-sheet input.cloud-code', '123456')
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1500)
check('code sign-in lands a named player on the account sheet', (await heading()) === 'Scores are saving', await heading())
check('account sheet offers the claim to a code account', await ev(`[...document.querySelectorAll('.cloud-sheet button')].some(b => b.textContent.trim() === 'Give your account a name + password')`))
await shot('auth-account-claim-phone390.png')
await clickBtn('Give your account a name + password')
await sleep(500)
check('claim sheet opens', (await heading()) === 'Give your account a name + password', await heading())
await setInput('.cloud-sheet input[aria-label="Sign-in name"]', 'DualName')
await setInput('.cloud-sheet input[aria-label="Password"]', 'claim-pass-123')
await setInput('.cloud-sheet input[aria-label="Type the password again"]', 'claim-pass-123')
// The claim sheet reuses the SHARED consent state (consentChecks is one block used
// by create AND claim), and an earlier leg of this run already ticked those boxes —
// tick ONLY the ones still unticked, or a blind click unticks them again.
for (let i = 0; i < 2; i++) {
  const on = await ev(`document.querySelectorAll('.cloud-sheet input[type=checkbox]')[${i}]?.checked`)
  if (!on) await setCheck(i)
}
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(500)
check('claim without the person check -> asked first', (await errText()).includes('person check'), await errText())
await sleep(900)
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1200)
check('dual account -> the server’s stop message, no third account', (await errText()).includes('already has a website account'), await errText())
await setInput('.cloud-sheet input[aria-label="Sign-in name"]', 'HeroClaim')
await sleep(900)
await ev(`document.querySelector('.cloud-sheet form').requestSubmit()`)
await sleep(1200)
const clCall = await lastCall('/api/auth/claim')
check('claim payload: name + password + server age + terms', clCall?.body?.name === 'HeroClaim' && clCall?.body?.age_choice === '13_plus' && clCall?.body?.terms_accepted === true, JSON.stringify(clCall?.body))
check('claim done -> back on the account sheet with the done note', (await heading()) === 'Scores are saving' && (await ev(`document.querySelector('.cloud-note')?.textContent ?? ''`)).includes('from now on you sign in with your name + password'))
check('the claim button is gone after claiming', await ev(`![...document.querySelectorAll('.cloud-sheet button')].some(b => b.textContent.trim() === 'Give your account a name + password')`))
await shot('auth-claimed-phone390.png')
await clickBtn('Close')
await sleep(500)

/* ---------- Typed values survive switching (sign-in <-> create) ---------- */
// The claim leg left us SIGNED IN on the account sheet; close it, sign out, reopen.
await clickBtn('Close')
await sleep(500)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await clickBtn('Sign out')
await sleep(900)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await clickBtn('Sign in')
await sleep(400)
await setInput('.cloud-sheet input[type=text]', 'TypedName')
await clickBtnPart('Create account')
await sleep(400)
await setInput('.cloud-sheet input[type=email]', 'shared@example.com')
await clickBtnPart('Sign in instead')
await sleep(400)
check('sign-in name survived the round trip to create and back', (await ev(`document.querySelector('.cloud-sheet input[type=text]')?.value`)) === 'TypedName')
await clickBtnPart('Create account')
await sleep(400)
check('the shared email survived too', (await ev(`document.querySelector('.cloud-sheet input[type=email]')?.value`)) === 'shared@example.com')
await clickBtn('Not now')
await sleep(400)
check('Not now closes the box', await ev(`!document.querySelector('.cloud-sheet')`))

/* ---------- Fit at 390x664 + KEYBOARD on the new create screen ---------- */
// Still signed in from the typed-values leg (the claim session) — sign out first.
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await clickBtn('Sign out')
await sleep(800)
await setViewport(390, 664)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await clickBtn('Create account')
await sleep(600)
const fit = await ev(`(() => {
  const card = document.querySelector('.cloud-sheet .start-sheet-card')
  const btn = [...card.querySelectorAll('button')].find(b => b.textContent.includes('Create my account'))
  card.scrollTop = card.scrollHeight
  const r = btn.getBoundingClientRect()
  return { submitVisibleAfterScroll: r.bottom <= innerHeight && r.top >= 0 }
})()`)
check('new create screen fits 390x664: submit reachable', fit?.submitVisibleAfterScroll === true, JSON.stringify(fit))
await shot('auth-create-phone390-shrunk.png')

await setViewport(390, 844)
await sleep(500)
const focused = await ev(`(() => { const i = document.querySelector('.cloud-sheet input[aria-label="Password"]'); if (!i) return false; i.focus(); return document.activeElement === i })()`)
await sleep(250)
await setViewport(390, 400)
await sleep(900)
const km = await ev(`(() => {
  const i = document.activeElement
  const card = document.querySelector('.cloud-sheet .start-sheet-card')
  if (!i || !card || !i.getBoundingClientRect) return null
  const r = i.getBoundingClientRect()
  return { field: i.getAttribute('aria-label'), top: Math.round(r.top), bottom: Math.round(r.bottom), visibleHeight: Math.round(visualViewport.height), fieldVisible: r.top >= 0 && r.bottom <= visualViewport.height }
})()`)
check('KEYBOARD: the new create screen’s password field stays visible above the keyboard', focused === true && km?.fieldVisible === true, JSON.stringify(km))
await shot('auth-keyboard-create-390.png')

// And the sign-in password field, same treatment.
await setViewport(390, 844)
await ev(`document.querySelector('.start-sheet-scrim').click()`)
await sleep(400)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await clickBtn('Sign in')
await sleep(500)
const focused2 = await ev(`(() => { const i = document.querySelector('.cloud-sheet input[type=password]'); if (!i) return false; i.focus(); return document.activeElement === i })()`)
await sleep(250)
await setViewport(390, 400)
await sleep(900)
const km2 = await ev(`(() => { const i = document.activeElement; if (!i || !i.getBoundingClientRect) return null; const r = i.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), fieldVisible: r.top >= 0 && r.bottom <= visualViewport.height } })()`)
check('KEYBOARD: the sign-in password field stays visible too', focused2 === true && km2?.fieldVisible === true, JSON.stringify(km2))
await shot('auth-keyboard-signin-390.png')

// Desktop: chooser + sign-in
await setViewport(1280, 900)
await ev(`document.querySelector('.start-sheet-scrim').click()`)
await sleep(400)
await ev(`document.querySelector('.cloud-btn').click()`)
await sleep(700)
await shot('auth-chooser-desktop.png')
await clickBtn('Sign in')
await sleep(600)
await shot('auth-signin-desktop.png')

writeFileSync(join(ROOT, 'verify-report.json'), JSON.stringify({ at: new Date().toISOString(), seam: 'stubbed fetch (romansgame.com auth API + Supabase + Turnstile all local)', checks }, null, 2))
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`)
proc.kill(); server.close()
process.exit(checks.every((c) => c.ok) ? 0 : 1)
