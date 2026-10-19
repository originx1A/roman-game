import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)

const U = await import('../src/game/voiceUnlock.ts')
const lines = await import('../src/game/voiceLines.ts')

test('prime still runs while a line is only loading, and not over an audible one', () => {
  assert.equal(U.shouldStartPrime({ priming: false, unlocked: false, needsGesture: true, audible: false }), true)
  // The old unlock bailed out on any current line. Loading is not audible, so the tap must still prime.
  assert.equal(U.shouldStartPrime({ priming: false, unlocked: false, needsGesture: true, audible: false }), true)
  assert.equal(U.shouldStartPrime({ priming: true, unlocked: false, needsGesture: true, audible: false }), false)
  assert.equal(U.shouldStartPrime({ priming: false, unlocked: true, needsGesture: false, audible: false }), false)
  assert.equal(U.shouldStartPrime({ priming: false, unlocked: true, needsGesture: true, audible: false }), true)
  assert.equal(U.shouldStartPrime({ priming: false, unlocked: true, needsGesture: true, audible: true }), false)
})

test('play() rejections are classified, and a blocked line stays retryable only for a few seconds', () => {
  assert.equal(U.classifyPlayRejection({ name: 'NotAllowedError', message: 'The request is not allowed by the user agent' }), 'not-allowed')
  assert.equal(U.classifyPlayRejection(new DOMException('interrupted by pause()', 'AbortError')), 'aborted')
  assert.equal(U.classifyPlayRejection(new Error('decode')), 'failed')
  assert.equal(U.pauseEndsLine({ paused: true, ended: false, sincePlayMs: 10 }), false)
  assert.equal(U.pauseEndsLine({ paused: true, ended: false, sincePlayMs: 400 }), true)
  assert.equal(U.pauseEndsLine({ paused: false, ended: false, sincePlayMs: 4000 }), false)
  assert.equal(U.retryStillFresh(1000, 1000 + U.VOICE_RETRY_TTL_MS), true)
  assert.equal(U.retryStillFresh(1000, 1000 + U.VOICE_RETRY_TTL_MS + 1), false)
  assert.equal(U.shouldAttachVoiceGraph('running', false), true)
  assert.equal(U.shouldAttachVoiceGraph('suspended', false), false)
  assert.equal(U.shouldAttachVoiceGraph('running', true), false)
})

test('preload order is Roman first, and every catalog file exists with that exact name', () => {
  const ids = lines.preloadClipIds()
  assert.equal(ids[0], 'nudge')
  const romanAt = ids.indexOf('roman_awesome')
  const coachTail = ids.indexOf('coach_idle_take')
  assert.ok(romanAt > 0 && romanAt < coachTail, 'Roman clips are fetched before the long coach tail')
  assert.equal(ids.includes('old_wrong_stick'), false)
  const root = new URL('..', import.meta.url)
  for (const [id, href] of Object.entries(lines.VOICE_LINES)) {
    assert.equal(href, `/voices/${id}.mp3`)
    assert.equal(existsSync(new URL(`public/voices/${id}.mp3`, root)), true, id)
  }
  const sound = readFileSync(new URL('../src/game/sound.ts', import.meta.url), 'utf8')
  assert.equal(sound.includes('if (voiceUnlocked || currentLine) return'), false)
  assert.match(sound, /shouldStartPrime/)
  assert.match(sound, /\[voice\]/)
})

class FakeAudio {
  src = ''
  paused = true
  ended = false
  error: MediaError | null = null
  currentTime = 0
  duration = 1.2
  volume = 1
  playbackRate = 1
  defaultPlaybackRate = 1
  preservesPitch = false
  webkitPreservesPitch = false
  preload = ''
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onpause: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  session = false
  failNextReal = false
  pauseCount = 0
  /** True if pause() landed while the silent primer's play() was still settling. */
  primeInterrupted = false
  private inflightPrime = false
  plays: { src: string; prime: boolean }[] = []
  private attrs: Record<string, string> = {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = v
  }
  getAttribute(k: string) {
    return this.attrs[k] ?? null
  }
  removeAttribute(k: string) {
    delete this.attrs[k]
  }
  load() {}
  play(): Promise<void> {
    const prime = this.getAttribute('data-voice-prime') === '1'
    this.paused = false
    this.plays.push({ src: this.src, prime })
    if (prime) this.inflightPrime = true
    return new Promise((resolve, reject) => {
      queueMicrotask(() => {
        if (prime) this.inflightPrime = false
        if (this.paused) {
          reject(new DOMException('The play() request was interrupted by a call to pause()', 'AbortError'))
          return
        }
        if (!prime && this.failNextReal) {
          this.failNextReal = false
          this.session = false
          reject(new DOMException('The request is not allowed by the user agent.', 'NotAllowedError'))
          return
        }
        if (!prime && !this.session) {
          reject(new DOMException('The request is not allowed by the user agent.', 'NotAllowedError'))
          return
        }
        this.session = true
        resolve()
      })
    })
  }
  pause() {
    this.pauseCount += 1
    if (this.inflightPrime) this.primeInterrupted = true
    this.paused = true
    this.onpause?.()
  }
}

class FakeCtx {
  state: AudioContextState = 'suspended'
  currentTime = 0
  sampleRate = 44100
  destination = {}
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  createOscillator() {
    return { connect() {}, start() {}, stop() {}, frequency: { value: 0 } }
  }
  createGain() {
    return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }
  }
  createMediaElementSource() {
    return { connect() {} }
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(8) }
  }
  createBufferSource() {
    return { connect() {}, start() {}, stop() {}, buffer: null }
  }
  createBiquadFilter() {
    return { connect() {}, type: '', frequency: { value: 0 } }
  }
}

const audio = new FakeAudio()
const listeners: Record<string, Array<() => void>> = {}
Object.assign(globalThis, {
  window: globalThis,
  Audio: function Audio() {
    return audio
  },
  document: {
    visibilityState: 'visible',
    addEventListener(type: string, fn: () => void) {
      ;(listeners[type] ||= []).push(fn)
    },
    removeEventListener() {},
  },
})
const g = globalThis as unknown as { AudioContext: typeof FakeCtx; webkitAudioContext: typeof FakeCtx }
g.AudioContext = FakeCtx
g.webkitAudioContext = FakeCtx
let blobN = 0
URL.createObjectURL = () => `blob:voice-${++blobN}`

const mp3 = new Uint8Array(64)
mp3[0] = 0x49
mp3[1] = 0x44
mp3[2] = 0x33
let fetchMode: 'mp3' | 'html' | 'hold' = 'mp3'
let releaseFetch: (() => void) | null = null

globalThis.fetch = (async () => {
  if (fetchMode === 'hold') {
    await new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
  }
  if (fetchMode === 'html') {
    const body = new TextEncoder().encode('<!doctype html><html></html>').buffer
    return { ok: true, headers: { get: () => 'text/html' }, arrayBuffer: async () => body }
  }
  return { ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => mp3.buffer }
}) as typeof fetch

const sound = await import('../src/game/sound.ts')

const warns: string[] = []
const origWarn = console.warn
console.warn = (...args: unknown[]) => {
  warns.push(args.map(String).join(' '))
}

async function flush() {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function resetAudio() {
  audio.onended = null
  audio.onerror = null
  audio.onpause = null
  audio.onloadedmetadata = null
  audio.ontimeupdate = null
  sound.resetVoiceForTests()
  audio.session = false
  audio.failNextReal = false
  audio.pauseCount = 0
  audio.primeInterrupted = false
  audio.plays = []
  audio.paused = true
  audio.ended = false
  audio.currentTime = 0
  audio.error = null
  fetchMode = 'mp3'
  releaseFetch = null
  warns.length = 0
}

test('same tap: the silent unlock is not paused, then the Roman clip plays', async () => {
  resetAudio()
  sound.unlockAudio()
  sound.playVoice('roman_awesome')
  assert.equal(audio.primeInterrupted, false, 'pausing the primer on this tap is what iOS rejects')
  assert.equal(audio.plays[0]?.prime, true)
  await flush()
  const voiced = audio.plays.filter((p) => !p.prime)
  assert.equal(voiced.length, 1)
  assert.equal(audio.session, true)
  assert.equal(warns.filter((w) => w.includes('[voice]')).join('\n'), '')
  assert.equal(sound.voiceQuietMs(), null)
})

test('a line that starts loading before unlock still gets a gesture prime', async () => {
  resetAudio()
  fetchMode = 'hold'
  sound.playVoice('roman_legend')
  assert.equal(audio.plays[0]?.prime, true)
  assert.equal(audio.primeInterrupted, false)
  // The channel is busy loading, which used to make unlockAudio return without priming.
  sound.unlockAudio()
  assert.equal(audio.plays.filter((p) => p.prime).length, 1)
  fetchMode = 'mp3'
  releaseFetch?.()
  await flush()
  assert.equal(audio.plays.some((p) => !p.prime), true)
  assert.equal(warns.filter((w) => w.includes('[voice]')).join('\n'), '')
})

test('a rejected play() is warned with the file name and retried once on the next tap', async () => {
  resetAudio()
  audio.failNextReal = true
  sound.unlockAudio()
  sound.playVoice('roman_awesome')
  await flush()
  const blocked = warns.filter((w) => w.includes('[voice]') && w.includes('roman_awesome.mp3'))
  assert.equal(blocked.length, 1)
  assert.match(blocked[0], /not-allowed/)
  assert.match(blocked[0], /retry once/)
  assert.equal(audio.plays.filter((p) => !p.prime).length, 1)
  warns.length = 0
  sound.unlockAudio()
  await flush()
  assert.equal(audio.plays.filter((p) => !p.prime).length, 2)
  assert.equal(warns.filter((w) => w.includes('[voice]')).join('\n'), '')
  // That retry is now playing. End it, then a retry that fails is not armed again.
  audio.onended?.()
  await flush()
  const realBefore = audio.plays.filter((p) => !p.prime).length
  audio.failNextReal = true
  audio.session = false
  sound.playVoice('roman_cook', { retry: true })
  await flush()
  sound.unlockAudio()
  await flush()
  assert.equal(audio.plays.filter((p) => !p.prime).length, realBefore + 1)
  const cook = warns.filter((w) => w.includes('roman_cook.mp3'))
  assert.equal(cook.length, 1)
  assert.match(cook[0], /Giving up after one retry/)
})

test('a missing voice file warns and does not throw', async () => {
  resetAudio()
  fetchMode = 'html'
  sound.unlockAudio()
  assert.doesNotThrow(() => sound.playVoice('roman_nope'))
  await flush()
  assert.match(warns.join('\n'), /roman_nope\.mp3: missing or not an audio file/)
  assert.equal(sound.voiceQuietMs() !== null, true)
})

test('muted voices stay silent and do not warn', async () => {
  resetAudio()
  sound.setMuted(true)
  sound.unlockAudio()
  sound.playVoice('roman_awesome')
  await flush()
  assert.equal(audio.plays.filter((p) => !p.prime).length, 0)
  assert.equal(warns.filter((w) => w.includes('[voice]')).join('\n'), '')
  sound.setMuted(false)
})

test('a finished line drops its pause handler before the next unlock', async () => {
  resetAudio()
  sound.unlockAudio()
  sound.playVoice('roman_win')
  await flush()
  assert.equal(typeof audio.onpause, 'function')
  audio.onended?.()
  await flush()
  assert.equal(audio.onpause, null)
  assert.equal(sound.voiceQuietMs() !== null, true)
  sound.unlockAudio()
  await flush()
  assert.equal(audio.onpause, null)
  assert.equal(audio.plays.filter((p) => !p.prime).length, 1)
})

test('an immediate pause after play() does not drop the line', async () => {
  resetAudio()
  sound.unlockAudio()
  sound.playVoice('roman_win')
  await flush()
  assert.equal(sound.voiceQuietMs(), null)
  audio.paused = true
  audio.currentTime = 0
  audio.onpause?.()
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal(sound.voiceQuietMs(), null)
  assert.ok(audio.plays.filter((p) => !p.prime).length >= 2)
})

test.after(() => {
  console.warn = origWarn
  sound.resetVoiceForTests()
})
