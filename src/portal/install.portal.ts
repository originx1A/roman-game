/**
 * Shipping portal boot. Loaded only when Vite aliases install.ts to this file.
 * Poki calls go to window.PokiSDK. The play-phase rule is tested without the SDK
 * in scripts/portal-play-phase.test.ts. Ad calls are not part of this boot.
 */
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import '@fontsource/cinzel/800.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './portal.css'
import { nextPlayPhase, type PlayPhase } from './playPhase'
import { resumeSuspendedAudio } from '../game/sound'

;(globalThis as { __ROMAN_PORTAL__?: string }).__ROMAN_PORTAL__ = import.meta.env.VITE_PORTAL

type PokiSdk = {
  init?: () => Promise<unknown>
  gameLoadingFinished?: () => void
  gameplayStart?: () => void
  gameplayStop?: () => void
}

function pokiSdk(): PokiSdk | null {
  const sdk = (window as unknown as { PokiSDK?: PokiSdk }).PokiSDK
  return sdk ?? null
}

function hardenStorage() {
  const proto = Storage.prototype
  for (const name of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {
    const original = proto[name] as (...args: unknown[]) => unknown
    proto[name] = function (this: Storage, ...args: unknown[]) {
      try {
        return original.apply(this, args)
      } catch {
        return name === 'getItem' || name === 'key' ? null : undefined
      }
    }
  }
}

function lockParentScroll() {
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== ' ') return
    const t = ev.target as HTMLElement | null
    const tag = t?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || t?.isContentEditable) return
    ev.preventDefault()
  })
  window.addEventListener(
    'wheel',
    (ev) => {
      let el = ev.target as HTMLElement | null
      while (el && el !== document.body) {
        const style = getComputedStyle(el)
        const scrolls = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1
        if (scrolls) return
        el = el.parentElement
      }
      ev.preventDefault()
    },
    { passive: false },
  )
}

function bootPoki() {
  const sdk = pokiSdk()
  let phase: PlayPhase = 'idle'
  let loadingFinished = false
  const ready = (sdk?.init?.() ?? Promise.resolve()).catch(() => {})
  void ready.then(() => {
    if (loadingFinished) return
    loadingFinished = true
    try {
      sdk?.gameLoadingFinished?.()
    } catch {
      /* off-platform SDK calls can throw; the game still runs */
    }
  })

  const emit = (event: 'input' | 'interrupt') => {
    const next = nextPlayPhase(phase, event)
    phase = next.phase
    if (!next.call) return
    void ready.then(() => {
      try {
        if (next.call === 'gameplayStart') sdk?.gameplayStart?.()
        else sdk?.gameplayStop?.()
      } catch {
        /* SDK disabled outside Poki and localhost */
      }
    })
  }

  const playing = () => document.querySelector('[data-portal-play="1"]')
  const onInput = (ev: Event) => {
    if ('isTrusted' in ev && !ev.isTrusted) return
    if (!playing()) return
    emit('input')
  }
  window.addEventListener('pointerdown', onInput, true)
  window.addEventListener('keydown', onInput, true)
  const obs = new MutationObserver(() => {
    if (!playing()) emit('interrupt')
  })
  obs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-portal-play'] })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) emit('interrupt')
  })
}

export function installPortal(): void {
  hardenStorage()
  lockParentScroll()
  resumeSuspendedAudio()
  if (import.meta.env.VITE_PORTAL === 'poki') bootPoki()
}
