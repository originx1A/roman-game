import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  kind: 'win' | 'lose'
  title: string
  subtitle?: string
  romanLine?: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

/** Full-screen centered result card — portaled to body so play overflow can't clip it */
export function ResultOverlay({
  kind,
  title,
  subtitle,
  romanLine,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const node = (
    <div className={`result-overlay result-${kind}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="result-scrim" aria-hidden />
      <div className={`result-card result-card-${kind}`}>
        <div className="result-burst" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="result-kicker">{kind === 'win' ? 'Board cleared' : 'Out of hearts'}</p>
        <h2 className="result-title">{title}</h2>
        {subtitle ? <p className="result-sub">{subtitle}</p> : null}
        {romanLine ? <p className="result-roman">{romanLine}</p> : null}
        <div className="result-actions">
          <button type="button" className="btn primary result-btn" onClick={onPrimary}>
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button type="button" className="btn ghost result-btn" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
