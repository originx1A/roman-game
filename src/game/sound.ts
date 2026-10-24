/** Buddy place, X mark, and the recorded buddy giggles. Same tones as the previous game. */

let ctx: AudioContext | null = null
let muted = false
let volume = 0.8

const GIGGLES = ['/voices/buddy_giggle_1.mp3', '/voices/buddy_giggle_2.mp3', '/voices/buddy_giggle_3.mp3']
let giggleEl: HTMLAudioElement | null = null
let lastGiggle = -1
let voiceEl: HTMLAudioElement | null = null

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  try {
    localStorage.setItem('rg.muted', muted ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadSoundPrefs(): void {
  try {
    muted = localStorage.getItem('rg.muted') === '1'
    const stored = Number(localStorage.getItem('rg.volume'))
    if (Number.isFinite(stored)) volume = Math.min(1, Math.max(0, stored))
  } catch {
    /* ignore */
  }
}

export function getVolume(): number {
  return volume
}

export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next))
  try {
    localStorage.setItem('rg.volume', String(volume))
  } catch {
    /* ignore */
  }
}

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from the first pointer on the board so later tones are allowed to play. */
export function unlockAudio(): void {
  try {
    const c = ac()
    if (c.state === 'suspended') void c.resume()
  } catch {
    /* ignore */
  }
}

function tone(freq: number, duration: number, type: OscillatorType, gain: number, when = 0, slideTo?: number): void {
  if (muted) return
  try {
    const c = ac()
    const t0 = c.currentTime + when
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain * volume, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + duration + 0.03)
  } catch {
    /* ignore */
  }
}

function noiseBurst(duration: number, gain = 0.08, when = 0): void {
  if (muted) return
  try {
    const c = ac()
    const t0 = c.currentTime + when
    const bufferSize = Math.floor(c.sampleRate * duration)
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const src = c.createBufferSource()
    src.buffer = buffer
    const g = c.createGain()
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1400
    g.gain.setValueAtTime(gain * volume, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(c.destination)
    src.start(t0)
    src.stop(t0 + duration + 0.02)
  } catch {
    /* ignore */
  }
}

/** Soft click for ordinary buttons. Board tiles keep their own sounds. */
export function sfxClick(): void {
  tone(740, 0.028, 'sine', 0.045)
  noiseBurst(0.018, 0.018)
}

/** X mark. */
export function sfxMark(): void {
  tone(380, 0.07, 'square', 0.1, 0, 220)
  tone(520, 0.06, 'square', 0.08, 0.04, 300)
  noiseBurst(0.06, 0.055, 0.01)
}

/** Buddy placed. */
export function sfxPlace(): void {
  tone(260, 0.1, 'sine', 0.11)
  tone(520, 0.14, 'triangle', 0.09, 0.03)
  tone(1040, 0.09, 'sine', 0.05, 0.07)
  let i = Math.floor(Math.random() * GIGGLES.length)
  if (i === lastGiggle) i = (i + 1) % GIGGLES.length
  lastGiggle = i
  try {
    if (!giggleEl) giggleEl = new Audio()
    giggleEl.pause()
    giggleEl.src = GIGGLES[i]
    giggleEl.volume = 0.7 * volume
    if (!muted) void giggleEl.play().catch(() => undefined)
  } catch {
    /* ignore */
  }
}

export function sfxWin(): void {
  ;[523, 659, 784, 988, 1175].forEach((freq, i) => tone(freq, 0.3, i % 2 ? 'triangle' : 'sine', 0.1, i * 0.09))
}

export function sfxError(): void {
  tone(180, 0.14, 'sawtooth', 0.09, 0, 90)
  tone(140, 0.18, 'square', 0.07, 0.05, 70)
  noiseBurst(0.14, 0.06, 0.02)
}

export function playVoice(id: string): void {
  if (muted) return
  try {
    if (!voiceEl) voiceEl = new Audio()
    voiceEl.pause()
    voiceEl.src = `/voices/${id}.mp3`
    voiceEl.volume = 0.85 * volume
    void voiceEl.play().catch(() => undefined)
  } catch {
    /* ignore */
  }
}

export function bindButtonClicks(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const hit = target.closest('button, a, [role="button"]')
    if (!hit || hit.closest('.board') || hit.classList.contains('cell')) return
    sfxClick()
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
