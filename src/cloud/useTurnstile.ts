import { useEffect, useRef, useState } from 'react'
import { TURNSTILE_SITE_KEY, turnstileHostMessage } from '../game/turnstileSite'

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  execute(id: string): void
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.dataset.turnstile = '1'
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Invisible until Cloudflare asks for a tap. Tokens are single-use: call reset()
 * after every sign-in attempt.
 */
export function useTurnstile(active: boolean) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const token = useRef<string | null>(null)
  const problem = useRef<string | null>(null)
  const waiters = useRef<Array<(token: string | null) => void>>([])
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let gone = false
    void loadTurnstile()
      .then(() => {
        if (gone || !box.current || !window.turnstile || widget.current) return
        widget.current = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: 'interaction-only',
          execution: 'execute',
          size: 'flexible',
          theme: 'auto',
          retry: 'auto',
          callback: (next: string) => {
            token.current = next
            problem.current = null
            setNote(null)
            const pending = waiters.current.splice(0)
            pending.forEach((fn) => fn(next))
          },
          'expired-callback': () => {
            token.current = null
          },
          'error-callback': (code: string) => {
            token.current = null
            const text = turnstileHostMessage(String(code)) || "This page couldn't complete the check. Try again."
            problem.current = text
            setNote(text)
            const pending = waiters.current.splice(0)
            pending.forEach((fn) => fn(null))
          },
        })
        if (waiters.current.length && widget.current) window.turnstile.execute(widget.current)
      })
      .catch(() => {
        const text = "This page couldn't complete the check. Try again."
        problem.current = text
        setNote(text)
        const pending = waiters.current.splice(0)
        pending.forEach((fn) => fn(null))
      })
    return () => {
      gone = true
      token.current = null
      problem.current = null
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
      const pending = waiters.current.splice(0)
      pending.forEach((fn) => fn(null))
    }
  }, [active])

  function reset() {
    token.current = null
    problem.current = null
    setNote(null)
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }

  function takeToken(): Promise<string | null> {
    if (token.current) {
      const have = token.current
      token.current = null
      return Promise.resolve(have)
    }
    if (problem.current) return Promise.resolve(null)
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(null), 20000)
      waiters.current.push((next) => {
        window.clearTimeout(timer)
        resolve(next)
      })
      if (widget.current && window.turnstile) window.turnstile.execute(widget.current)
    })
  }

  function reason(): string | null {
    return problem.current
  }

  return { box, takeToken, reset, reason, note }
}

const STARTUP_ID = 'rg-turnstile-startup'
let startupWidget: string | null = null
let startupToken: string | null = null
let startupProblem: string | null = null
let startupWaiters: Array<(token: string | null) => void> = []
let startupMounting: Promise<void> | null = null

function startupHost(): HTMLDivElement {
  const existing = document.getElementById(STARTUP_ID)
  if (existing instanceof HTMLDivElement) return existing
  const host = document.createElement('div')
  host.id = STARTUP_ID
  host.className = 'cloud-turnstile cloud-turnstile-startup'
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  return host
}

function settleStartup(next: string | null) {
  const pending = startupWaiters.splice(0)
  pending.forEach((fn) => fn(next))
}

/** Invisible managed widget for the silent guest sign-in. A challenge can still appear if Cloudflare asks for one. */
function mountStartup(): Promise<void> {
  if (startupWidget && window.turnstile) return Promise.resolve()
  if (startupMounting) return startupMounting
  startupMounting = loadTurnstile()
    .then(() => {
      if (!window.turnstile || startupWidget) return
      startupWidget = window.turnstile.render(startupHost(), {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only',
        execution: 'render',
        size: 'flexible',
        theme: 'auto',
        retry: 'auto',
        callback: (next: string) => {
          startupProblem = null
          if (startupWaiters.length) {
            startupToken = null
            settleStartup(next)
            return
          }
          startupToken = next
        },
        'expired-callback': () => {
          startupToken = null
        },
        'error-callback': (code: string) => {
          startupToken = null
          startupProblem = turnstileHostMessage(String(code)) || "This page couldn't complete the check. Try again."
          settleStartup(null)
        },
      })
    })
    .catch(() => {
      startupProblem = "This page couldn't complete the check. Try again."
      settleStartup(null)
    })
    .finally(() => {
      startupMounting = null
    })
  return startupMounting
}

/** Drop the used token and ask Cloudflare for another. Tokens are single-use. */
export function resetManagedCaptcha(): void {
  startupToken = null
  startupProblem = null
  if (startupWidget && window.turnstile) window.turnstile.reset(startupWidget)
}

/** Token for a call that has no form, such as the guest sign-in at startup. */
export function takeManagedCaptcha(): Promise<string | null> {
  return mountStartup().then(
    () =>
      new Promise((resolve) => {
        if (startupToken) {
          const have = startupToken
          startupToken = null
          resolve(have)
          return
        }
        if (startupProblem) {
          resolve(null)
          return
        }
        const timer = window.setTimeout(() => resolve(null), 20000)
        const waiter = (next: string | null) => {
          window.clearTimeout(timer)
          resolve(next)
        }
        startupWaiters.push(waiter)
        if (startupToken) {
          startupWaiters = startupWaiters.filter((fn) => fn !== waiter)
          window.clearTimeout(timer)
          const have = startupToken
          startupToken = null
          resolve(have)
        }
      }),
  )
}
