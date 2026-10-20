import { useEffect, useState } from 'react'
import { playVoice } from '../game/sound'
import { enablePush } from '../social/push'

const KEY = 'rg.nudge.dismissed'

function iosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPhone|iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)
  return ios && !standalone
}

/** At most one gentle card, and only between rounds. Dismiss keeps it gone. */
export function PlayNudge({ home }: { home: boolean }) {
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') return
    } catch {
      return
    }
    setIos(iosBrowser())
    setShow(home)
  }, [home])
  useEffect(() => {
    if (!show) return
    const clip = ios
      ? 'narrator_nudge_home'
      : typeof Notification !== 'undefined'
        ? 'narrator_nudge_ping'
        : 'narrator_nudge_account'
    playVoice(clip, { priority: 1, waitMs: 500 })
  }, [show, ios])
  if (!home || !show) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setShow(false)
  }

  const ping = typeof Notification !== 'undefined' && !ios
  return (
    <aside className="play-nudge" data-testid="play-nudge">
      <p>
        {ios
          ? 'Tap Share, then Add to Home Screen.'
          : ping
            ? 'Get a ping when friends challenge you?'
            : 'You can keep this player from Account whenever you want.'}
      </p>
      <div className="play-nudge-actions">
        {ping ? (
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={() => {
              void enablePush().finally(dismiss)
            }}
          >
            Ping me
          </button>
        ) : null}
        <button type="button" className="btn ghost btn-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  )
}
