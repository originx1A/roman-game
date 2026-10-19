import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { keyboardNameSheetFromWindow, placeSheet, readVisibleViewport } from './keyboardViewport'
import './KeyboardNameSheet.css'

/** Touch / mobile: name fields open in the keyboard sheet. Desktop stays inline. */
export function useKeyboardNameEntry(): boolean {
  const [on, setOn] = useState(keyboardNameSheetFromWindow)
  useEffect(() => {
    const update = () => setOn(keyboardNameSheetFromWindow())
    update()
    const mq = window.matchMedia('(pointer: coarse)')
    mq.addEventListener?.('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener?.('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return on
}

function blurTyping() {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

/** Keep the field (and the button under it) inside the card, without scrolling the page. */
function revealField(root: HTMLElement) {
  const card = root.querySelector('.start-sheet-card')
  const input = root.querySelector('input, textarea')
  if (!(card instanceof HTMLElement) || !(input instanceof HTMLElement)) return
  const button = card.querySelector('.btn')
  const target = button instanceof HTMLElement ? button : input
  const over = target.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom
  if (over > 4) card.scrollTop += over + 8
  const under = input.getBoundingClientRect().top - card.getBoundingClientRect().top
  if (under < 4) card.scrollTop += under - 8
}

/**
 * Dialog pinned to the visual viewport, card along its bottom edge, so the
 * field sits just above the on-screen keyboard on iOS Safari and Android Chrome.
 */
export function KeyboardNameSheet({
  label,
  onDismiss,
  children,
}: {
  label: string
  /** Scrim / Escape. Omit when the dialog has its own Save and Skip. */
  onDismiss?: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const savedX = window.scrollX
    const savedY = window.scrollY
    let adjusting = false
    const place = () => {
      if (adjusting) return
      if (window.scrollX !== savedX || window.scrollY !== savedY) {
        adjusting = true
        window.scrollTo(savedX, savedY)
        adjusting = false
      }
      const proposed = readVisibleViewport()
      el.style.top = `${proposed.top}px`
      el.style.left = `${proposed.left}px`
      el.style.width = `${proposed.width}px`
      el.style.height = `${proposed.height}px`
      const rect = el.getBoundingClientRect()
      const placed = placeSheet(proposed, rect)
      if (placed.top !== proposed.top || placed.left !== proposed.left) {
        el.style.top = `${placed.top}px`
        el.style.left = `${placed.left}px`
      }
      el.dataset.vvTop = String(Math.round(placed.top))
      el.dataset.vvHeight = String(Math.round(placed.height))
      revealField(el)
    }
    place()
    const vv = window.visualViewport
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    window.addEventListener('resize', place)
    window.addEventListener('orientationchange', place)
    // The keyboard animation often settles after the first resize event.
    const late = [50, 150, 350, 600].map((ms) => window.setTimeout(place, ms))
    document.documentElement.classList.add('kb-name-open')
    const restore = () => {
      if (window.scrollX !== savedX || window.scrollY !== savedY) window.scrollTo(savedX, savedY)
    }
    return () => {
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
      window.removeEventListener('orientationchange', place)
      for (const id of late) window.clearTimeout(id)
      document.documentElement.classList.remove('kb-name-open')
      const active = document.activeElement
      if (active instanceof HTMLElement && el.contains(active)) active.blur()
      restore()
      requestAnimationFrame(restore)
      window.setTimeout(restore, 50)
      window.setTimeout(restore, 320)
    }
  }, [])

  useEffect(() => {
    const root = ref.current
    const input = root?.querySelector('input, textarea')
    if (!(input instanceof HTMLElement)) return
    const focus = () => {
      try {
        input.focus({ preventScroll: true })
      } catch {
        input.focus()
      }
    }
    focus()
    const again = window.setTimeout(focus, 60)
    return () => window.clearTimeout(again)
  }, [])

  useEffect(() => {
    const block = (e: TouchEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('.kb-name-copy, .start-sheet-card')) return
      if (e.cancelable) e.preventDefault()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissRef.current) {
        blurTyping()
        dismissRef.current()
      }
    }
    document.addEventListener('touchmove', block, { passive: false })
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('touchmove', block)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return createPortal(
    <div ref={ref} className="kb-name-sheet" role="dialog" aria-modal="true" aria-label={label} data-testid="kb-name-sheet">
      <div
        className="kb-name-scrim"
        onClick={() => {
          if (!dismissRef.current) return
          blurTyping()
          dismissRef.current()
        }}
      />
      {children}
    </div>,
    document.body,
  )
}

/**
 * Inline name field. On a touch device, tapping it opens the keyboard sheet
 * instead of focusing a field the keyboard would cover. Commit uses the same
 * change + blur handlers as the desktop input.
 */
export function NameEntry({
  value,
  onChange,
  onCommit,
  maxLength,
  placeholder,
  ariaLabel,
  autoComplete = 'nickname',
  sheetTitle,
  sheetHint,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
  maxLength?: number
  placeholder?: string
  ariaLabel: string
  autoComplete?: string
  sheetTitle: string
  sheetHint?: string
  testId?: string
}) {
  const touch = useKeyboardNameEntry()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!touch) {
    return (
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete={autoComplete}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
      />
    )
  }

  function finish() {
    blurTyping()
    if (draft !== value) onChange(draft)
    onCommit(draft)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="name-face"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        data-testid={testId}
        onClick={() => {
          setDraft(value)
          setOpen(true)
        }}
      >
        {value ? value : <span className="name-face-placeholder">{placeholder}</span>}
      </button>
      {open && (
        <KeyboardNameSheet label={sheetTitle} onDismiss={finish}>
          <form
            className="start-sheet-card"
            onSubmit={(e) => {
              e.preventDefault()
              finish()
            }}
          >
            <div className="kb-name-copy">
              <h3>{sheetTitle}</h3>
              {sheetHint ? <p className="start-sheet-tip">{sheetHint}</p> : null}
            </div>
            <input
              className="name-input"
              type="text"
              value={draft}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-label={ariaLabel}
              autoComplete={autoComplete}
              enterKeyHint="done"
              data-testid={testId ? `${testId}-sheet` : 'kb-name-input'}
              onChange={(e) => setDraft(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
            />
            <button type="submit" className="btn primary">
              Done
            </button>
          </form>
        </KeyboardNameSheet>
      )}
    </>
  )
}
