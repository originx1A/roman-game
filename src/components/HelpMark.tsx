/** Small help control. Opens How to play on the matching section. */
export function HelpMark({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="help-mark" data-testid={`help-${id}`} aria-label="Help" onClick={() => onOpen(id)}>
      ?
    </button>
  )
}
