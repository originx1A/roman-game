/** Board sounds from build 9.33-m (`src/game/sound.ts`): the place boop and the synth buddy peeps. */

let ctx: AudioContext | null = null
let muted = false
let volume = 0.8
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

/** Soft tap for buttons and nav. Warm and short, in the same family as the board boop. */
export function sfxClick(): void {
  tone(392, 0.07, 'sine', 0.04)
  tone(523, 0.09, 'triangle', 0.025, 0.02)
}

/** X mark. A lower tok, still sine and triangle, not a click. */
export function sfxMark(): void {
  tone(330, 0.08, 'triangle', 0.07, 0, 220)
  tone(247, 0.1, 'sine', 0.05, 0.03)
}

/** Buddy placed. The boop from 9.33-m `sfxPlace`. */
export function sfxPlace(): void {
  tone(260, 0.1, 'sine', 0.11)
  tone(520, 0.14, 'triangle', 0.09, 0.03)
  tone(1040, 0.09, 'sine', 0.05, 0.07)
}

/** Synth peeps from 9.33-m `sfxGiggle`. The recorded giggle clips are not the board buddy. */
export function sfxGiggle(): void {
  const peeps = [1100, 1320, 1480, 1240, 1600, 1400]
  peeps.forEach((freq, i) => {
    tone(freq, 0.05, i % 2 ? 'triangle' : 'sine', 0.055, i * 0.04)
  })
  ;[0.04, 0.12, 0.2].forEach((when, i) => noiseBurst(0.04, 0.015 + i * 0.004, when))
}

/** Short celebratory ta-da. Three warm notes, then it stops. */
export function sfxWin(): void {
  tone(523, 0.12, 'triangle', 0.07)
  tone(659, 0.12, 'sine', 0.06, 0.1)
  tone(784, 0.22, 'triangle', 0.07, 0.2)
}

export function sfxError(): void {
  tone(196, 0.12, 'triangle', 0.06, 0, 140)
  tone(165, 0.14, 'sine', 0.04, 0.06)
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
