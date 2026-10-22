import assert from 'node:assert/strict'
import { register } from 'node:module'
import { test } from 'node:test'

register('./ts-resolve.mjs', import.meta.url)

const sfxStarts: number[] = []
let decodeCalls = 0
let playCalls = 0
let live: FakeAudioContext | null = null

class FakeAudioContext {
  state = 'suspended'
  currentTime = 0
  sampleRate = 8000
  destination = {}
  constructor() {
    live = this
  }
  resume() {
    if (this.state !== 'closed') this.state = 'running'
    return Promise.resolve()
  }
  decodeAudioData() {
    decodeCalls += 1
    return new Promise(() => {})
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      start() {
        sfxStarts.push(performance.now())
      },
      stop() {},
    }
  }
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    }
  }
  createBuffer(_ch: number, length: number) {
    const data = new Float32Array(Math.max(1, length))
    return { getChannelData: () => data }
  }
  createBufferSource() {
    return {
      buffer: null as unknown,
      connect() {},
      start() {
        sfxStarts.push(performance.now())
      },
      stop() {},
    }
  }
  createBiquadFilter() {
    return { type: 'bandpass', frequency: { value: 0 }, connect() {} }
  }
}

class FakeAudio extends EventTarget {
  src = ''
  volume = 1
  playbackRate = 1
  defaultPlaybackRate = 1
  paused = true
  ended = false
  error: MediaError | null = null
  duration = 3
  currentTime = 0
  preload = 'auto'
  preservesPitch = true
  webkitPreservesPitch = true
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onpause: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  private settle: ((err?: Error) => void) | null = null
  play() {
    playCalls += 1
    this.paused = false
    this.ended = false
    return new Promise<void>((_resolve, reject) => {
      this.settle = (err) => {
        this.settle = null
        if (err) reject(err)
      }
    })
  }
  pause() {
    this.paused = true
    this.settle?.(new Error('AbortError'))
  }
}

const mp3 = new Uint8Array(80)
mp3[0] = 0x49
mp3[1] = 0x44
mp3[2] = 0x33

const g = globalThis as typeof globalThis & {
  window: typeof globalThis
  Audio: typeof FakeAudio
  AudioContext: typeof FakeAudioContext
}
g.window = globalThis
g.Audio = FakeAudio
g.AudioContext = FakeAudioContext
g.fetch = (async () => ({
  ok: true,
  headers: { get: () => 'audio/mpeg' },
  arrayBuffer: async () => mp3.buffer.slice(0),
})) as typeof fetch
if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:voice'

const sound = await import('../src/game/sound.ts')

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('sound still plays after leaving and re-entering a board, three times', async () => {
  assert.equal(sound.OLDTIMER_PLAYBACK_RATE > 0, true)
  for (let cycle = 0; cycle < 3; cycle++) {
    if (live) live.state = cycle === 2 ? 'interrupted' : 'suspended'
    const entered = performance.now()
    sound.unlockAudio()
    assert.equal(live?.state, 'running', `cycle ${cycle} resumes a suspended context`)
    const beforeSfx = sfxStarts.length
    sound.sfxTap()
    assert.ok(sfxStarts.length > beforeSfx, `cycle ${cycle} plays a tap effect`)
    const latency = sfxStarts[sfxStarts.length - 1] - entered
    assert.ok(latency < 300, `cycle ${cycle} first effect was ${latency.toFixed(1)}ms after enter`)

    const beforeVoice = playCalls
    sound.playBanterClip('old_wrong_nope', 'neutral')
    await wait(40)
    assert.ok(playCalls > beforeVoice, `cycle ${cycle} asked the voice element to play`)

    await wait(1700)
    const afterTimeout = playCalls
    sound.playBanterClip('nice', 'happy')
    await wait(40)
    assert.ok(playCalls > afterTimeout, `cycle ${cycle} a timed-out clip blocked the next line`)

    sound.resetBoardAudio()
  }
  assert.equal(decodeCalls, 0, 'preload must not decode on the live AudioContext')
})
