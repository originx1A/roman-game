import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { checkGrownUp, grownUpQuestion } from '../game/purchaseGate'

/** A short multiplication plus a grown-up confirmation. Not an age checkbox. */
export function ParentalGate({
  open,
  onClose,
  onPass,
}: {
  open: boolean
  onClose: () => void
  onPass: () => void
}) {
  const question = useMemo(() => grownUpQuestion(Date.now()), [open])
  const [answer, setAnswer] = useState('')
  const [cardHolder, setCardHolder] = useState(false)
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    if (!open) return
    setAnswer('')
    setCardHolder(false)
    setWrong(false)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const node = (
    <div className="start-sheet parental-gate" role="dialog" aria-modal="true" aria-label="Ask a grown-up">
      <div className="start-sheet-scrim" onClick={onClose} />
      <form
        className="start-sheet-card"
        onSubmit={(e) => {
          e.preventDefault()
          if (!checkGrownUp(question, answer, cardHolder)) {
            setWrong(true)
            return
          }
          setAnswer('')
          setWrong(false)
          onPass()
        }}
      >
        <h3>Ask a grown-up</h3>
        <p className="start-sheet-tip">A grown-up answers this before the payment page opens. The price on the next screen is the real price.</p>
        <p className="parental-prompt">{question.prompt}</p>
        <input
          className="name-input"
          inputMode="numeric"
          aria-label="Grown-up answer"
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value)
            setWrong(false)
          }}
        />
        <label className="cloud-check">
          <input type="checkbox" checked={cardHolder} onChange={(e) => setCardHolder(e.target.checked)} />
          <span>A grown-up is here and will use their own card.</span>
        </label>
        {wrong ? <p className="cloud-err" role="alert">That answer did not match. Ask a grown-up to try again.</p> : null}
        <button type="submit" className="btn primary">Continue</button>
        <button type="button" className="btn ghost" onClick={onClose}>Not now</button>
      </form>
    </div>
  )
  return createPortal(node, document.body)
}
