import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'
import { DOMParser } from '@xmldom/xmldom'

register('./ts-resolve.mjs', import.meta.url)

const time = await import('../netlify/lib/newsTime.ts')
const source = await import('../netlify/lib/newsSource.ts')
const rotation = await import('../netlify/lib/newsRotation.ts')
const client = await import('../netlify/lib/kitClient.ts')
const news = await import('../netlify/lib/kitNews.ts')
const welcome = await import('../netlify/lib/welcomeCopy.ts')

const POSTAL = '123 King Street, Toronto ON M5H 1A1'

function enabled(over: Record<string, string | undefined> = {}) {
  return {
    CONTEXT: 'production',
    KIT_SEND_ENABLED: 'true',
    KIT_API_KEY: 'kit-test-key',
    KIT_ADMIN_SECRET: 'admin-test-secret',
    RESEND_API_KEY: 'resend-test-key',
    NEWS_POSTAL_ADDRESS: POSTAL,
    URL: 'https://play.romansgame.com',
    ...over,
  }
}

function story(id: string, date: string, extra: Partial<source.Story> = {}): source.Story {
  return {
    id,
    title: extra.title ?? id,
    excerpt: extra.excerpt ?? `Excerpt for ${id}`,
    link: `https://romansgame.com/news/${id}/`,
    date,
    image: extra.image,
    sourceIndex: extra.sourceIndex ?? 0,
  }
}

function quietFetch(): typeof fetch {
  return (async () => new Response('no', { status: 404 })) as typeof fetch
}

function fakeKit() {
  const calls: { name: string; body?: unknown }[] = []
  let failBroadcasts = 0
  const api: client.KitApi = {
    async createBroadcast(draft) {
      calls.push({ name: 'broadcast', body: draft })
      if (failBroadcasts > 0) {
        failBroadcasts -= 1
        throw new Error('kit down')
      }
      return 42
    },
    async ensureTag(name) {
      calls.push({ name: `ensure:${name}` })
      return name === 'welcome-sent' ? 7 : 3
    },
    async createSubscriber() {
      calls.push({ name: 'create' })
      return 11
    },
    async addToForm(formId) {
      calls.push({ name: `form:${formId}` })
    },
    async tagSubscriber(tagId, subscriberId) {
      calls.push({ name: `tag:${tagId}:${subscriberId}` })
    },
    async subscriberTagNames() {
      return []
    },
    async findSubscriber() {
      return 11
    },
    async unsubscribe() {
      calls.push({ name: 'unsubscribe' })
    },
  }
  return {
    api,
    calls,
    failNext(n: number) {
      failBroadcasts = n
    },
  }
}

function captureLogs(run: () => Promise<void>): Promise<string> {
  const lines: string[] = []
  const orig = console.log
  console.log = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(' '))
  }
  return run().finally(() => {
    console.log = orig
  }).then(() => lines.join('\n'))
}

test('feed escapes text, orders newest first, and writes RFC 822 pubDate', () => {
  const html = [
    '<a class="ncard" href="older-story/"><h2>Older</h2><div class="nex">Plain</div><div class="nmeta">2026-10-15</div></a>',
    '<a class="ncard" href="newer-story/"><h2>A &amp; B &lt;C&gt;</h2><div class="nex">x &quot;y&quot;</div><div class="nmeta">2026-10-16</div></a>',
    '<a class="ncard" href="same-day/"><h2>Roman&#x27;s</h2><div class="nex">Same</div><img src="pic.png"><div class="nmeta">2026-10-16</div></a>',
  ].join('')
  const parsed = source.parseNewsIndex(html)
  assert.equal(parsed[1]?.title, 'A & B <C>')
  assert.equal(parsed[2]?.title, "Roman's")
  assert.equal(parsed[2]?.image, 'https://romansgame.com/news/pic.png')
  const xml = source.renderRss(parsed, 'https://play.romansgame.com/news/feed.xml')
  const items = [...xml.matchAll(/<title>([^<]*)<\/title>/g)].map((match) => match[1])
  assert.deepEqual(items.slice(1), ['A &amp; B &lt;C&gt;', 'Roman&apos;s', 'Older'])
  assert.match(xml, /<description>x &quot;y&quot;<\/description>/)
  assert.match(xml, /<guid isPermaLink="false">newer-story<\/guid>/)
  assert.match(xml, /<link>https:\/\/romansgame.com\/news\/newer-story\/<\/link>/)
  assert.match(xml, /16 Oct 2026 13:07:00 \+0000/)
  assert.match(xml, /15 Oct 2026 13:07:00 \+0000/)
  assert.doesNotMatch(xml, /&amp;amp;/)
  assert.equal(source.storyForDate(parsed, '2026-10-16')?.id, 'newer-story')
  assert.equal(source.storyForDate(parsed, '2026-10-18'), null)

  const errors: string[] = []
  const doc = new DOMParser({
    onError(level, message) {
      if (level === 'error' || level === 'fatalError') errors.push(`${level}: ${message}`)
    },
  }).parseFromString(xml, 'text/xml')
  assert.deepEqual(errors, [])
  const rss = doc.documentElement
  assert.equal(rss?.nodeName, 'rss')
  assert.equal(rss?.getAttribute('version'), '2.0')
  const channel = doc.getElementsByTagName('channel')[0]
  assert.equal(channel?.getElementsByTagName('title')[0]?.textContent, "Roman's World News")
  assert.equal(channel?.getElementsByTagName('link')[0]?.textContent, 'https://romansgame.com/news/')
  const parsedItems = [...doc.getElementsByTagName('item')]
  assert.equal(parsedItems.length, 3)
  assert.equal(parsedItems[0]?.getElementsByTagName('title')[0]?.textContent, 'A & B <C>')
  assert.equal(parsedItems[0]?.getElementsByTagName('description')[0]?.textContent, 'x "y"')
  assert.equal(parsedItems[0]?.getElementsByTagName('link')[0]?.textContent, 'https://romansgame.com/news/newer-story/')
  assert.equal(parsedItems[0]?.getElementsByTagName('pubDate')[0]?.textContent, 'Fri, 16 Oct 2026 13:07:00 +0000')
  const guid = parsedItems[0]?.getElementsByTagName('guid')[0]
  assert.equal(guid?.getAttribute('isPermaLink'), 'false')
  assert.equal(guid?.textContent, 'newer-story')
})

test('public/_redirects sends the feed and the Kit APIs to functions before the SPA fallback', () => {
  const rules = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
  const feed = rules.search(/^\/news\/feed\.xml\s+\/\.netlify\/functions\/news-feed\s+200!/m)
  const api = rules.search(/^\/api\/\*\s+\/\.netlify\/functions\/:splat\s+200!/m)
  const spa = rules.search(/^\/\*\s+\/index\.html\s+200/m)
  assert.ok(feed >= 0, 'feed rewrite')
  assert.ok(api >= 0, 'api rewrite')
  assert.ok(spa > feed && spa > api, 'SPA catch-all is last')
})

test('edition time is 09:07 Toronto in both EST and EDT', () => {
  assert.equal(time.editionInstant('2026-01-15').toISOString(), '2026-01-15T14:07:00.000Z')
  assert.equal(time.editionInstant('2026-07-15').toISOString(), '2026-07-15T13:07:00.000Z')
  assert.equal(time.editionInstant('2026-03-08').toISOString(), '2026-03-08T13:07:00.000Z')
  assert.equal(time.editionInstant('2026-11-01').toISOString(), '2026-11-01T14:07:00.000Z')
})

test('the two UTC crons produce one Toronto send, including DST changeover days', () => {
  const pairs = [
    ['2026-07-15T13:20:00Z', '2026-07-15T14:20:00Z'],
    ['2026-01-15T13:20:00Z', '2026-01-15T14:20:00Z'],
    ['2026-03-08T13:20:00Z', '2026-03-08T14:20:00Z'],
    ['2026-11-01T13:20:00Z', '2026-11-01T14:20:00Z'],
  ]
  for (const [first, second] of pairs) {
    const hits = [first, second].filter((iso) => time.torontoShouldSend(new Date(iso)))
    assert.equal(hits.length, 1, hits.join(','))
  }
  assert.equal(time.torontoShouldSend(new Date('2026-07-15T13:20:00Z')), true)
  assert.equal(time.torontoShouldSend(new Date('2026-07-15T14:20:00Z')), false)
  assert.equal(time.torontoShouldSend(new Date('2026-01-15T13:20:00Z')), false)
  assert.equal(time.torontoShouldSend(new Date('2026-01-15T14:20:00Z')), true)
  assert.equal(time.torontoShouldSend(new Date('2026-03-08T13:20:00Z')), true)
  assert.equal(time.torontoShouldSend(new Date('2026-11-01T13:20:00Z')), false)
  assert.equal(time.torontoShouldSend(new Date('2026-11-01T14:20:00Z')), true)
})

test('daily run outside the Toronto window does not fetch or send', async () => {
  let called = false
  const fetchImpl = (async () => {
    called = true
    return new Response('no', { status: 500 })
  }) as typeof fetch
  const result = await news.runDaily(
    { env: enabled(), store: news.memoryJsonStore(), fetchImpl, now: new Date('2026-07-15T14:20:00Z') },
    { dryRun: false },
  )
  assert.equal(result.reason, 'schedule')
  assert.equal(called, false)
})

test('rotation picks the oldest unused story and never repeats; low stock is under 14', () => {
  const pool = [
    { id: 'b', title: 'B', excerpt: '', link: 'https://example.com/b', addedAt: '2026-02-01T00:00:00.000Z', usedOn: null },
    { id: 'a', title: 'A', excerpt: '', link: 'https://example.com/a', addedAt: '2026-01-01T00:00:00.000Z', usedOn: null },
  ]
  assert.equal(rotation.pickOldestUnused(pool)?.id, 'a')
  const once = rotation.markStoryUsed(pool, 'a', '2026-10-18')
  assert.equal(rotation.pickOldestUnused(once)?.id, 'b')
  assert.equal(rotation.pickOldestUnused(rotation.markStoryUsed(once, 'b', '2026-10-19')), null)
  const fourteen = Array.from({ length: 14 }, (_, i) => ({
    id: `s${i}`,
    title: `t${i}`,
    excerpt: '',
    link: `https://example.com/${i}`,
    addedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    usedOn: null,
  }))
  assert.equal(rotation.isLowStock(fourteen), false)
  assert.equal(rotation.isLowStock(fourteen.slice(0, 13)), true)
})

test('a real pool under 14 unused stories alerts support once', async () => {
  const store = news.memoryJsonStore()
  await store.setJSON('story-pool', [
    { id: 'only', title: 'Only', excerpt: 'e', link: 'https://example.com/only', addedAt: '2026-01-01T00:00:00.000Z' },
  ])
  const hits: string[] = []
  const fetchImpl = (async (url: string) => {
    hits.push(String(url))
    return new Response('<html></html>', { status: 200 })
  }) as typeof fetch
  const now = new Date('2026-07-15T13:20:00Z')
  await news.runDaily({ env: enabled(), store, fetchImpl, now }, { dryRun: false, ignoreSchedule: true })
  await news.runDaily({ env: enabled(), store, fetchImpl, now }, { dryRun: false, ignoreSchedule: true })
  const alerts = hits.filter((url) => url.includes('api.resend.com'))
  assert.equal(alerts.length, 1)
})

test('broadcast is idempotent across a second run, a concurrent run, and a retry after failure', async () => {
  const item = story('alpha-story', '2026-07-15', { title: 'Alpha & Beta' })
  const kit = fakeKit()
  const store = news.memoryJsonStore()
  const deps = { env: enabled(), store, kit: kit.api, fetchImpl: quietFetch(), now: new Date('2026-07-15T13:20:00Z') }
  const first = await news.deliverStory(deps, item, { dryRun: false, force: false })
  const second = await news.deliverStory(deps, item, { dryRun: false, force: false })
  assert.equal(first.action, 'sent')
  assert.equal(first.broadcastId, 42)
  assert.equal(second.reason, 'already-sent')
  assert.equal(kit.calls.filter((call) => call.name === 'broadcast').length, 1)
  const draft = kit.calls.find((call) => call.name === 'broadcast')?.body as { content?: string; subscriber_filter?: unknown }
  assert.match(draft.content ?? '', /\{\{ unsubscribe_url \}\}/)
  assert.match(draft.content ?? '', /\{\{ address \}\}/)
  assert.deepEqual((draft as { subscriber_filter?: unknown }).subscriber_filter, [
    { all: [{ type: 'tag', ids: [3] }], any: null, none: null },
  ])
  assert.equal(JSON.stringify(draft).includes('kit-test-key'), false)
  const forced = await news.deliverStory(deps, item, { dryRun: false, force: true })
  assert.equal(forced.action, 'sent')
  assert.equal(kit.calls.filter((call) => call.name === 'broadcast').length, 2)

  const shared = news.memoryJsonStore()
  const sharedKit = fakeKit()
  const raced = await Promise.all([
    news.deliverStory({ ...deps, store: shared, kit: sharedKit.api }, item, { dryRun: false, force: false }),
    news.deliverStory({ ...deps, store: shared, kit: sharedKit.api }, item, { dryRun: false, force: false }),
  ])
  assert.equal(sharedKit.calls.filter((call) => call.name === 'broadcast').length, 1)
  assert.equal(raced.filter((row) => row.action === 'sent').length, 1)
  assert.equal(raced.filter((row) => row.reason === 'in-progress' || row.reason === 'already-sent').length, 1)

  const retry = fakeKit()
  retry.failNext(1)
  const retryStore = news.memoryJsonStore()
  const failed = await news.deliverStory({ ...deps, store: retryStore, kit: retry.api }, item, { dryRun: false, force: false })
  const recovered = await news.deliverStory({ ...deps, store: retryStore, kit: retry.api }, item, { dryRun: false, force: false })
  assert.equal(failed.action, 'failed')
  assert.equal(recovered.action, 'sent')
  assert.equal(retry.calls.filter((call) => call.name === 'broadcast').length, 2)
})

test('dry-run logs the payload and a preview or unset flag does not send', async () => {
  const item = story('alpha-story', '2026-07-15', { title: 'Alpha' })
  const kit = fakeKit()
  const logs = await captureLogs(async () => {
    const dry = await news.deliverStory(
      { env: enabled(), store: news.memoryJsonStore(), kit: kit.api, fetchImpl: quietFetch(), now: new Date() },
      item,
      { dryRun: true, force: false },
    )
    assert.equal(dry.action, 'dry-run')
    const preview = await news.deliverStory(
      { env: enabled({ CONTEXT: 'deploy-preview' }), store: news.memoryJsonStore(), kit: kit.api, fetchImpl: quietFetch(), now: new Date() },
      item,
      { dryRun: false, force: false },
    )
    assert.equal(preview.reason, 'send disabled')
    const off = await news.deliverStory(
      { env: enabled({ KIT_SEND_ENABLED: undefined }), store: news.memoryJsonStore(), kit: kit.api, fetchImpl: quietFetch(), now: new Date() },
      item,
      { dryRun: false, force: false },
    )
    assert.equal(off.reason, 'send disabled')
  })
  assert.match(logs, /dry-run/)
  assert.match(logs, /send disabled/)
  assert.equal(logs.includes('kit-test-key'), false)
  assert.equal(kit.calls.some((call) => call.name === 'broadcast'), false)
})

test('send-now rejects a bad secret and force without a story id', async () => {
  const deps = { env: enabled(), store: news.memoryJsonStore(), fetchImpl: quietFetch() }
  const missing = await news.handleSendNow(new Request('https://play.romansgame.com/api/kit-send-now', { method: 'POST' }), deps)
  assert.equal(missing.status, 401)
  const wrong = await news.handleSendNow(
    new Request('https://play.romansgame.com/api/kit-send-now', { method: 'POST', headers: { 'x-kit-admin-secret': 'nope' } }),
    deps,
  )
  assert.equal(wrong.status, 401)
  const forced = await news.handleSendNow(
    new Request('https://play.romansgame.com/api/kit-send-now?force=1', {
      method: 'POST',
      headers: { 'x-kit-admin-secret': 'admin-test-secret' },
    }),
    deps,
  )
  assert.equal(forced.status, 400)
})

test('welcome email unsubscribes in one click, with list headers and a mailing address', async () => {
  const store = news.memoryJsonStore()
  const kit = fakeKit()
  let resendBody = ''
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.resend.com')) {
      resendBody = String(init?.body ?? '')
      return new Response('{}', { status: 200 })
    }
    return new Response('no', { status: 404 })
  }) as typeof fetch
  const deps = { env: enabled(), store, kit: kit.api, fetchImpl }
  const sent = await news.sendWelcome(deps, 'Ada@Example.com', 11, { dryRun: false })
  assert.equal(sent.action, 'sent')
  const payload = JSON.parse(resendBody) as { from: string; subject: string; text: string; html: string; headers: Record<string, string> }
  assert.equal(payload.subject, welcome.WELCOME_SUBJECT)
  assert.match(payload.from, /support@romansgame.com/)
  assert.match(payload.text, /Hi there, and welcome to Roman's World!/)
  assert.match(payload.html, /Your first story arrives with the next morning edition/)
  assert.match(payload.text, new RegExp(`Mailing address: ${POSTAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  assert.match(payload.html, /Mailing address:/)
  const token = /token=([a-f0-9]{64})/.exec(payload.text)?.[1]
  assert.ok(token)
  const link = `https://play.romansgame.com/api/kit-unsubscribe?token=${token}`
  assert.match(payload.text, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(payload.html, new RegExp(`href="${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.equal(payload.headers['List-Unsubscribe'], `<${link}>`)
  assert.equal(payload.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.equal(resendBody.includes('resend-test-key'), false)

  const page = await news.handleUnsubscribe(new Request(link), deps)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /unsubscribed/i)
  assert.ok(kit.calls.some((call) => call.name === 'unsubscribe'))
  assert.equal(await news.isSuppressed(store, 'ada@example.com'), true)
  const again = await news.sendWelcome(deps, 'ada@example.com', 11, { dryRun: false })
  assert.equal(again.reason, 'suppressed')

  const post = await news.handleUnsubscribe(
    new Request(link, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }),
    deps,
  )
  assert.equal(post.status, 200)
  assert.equal(await post.text(), 'unsubscribed')
})

test('a failed Kit unsubscribe is recorded and blocks the welcome', async () => {
  const store = news.memoryJsonStore()
  const kit = fakeKit()
  kit.api.unsubscribe = async () => {
    kit.calls.push({ name: 'unsubscribe-fail' })
    throw new Error('kit down')
  }
  const token = 'ab'.repeat(32)
  await store.setJSON(`unsub/${token}`, { email: 'bey@example.com', subscriberId: 11 })
  const deps = { env: enabled(), store, kit: kit.api, fetchImpl: quietFetch() }
  const result = await news.unsubscribeByToken(deps, token)
  assert.equal(result.ok, true)
  assert.equal(await news.isSuppressed(store, 'bey@example.com'), true)
  const welcomeSend = await news.sendWelcome(deps, 'bey@example.com', 11, { dryRun: false })
  assert.equal(welcomeSend.reason, 'suppressed')
  const pending = await store.get(`pending-unsub/${news.emailHash('bey@example.com')}`, { type: 'json' })
  assert.ok(pending)
})

test('a failed send emails support, and logs ERROR when Resend is unset', async () => {
  const item = story('alpha-story', '2026-07-15')
  const kit = fakeKit()
  kit.failNext(1)
  const hits: string[] = []
  const fetchImpl = (async (url: string) => {
    hits.push(String(url))
    return new Response('{}', { status: 200 })
  }) as typeof fetch
  await news.deliverStory(
    { env: enabled(), store: news.memoryJsonStore(), kit: kit.api, fetchImpl, now: new Date() },
    item,
    { dryRun: false, force: false },
  )
  assert.ok(hits.some((url) => url.includes('api.resend.com')))
  const logs = await captureLogs(async () => {
    const again = fakeKit()
    again.failNext(1)
    await news.deliverStory(
      { env: enabled({ RESEND_API_KEY: undefined }), store: news.memoryJsonStore(), kit: again.api, fetchImpl: quietFetch(), now: new Date() },
      item,
      { dryRun: false, force: false },
    )
  })
  assert.match(logs, /ERROR support alert not sent/)
  assert.equal(logs.includes('kit-test-key'), false)
})

test('kit client backs off, honors Retry-After, times out, and does not retry a 4xx', async () => {
  const draft: client.BroadcastDraft = {
    subject: 'S',
    preview_text: 'P',
    description: 'D',
    content: '<p>Hi</p>',
    public: false,
    published_at: '2026-10-15T13:07:00.000Z',
    send_at: '2026-10-15T13:21:00.000Z',
    subscriber_filter: client.subscriberFilter({ type: 'tag', id: 3 }),
  }
  const sleeps: number[] = []
  const sleep = async (ms: number) => {
    sleeps.push(ms)
  }

  const tooMany = [new Response('no', { status: 500 }), new Response('no', { status: 500 }), new Response(JSON.stringify({ broadcast: { id: 9 } }), { status: 201 })]
  let step = 0
  const five = createFetch(() => tooMany[step++] ?? new Response('no', { status: 500 }))
  const kit = client.createKitClient({ apiKey: 'super-secret-kit', fetchImpl: five, sleep, random: () => 0, maxAttempts: 4 })
  const logs = await captureLogs(async () => {
    assert.equal(await kit.createBroadcast(draft), 9)
  })
  assert.deepEqual(sleeps, [client.retryDelayMs(0, () => 0), client.retryDelayMs(1, () => 0)])
  assert.equal(logs.includes('super-secret-kit'), false)

  sleeps.length = 0
  const limited = [
    new Response('slow', { status: 429, headers: { 'retry-after': '2' } }),
    new Response(JSON.stringify({ broadcast: { id: 4 } }), { status: 201 }),
  ]
  step = 0
  const throttled = client.createKitClient({
    apiKey: 'k',
    fetchImpl: createFetch(() => limited[step++] ?? new Response('no', { status: 500 })),
    sleep,
    random: () => 0,
    maxAttempts: 3,
  })
  assert.equal(await throttled.createBroadcast(draft), 4)
  assert.deepEqual(sleeps, [2000])

  const rejected = client.createKitClient({
    apiKey: 'k',
    fetchImpl: createFetch(() => new Response(JSON.stringify({ errors: ['nope'] }), { status: 422 })),
    sleep: async () => {
      throw new Error('should not retry')
    },
    maxAttempts: 4,
  })
  await assert.rejects(() => rejected.createBroadcast(draft), /kit HTTP 422/)

  let attempts = 0
  const hanging = (async (_url: string, init?: RequestInit) => {
    attempts += 1
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      })
    })
  }) as typeof fetch
  const slow = client.createKitClient({ apiKey: 'k', fetchImpl: hanging, timeoutMs: 20, maxAttempts: 2, sleep: async () => {}, random: () => 0 })
  await assert.rejects(() => slow.findSubscriber('a@b.co'))
  assert.equal(attempts, 2)
  assert.equal(client.retryAfterMs('3', 0), 3000)
})

test('signup paths: in-game opt-in, /news/ bar, and the alternate feed link', () => {
  const game = readFileSync(new URL('../src/cloud/cloud.ts', import.meta.url), 'utf8')
  assert.match(game, /\/api\/kit-subscribe/)
  assert.match(game, /source: 'game'/)
  const page = readFileSync(new URL('../public/news/index.html', import.meta.url), 'utf8')
  assert.match(page, /rel="alternate" type="application\/rss\+xml"/)
  assert.match(page, /href="\/news\/feed\.xml"/)
  assert.match(page, /action="\/api\/kit-subscribe"/)
  const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
  assert.match(toml, /schedule = "20 13,14 \* \* \*"/)
})

function createFetch(next: () => Response): typeof fetch {
  return (async () => next()) as typeof fetch
}
