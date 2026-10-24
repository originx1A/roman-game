import { useEffect, useRef, useState } from 'react'
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
  const [giggleIndex, setGiggleIndex] = useState<number | null>(null)
  const prevCells = useRef<Cell[] | null>(null)
  useEffect(() => {
    const before = prevCells.current
    prevCells.current = cells
    if (!before || before.length !== cells.length) return
    const index = cells.findIndex((cell, i) => cell === 'buddy' && before[i] !== 'buddy')
    if (index < 0) return
    setGiggleIndex(index)
    const timer = window.setTimeout(() => setGiggleIndex((current) => (current === index ? null : current)), 900)
    return () => window.clearTimeout(timer)
  }, [cells])
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
            {cell === 'buddy' ? <Buddy giggle={giggleIndex === index} /> : null}
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

/** Placed buddy from build 9.33-m `src/components/Board.tsx`. Classic theme. Not a pet. */
function Buddy({ giggle = false }: { giggle?: boolean }) {
  return (
    <span className={`buddy buddy-classic${giggle ? ' giggle' : ''}`} aria-hidden>
      <span className="buddy-body">
        <span className="buddy-face">
          <span className="buddy-eye left">
            <span className="buddy-pupil" />
          </span>
          <span className="buddy-eye right">
            <span className="buddy-pupil" />
          </span>
          <span className="buddy-mouth" />
        </span>
        <span className="buddy-shine" />
        <span className="buddy-accent" />
      </span>
      {giggle ? (
        <>
          <span className="giggle-burst a">♥</span>
          <span className="giggle-burst b">✧</span>
          <span className="giggle-burst c">♪</span>
        </>
      ) : null}
    </span>
  )
}
