import type { PointerLine } from '../game/unseenPointers'

/** A between-runs note. Never a replay of where to press. */
export function UnseenPointer({ line, onClose }: { line: PointerLine | null; onClose: () => void }) {
  if (!line) return null
  return (
    <aside className="unseen-pointer" role="status">
      <p><b>The Unseen:</b> {line.text}</p>
      {line.href ? (
        <a href={line.href} target="_blank" rel="noopener noreferrer">Look</a>
      ) : null}
      <button type="button" className="btn tool" onClick={onClose}>OK</button>
    </aside>
  )
}
