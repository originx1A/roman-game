/**
 * Browser smoke for the default build and both portal copies.
 * Uses Chrome's DevTools protocol. Not a portal review and not a mocked SDK suite.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const outDir = '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })

const servers = [
  { name: 'default', dir: 'dist', port: 4173 },
  { name: 'crazygames', dir: 'dist-crazygames', port: 4174 },
  { name: 'poki', dir: 'dist-poki', port: 4175 },
]

const children = []
for (const server of servers) {
  const child = spawn('python3', ['-m', 'http.server', String(server.port), '--bind', '127.0.0.1'], {
    cwd: server.dir,
    stdio: 'ignore',
  })
  children.push(child)
}

const chrome = spawn(
  'google-chrome',
  [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/roman-portal-chrome',
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
  ],
  { stdio: 'ignore' },
)
children.push(chrome)

function stop() {
  for (const child of children) child.kill('SIGTERM')
}

async function cdp() {
  let version
  for (let i = 0; i < 40; i++) {
    try {
      version = await (await fetch('http://127.0.0.1:9222/json/version')).json()
      break
    } catch {
      await delay(150)
    }
  }
  if (!version) throw new Error('Chrome debugging port did not open')
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })
  let id = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else if (msg.method) events.push(msg)
  })
  function send(method, params = {}, sessionId) {
    const msgId = ++id
    return new Promise((resolve, reject) => {
      pending.set(msgId, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)))
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }))
    })
  }
  return { ws, send, events }
}

const SEED = `(() => {
  try {
    localStorage.setItem('roman.settings.v1', JSON.stringify({ sound: false, voice: false, reduceMotion: true, howSeen: true, analytics: false }))
  } catch {}
  const calls = []
  let sdk = window.PokiSDK
  function wrap(value) {
    if (!value || value.__wrapped) return value
    const wrapped = new Proxy(value, {
      get(target, prop, receiver) {
        const item = Reflect.get(target, prop, receiver)
        if (typeof item !== 'function') return item
        return (...args) => {
          calls.push(String(prop))
          return item.apply(target, args)
        }
      },
    })
    wrapped.__wrapped = true
    return wrapped
  }
  Object.defineProperty(window, 'PokiSDK', {
    configurable: true,
    get: () => sdk,
    set: (value) => { sdk = wrap(value) },
  })
  window.__pokiCalls = calls
})()`

async function run() {
  const { ws, send, events } = await cdp()
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)
  await send('Network.enable', {}, sessionId)

  const report = []

  async function shoot(name) {
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
    const file = `${outDir}/${name}.png`
    writeFileSync(file, Buffer.from(shot.data, 'base64'))
    return file
  }

  let seedId
  let denyId

  async function open(url, width, height, mobile, denyStorage) {
    events.length = 0
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    }, sessionId)
    if (!seedId) {
      const added = await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED }, sessionId)
      seedId = added.identifier
    }
    if (denyId) {
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: denyId }, sessionId)
      denyId = undefined
    }
    if (denyStorage) {
      const added = await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `(() => { const boom = () => { throw new DOMException('denied', 'SecurityError') }; Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom })()`,
      }, sessionId)
      denyId = added.identifier
    }
    await send('Page.navigate', { url }, sessionId)
    await delay(1600)
    const state = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body ? document.body.innerText : ''
        const requests = ${JSON.stringify('filled-later')}
        return {
          text: text.slice(0, 2500),
          tag: (document.querySelector('[data-build], .home-build, .build-tag') || {}).textContent || '',
          links: [...document.querySelectorAll('a[href]')].map(a => a.href).slice(0, 30),
          poki: window.__pokiCalls || [],
          sdk: typeof window.PokiSDK,
          title: document.title,
        }
      })()`,
      returnByValue: true,
    }, sessionId)
    const requests = events
      .filter((ev) => ev.method === 'Network.requestWillBeSent')
      .map((ev) => ev.params.request.url)
    const exceptions = events
      .filter((ev) => ev.method === 'Runtime.exceptionThrown')
      .map((ev) => ev.params.exceptionDetails.exception?.description || ev.params.exceptionDetails.text)
    return { state: state.result.value, requests, exceptions }
  }

  async function click(selector) {
    const found = await send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, trusted: true } })()`,
      returnByValue: true,
    }, sessionId)
    const box = found.result.value
    if (!box) return false
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId)
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 }, sessionId)
    await delay(800)
    return true
  }

  // Default regression: the live-site link is still on the home screen.
  {
    const page = await open('http://127.0.0.1:4173/', 1280, 720, false, false)
    const shot = await shoot('default-home-desktop')
    report.push({
      build: 'default',
      viewport: '1280x720',
      shot,
      hasSiteLink: page.state.links.some((href) => href.includes('romansgame.com')),
      hasTag: page.state.text.includes('9.33-a18-halo'),
      exceptions: page.exceptions.slice(0, 5),
      hosts: [...new Set(page.requests.map((url) => { try { return new URL(url).host } catch { return url } }))],
    })
  }

  for (const portal of [
    { name: 'crazygames', port: 4174, views: [[1280, 720, false], [390, 844, true], [907, 510, false]] },
    { name: 'poki', port: 4175, views: [[1031, 580, false], [836, 470, false], [390, 844, true]] },
  ]) {
    for (const [width, height, mobile] of portal.views) {
      const page = await open(`http://127.0.0.1:${portal.port}/`, width, height, mobile, false)
      const home = await shoot(`${portal.name}-home-${width}x${height}`)
      const played = await click('button.home-play')
      await delay(500)
      const placed = await click('[role="gridcell"]')
      const play = await shoot(`${portal.name}-play-${width}x${height}`)
      const after = await send('Runtime.evaluate', {
        expression: `(() => ({
          text: document.body.innerText.slice(0, 1800),
          links: [...document.querySelectorAll('a[href]')].map(a => a.href),
          poki: window.__pokiCalls || [],
          draft: (() => { try { return localStorage.getItem('roman.draft.v1') } catch (e) { return 'ERR ' + e.name } })(),
          controls: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 40),
        }))()`,
        returnByValue: true,
      }, sessionId)
      const hosts = [...new Set(page.requests.map((url) => { try { return new URL(url).host } catch { return url } }))]
      report.push({
        build: portal.name,
        viewport: `${width}x${height}`,
        mobile,
        home,
        play,
        played,
        placed,
        promo: after.result.value.links.filter((href) => /romansgame|jrny|facebook|twitter|wa\.me|t\.me/.test(href)),
        controls: after.result.value.controls,
        pokiCalls: after.result.value.poki,
        hasAccountForm: /Save with email|Create account|Email me/.test(after.result.value.text),
        hasTag: after.result.value.text.includes('9.33-a18-halo'),
        draftSaved: typeof after.result.value.draft === 'string' && after.result.value.draft.startsWith('{'),
        exceptions: page.exceptions.slice(0, 6),
        hosts,
      })
    }

    const denied = await open(`http://127.0.0.1:${portal.port}/?storage=deny`, 1280, 720, false, true)
    const deniedShot = await shoot(`${portal.name}-storage-denied`)
    const stillThere = await click('button.home-play')
    const placed = await click('[role="gridcell"]')
    const afterDeny = await send('Runtime.evaluate', {
      expression: `document.body && document.body.innerText.includes("Roman") && !!document.querySelector('[role="gridcell"], button.home-play, .board')`,
      returnByValue: true,
    }, sessionId)
    report.push({
      build: portal.name,
      check: 'storage-denied',
      shot: deniedShot,
      played: stillThere,
      placed,
      alive: afterDeny.result.value,
      exceptions: denied.exceptions.slice(0, 8),
    })
  }

  // Reload save on CrazyGames.
  await open('http://127.0.0.1:4174/', 1280, 720, false, false)
  await click('button.home-play')
  await click('[role="gridcell"]')
  await delay(400)
  await send('Page.reload', {}, sessionId)
  await delay(1500)
  const reloaded = await send('Runtime.evaluate', {
    expression: `document.body.innerText.includes('Resume')`,
    returnByValue: true,
  }, sessionId)
  const reloadShot = await shoot('crazygames-reload-resume')
  report.push({ build: 'crazygames', check: 'reload-resume', resume: reloaded.result.value, shot: reloadShot })

  writeFileSync(`${outDir}/portal-browser-qa.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  ws.close()
}

try {
  await delay(400)
  await run()
} finally {
  stop()
}
