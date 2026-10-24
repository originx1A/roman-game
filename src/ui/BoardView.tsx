import type { Cell, Puzzle } from '../game/logic'
import { colOf, rowOf } from '../game/logic'
import { unlockAudio } from '../game/sound'

const HUES = [28, 200, 130, 330, 50, 260, 170, 12]

export function BoardView({
  puzzle,
  cells,
  highlights,
  onTap,
}: {
  puzzle: Puzzle
  cells: Cell[]
  highlights?: number[]
  onTap: (index: number) => void
}) {
  const size = puzzle.size
  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
      }}
      role="grid"
      aria-label="Board"
    >
      {cells.map((cell, index) => {
        const region = puzzle.regions[index]
        const row = rowOf(index, size)
        const col = colOf(index, size)
        const edge = [
          row === 0 || puzzle.regions[index - size] !== region ? 'edge-t' : '',
          row === size - 1 || puzzle.regions[index + size] !== region ? 'edge-b' : '',
          col === 0 || puzzle.regions[index - 1] !== region ? 'edge-l' : '',
          col === size - 1 || puzzle.regions[index + 1] !== region ? 'edge-r' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={index}
            type="button"
            className={`cell ${edge} ${highlights?.includes(index) ? 'lit' : ''}`}
            style={{ ['--hue' as string]: String(HUES[region % HUES.length]) }}
            aria-label={`Row ${row + 1} column ${col + 1}`}
            onClick={() => {
              unlockAudio()
              onTap(index)
            }}
          >
            <span className="cell-fill" />
            {cell === 'mark' ? <Mark /> : null}
            {cell === 'buddy' ? <Buddy /> : null}
          </button>
        )
      })}
    </div>
  )
}

function Mark() {
  return (
    <span className="mark-x" aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function Buddy() {
  return (
    <span className="buddy" aria-hidden>
      <span className="buddy-body">
        <span className="buddy-face">
          <i />
          <i />
        </span>
      </span>
    </span>
  )
}
