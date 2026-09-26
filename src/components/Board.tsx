import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CellState, Puzzle, ThemeId } from '../game/types'
import { regionColorMap } from '../game/themes'
import {
  colOf,
  conflictKindAt,
  cycleCell,
  findConflicts,
  isSolved,
  rowOf,
  type ConflictKind,
} from '../game/logic'
import { sfxError, sfxGiggle, sfxMark, sfxPlace, sfxTap, unlockAudio } from '../game/sound'

interface Props {
  puzzle: Puzzle
  cells: CellState[]
  onChange: (
    next: CellState[],
    meta: { kind: CellState; conflict: boolean; index: number; conflictKind?: ConflictKind | null },
  ) => void
  hintIndex: number | null
  giggleIndex?: number | null
  disabled?: boolean
  celebrate?: boolean
  defeated?: boolean
  themeId?: ThemeId
}

export function Buddy({
  angry,
  win,
  giggle,
  themeId,
  className = '',
}: {
  angry?: boolean
  win?: boolean
  giggle?: boolean
  themeId: ThemeId
  className?: string
}) {
  return (
    <span
      className={`buddy buddy-${themeId} ${angry ? 'angry' : ''} ${win ? 'win' : ''} ${giggle ? 'giggle' : ''} ${className}`.trim()}
      aria-hidden
    >
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
      {giggle && (
        <>
          <span className="giggle-burst a">♥</span>
          <span className="giggle-burst b">✧</span>
          <span className="giggle-burst c">♪</span>
        </>
      )}
    </span>
  )
}

export function MarkX() {
  return (
    <span className="mark-x" aria-hidden>
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path
          d="M6 6l12 12M18 6L6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Board({
  puzzle,
  cells,
  onChange,
  hintIndex,
  giggleIndex = null,
  disabled,
  celebrate,
  defeated,
  themeId = 'classic',
}: Props) {
  const size = puzzle.size
  const conflicts = useMemo(() => findConflicts(puzzle, cells), [puzzle, cells])
  const solved = useMemo(() => isSolved(puzzle, cells), [puzzle, cells])
  const colorByRegion = useMemo(
    () => regionColorMap(themeId, puzzle.regions, size),
    [themeId, puzzle.regions, size],
  )
  const cellsRef = useRef(cells)
  const paintingRef = useRef(false)
  const paintedRef = useRef<Set<number>>(new Set())
  const movedRef = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState<number | null>(null)

  useEffect(() => {
    cellsRef.current = cells
  }, [cells])

  // A finger-swipe is a touch scroll unless the board cancels it. Chrome and
  // iOS then swallow the next click, so the Undo button's first tap after
  // painting X's does nothing. touch-action: none is not enough; the listener
  // has to be non-passive to call preventDefault.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const cancelTouch = (e: TouchEvent) => {
      e.preventDefault()
    }
    board.addEventListener('touchstart', cancelTouch, { passive: false })
    board.addEventListener('touchmove', cancelTouch, { passive: false })
    return () => {
      board.removeEventListener('touchstart', cancelTouch)
      board.removeEventListener('touchmove', cancelTouch)
    }
  }, [])

  const applyAt = useCallback(
    (i: number, mode: 'cycle' | 'mark') => {
      if (disabled || solved || defeated) return
      const current = cellsRef.current
      let nextState: CellState
      if (mode === 'mark') {
        if (current[i] !== 'empty') return
        nextState = 'mark'
      } else {
        nextState = cycleCell(current[i])
      }
      const next = [...current]
      next[i] = nextState
      let conflict = false

      if (nextState === 'stone') {
        const trial = findConflicts(puzzle, next)
        conflict = trial.cells.has(i)
        if (conflict) sfxError()
        else {
          sfxPlace()
          sfxGiggle()
        }
      } else if (nextState === 'mark') {
        sfxMark()
      } else {
        sfxTap()
      }

      cellsRef.current = next
      const conflictKind = conflict ? conflictKindAt(puzzle, next, i) : null
      onChange(next, { kind: nextState, conflict, index: i, conflictKind })
    },
    [disabled, solved, defeated, puzzle, onChange],
  )

  function indexFromPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const cell = (el as HTMLElement).closest('[data-cell]') as HTMLElement | null
    if (!cell || !boardRef.current?.contains(cell)) return null
    const idx = Number(cell.dataset.cell)
    return Number.isFinite(idx) ? idx : null
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (disabled || solved || defeated) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    unlockAudio()
    paintingRef.current = true
    movedRef.current = false
    paintedRef.current = new Set()
    boardRef.current?.setPointerCapture(e.pointerId)
    const i = indexFromPoint(e.clientX, e.clientY)
    if (i != null) setPressed(i)
    if (i != null && cellsRef.current[i] === 'empty') {
      paintedRef.current.add(i)
      applyAt(i, 'mark')
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!paintingRef.current) return
    movedRef.current = true
    const i = indexFromPoint(e.clientX, e.clientY)
    if (i != null) setPressed(i)
    if (i == null || paintedRef.current.has(i)) return
    if (cellsRef.current[i] !== 'empty') return
    paintedRef.current.add(i)
    applyAt(i, 'mark')
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (!paintingRef.current) return
    paintingRef.current = false
    setPressed(null)
    try {
      boardRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    // Tap (no drag): cycle the cell if we only painted one empty→mark already,
    // user may want buddy — if they tapped a marked/buddy cell, cycle it.
    if (!movedRef.current) {
      const i = indexFromPoint(e.clientX, e.clientY)
      if (i == null) return
      // If we auto-marked empty on down, advance empty→mark→stone with a second cycle
      if (paintedRef.current.has(i) && cellsRef.current[i] === 'mark') {
        // single tap on empty: leave as mark (swipe-friendly). Double-tap or tap again for buddy.
        return
      }
      if (!paintedRef.current.has(i)) {
        applyAt(i, 'cycle')
      }
    }
  }

  return (
    <div
      ref={boardRef}
      className={`board theme-${themeId} ${celebrate ? 'board-win' : ''} ${defeated ? 'board-lose' : ''} ${solved ? 'is-solved' : ''}`}
      style={{ '--n': size } as CSSProperties}
      role="grid"
      aria-label={`${size} by ${size} Roman board. Swipe to mark. Tap to cycle.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        setPressed(null)
        onPointerUp(e)
      }}
    >
      {cells.map((state, i) => {
        const style = colorByRegion.get(puzzle.regions[i]) ?? {
          hue: 200,
          sat: 70,
          lit: 55,
        }
        const bad = conflicts.cells.has(i)
        return (
          <div
            key={i}
            data-cell={i}
            role="gridcell"
            className={[
              'cell',
              edgeClass(i, puzzle, size),
              state,
              bad ? 'conflict' : '',
              hintIndex === i ? 'hinted' : '',
              pressed === i ? 'pressed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--hue': style.hue,
                '--sat': `${style.sat}%`,
                '--lit': `${style.lit}%`,
              } as CSSProperties
            }
            aria-label={`Row ${rowOf(i, size) + 1}, column ${colOf(i, size) + 1}, ${state}`}
          >
            <span className="cell-fill" />
            {state === 'mark' && <MarkX />}
            {state === 'stone' && (
              <Buddy
                angry={bad}
                win={celebrate}
                giggle={giggleIndex === i}
                themeId={themeId}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function edgeClass(i: number, puzzle: Puzzle, size: number): string {
  const r = rowOf(i, size)
  const c = colOf(i, size)
  const reg = puzzle.regions[i]
  const parts: string[] = []
  if (r === 0 || puzzle.regions[i - size] !== reg) parts.push('edge-t')
  if (r === size - 1 || puzzle.regions[i + size] !== reg) parts.push('edge-b')
  if (c === 0 || puzzle.regions[i - 1] !== reg) parts.push('edge-l')
  if (c === size - 1 || puzzle.regions[i + 1] !== reg) parts.push('edge-r')
  return parts.join(' ')
}
