import assert from 'node:assert/strict'
import test from 'node:test'
import { handleShare, type ShareStore } from '../netlify/functions/share.ts'
import { publicShortLink } from '../src/game/publicUrl.ts'
import { challengeFromPayload, type ShareRecord } from '../src/game/shareRecord.ts'

function memoryStore(): ShareStore {
  const map = new Map<string, ShareRecord>()
  return {
    async setJSON(key, value) {
      map.set(key, JSON.parse(JSON.stringify(value)) as ShareRecord)
    },
    async get(key) {
      return map.get(key) ?? null
    },
  }
}

test('a challenge link round-trips through /c/<id> with the same board, message, and score', async () => {
  const store = memoryStore()
  const payload = {
    c: 'ABC234',
    p: 'dawn',
    f: 'Roman',
    m: 'Can you beat Roman on this board?',
    t: 1500,
    s: 1036,
    pn: 'Dawn',
    d: 'Easy',
    bp: 2,
    bb: 3.2,
  }
  const created = await handleShare(
    new Request('https://romans-game.netlify.app/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'challenge', payload }),
    }),
    store,
  )
  assert.equal(created.status, 200)
  const { id } = (await created.json()) as { id: string }
  const link = publicShortLink(id)
  assert.match(link, /^https:\/\/romans-game\.netlify\.app\/c\/[a-z0-9]{8}\?s=2$/)
  assert.ok(link.length < 80, link)

  const idFromLink = new URL(link).pathname.split('/').pop()
  assert.equal(idFromLink, id)
  const opened = await handleShare(new Request(`https://romans-game.netlify.app/api/share?id=${id}`), store)
  assert.equal(opened.status, 200)
  const saved = (await opened.json()) as ShareRecord
  const challenge = challengeFromPayload(saved.payload)
  assert.equal(challenge?.puzzleId, 'dawn')
  assert.equal(challenge?.puzzleName, 'Dawn')
  assert.equal(challenge?.difficulty, 'Easy')
  assert.equal(challenge?.message, 'Can you beat Roman on this board?')
  assert.equal(challenge?.scoreMs, 1500)
  assert.equal(challenge?.scorePts, 1036)
  assert.equal(challenge?.fromName, 'Roman')
})

test('a bad share is rejected and a missing id is not found', async () => {
  const store = memoryStore()
  const rejected = await handleShare(
    new Request('https://romans-game.netlify.app/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'challenge', payload: { hello: 'world' } }),
    }),
    store,
  )
  assert.equal(rejected.status, 400)
  const missing = await handleShare(new Request('https://romans-game.netlify.app/api/share?id=abcd2345'), store)
  assert.equal(missing.status, 404)
})
