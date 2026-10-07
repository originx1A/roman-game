import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CellState, Puzzle, ThemeId } from '../game/types'
import { regionColorMap, type TileShape } from '../game/themes'

/* Cinematic reskin (2026-10-07): map region hue to buddy color variant */
const BUDDY_BASE = '/images/cinematic/final'
function buddyForHue(hue: number): string {
  const h = ((hue % 360) + 360) % 360
  if (h < 20 || h >= 340) return `${BUDDY_BASE}/buddy-red.webp`
  if (h < 65) return `${BUDDY_BASE}/buddy-gold.webp`
  if (h < 160) return `${BUDDY_BASE}/buddy-green.webp`
  if (h < 265) return `${BUDDY_BASE}/buddy-blue.webp`
  return `${BUDDY_BASE}/buddy-purple.webp`
}
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
import { LONG_PRESS_MS, hasLeftTap, swipeModeFor, swipeTarget, type GestureStart, type SwipeMode } from '../game/gesture'

interface Props {
  puzzle: Puzzle
  cells: CellState[]
  onChange: (
    next: CellState[],
    meta: {
      kind: CellState
      conflict: boolean
      index: number
      conflictKind?: ConflictKind | null
      /** Same number for every change made by one finger-down-to-up, so App can make it one undo step. */
      stroke?: number
    },
  ) => void
  hintIndex: number | null
  giggleIndex?: number | null
  disabled?: boolean
  celebrate?: boolean
  defeated?: boolean
  themeId?: ThemeId
  /**
   * The board App actually holds right now (its history's present). Every change is built on
   * this, never on a copy that may be a render behind, so an undone X can't come back.
   */
  getCells?: () => CellState[]
  /** Bumped by App on Undo, Redo, Reset and new boards: drops any half-finished gesture. */
  version?: number
}

export function Buddy({
  angry,
  win,
  giggle,
  themeId,
  className = '',
  buddySrc,
}: {
  angry?: boolean
  win?: boolean
  giggle?: boolean
  themeId: ThemeId
  className?: string
  /** Cinematic reskin: image src for the buddy; falls back to CSS buddy if missing */
  buddySrc?: string
}) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => { setImgOk(true) }, [buddySrc])
  if (buddySrc && imgOk) {
    return (
      <span
        className={`buddy buddy-${themeId} ${angry ? 'angry' : ''} ${win ? 'win' : ''} ${giggle ? 'giggle' : ''} ${className}`.trim()}
        aria-hidden
      >
        <img
          className="buddy-img"
          src={buddySrc}
          alt=""
          draggable={false}
          onError={() => setImgOk(false)}
        />
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

const SHAPE_PATH: Record<TileShape, string> = {
  dot: 'M12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11z',
  triangle: 'M12 4.5L20 18.5H4z',
  star: 'M12 3.5l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.5l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7z',
  diamond: 'M12 3.5L19.5 12L12 20.5L4.5 12z',
  square: 'M6 6h12v12H6z',
  plus: 'M9.5 4.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z',
  ring: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15zm0 3.6a3.9 3.9 0 1 0 0 7.8a3.9 3.9 0 1 0 0-7.8z',
  heart: 'M12 20s-7.5-4.6-7.5-10.1A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3C19.5 15.4 12 20 12 20z',
}

/** Small corner shape so a tile's color is never the only cue (same color = same shape). */
export function TileMark({ shape, ink }: { shape: TileShape; ink: 'dark' | 'light' }) {
  return (
    <span className={`tile-mark ink-${ink}`} data-shape={shape} aria-hidden>
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <path d={SHAPE_PATH[shape]} fillRule="evenodd" />
      </svg>
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
  getCells,
  version = 0,
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
  const startRef = useRef<GestureStart>({ x: 0, y: 0, index: null })
  const longPressTimer = useRef<number | null>(null)
  const longPressedRef = useRef(false)
  const activePointerRef = useRef<number | null>(null)
  const swipeModeRef = useRef<SwipeMode>('paint')
  const startErasedRef = useRef(false)
  const strokeRef = useRef(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const [pressed, setPressed] = useState<number | null>(null)

  // Layout effect, not a passive one: the ref must match the screen before the next tap is handled.
  useLayoutEffect(() => {
    cellsRef.current = cells
  }, [cells])

  /** The latest board: App's history when available, else the last one we rendered or changed. */
  function currentCells(): CellState[] {
    const live = getCells?.()
    if (live && live.length === cells.length) cellsRef.current = live
    return cellsRef.current
  }

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

  function cancelLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => cancelLongPress, [])

  const applyAt = useCallback(
    (i: number, mode: 'cycle' | 'mark' | 'clear' | 'erase') => {
      if (disabled || solved || defeated) return
      const current = currentCells()
      let nextState: CellState
      if (mode === 'erase') {
        // Swipe-erase touches X's only; buddies and empty cells stay as they are.
        if (current[i] !== 'mark') return
        nextState = 'empty'
      } else if (mode === 'clear') {
        if (current[i] === 'empty') return
        nextState = 'empty'
      } else if (mode === 'mark') {
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
      onChange(next, { kind: nextState, conflict, index: i, conflictKind, stroke: strokeRef.current })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, solved, defeated, puzzle, onChange, getCells],
  )

  function indexFromPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const cell = (el as HTMLElement).closest('[data-cell]') as HTMLElement | null
    if (!cell || !boardRef.current?.contains(cell)) return null
    const idx = Number(cell.dataset.cell)
    return Number.isFinite(idx) ? idx : null
  }

  function releaseCapture(pointerId: number | null) {
    const board = boardRef.current
    if (!board || pointerId == null) return
    try {
      if (board.hasPointerCapture(pointerId)) board.releasePointerCapture(pointerId)
    } catch {
      /* ignore */
    }
  }

  /**
   * End the current board gesture. `asTap` lets a finger that never moved off its cell
   * cycle it; anything cancelled or rescued by a safety net just stops painting.
   */
  function finishGesture(asTap: boolean) {
    if (!paintingRef.current) return
    paintingRef.current = false
    const pointerId = activePointerRef.current
    activePointerRef.current = null
    cancelLongPress()
    setPressed(null)
    releaseCapture(pointerId)
    // The hold already cleared the cell; lifting the finger must not cycle it again.
    if (longPressedRef.current) return
    // Tap (no drag): a tap on an empty cell already left an X on pointerdown (swipe-friendly);
    // a tap on an X or buddy cycles it.
    if (!asTap || movedRef.current) return
    const i = startRef.current.index
    if (i == null) return
    if (paintedRef.current.has(i)) return
    applyAt(i, 'cycle')
  }

  // Undo/Redo/Reset/new board: forget any half-done gesture so nothing lands on the new board.
  useLayoutEffect(() => {
    if (!paintingRef.current) return
    paintingRef.current = false
    cancelLongPress()
    releaseCapture(activePointerRef.current)
    activePointerRef.current = null
    setPressed(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  // Safety nets at the document level. If iOS never delivers the board's pointerup (or delivers
  // it somewhere else), painting must not stay on with the board holding pointer capture, where
  // it could swallow or retarget the next tap (Undo included).
  const finishRef = useRef(finishGesture)
  finishRef.current = finishGesture
  useEffect(() => {
    let touchTimer: number | null = null
    const board = () => boardRef.current
    const outsideBoard = (t: EventTarget | null) => !(t instanceof Node && board()?.contains(t))
    const onDocPointerDown = (e: PointerEvent) => {
      // A new touch that starts off the board ends any stuck board gesture first.
      if (paintingRef.current && outsideBoard(e.target)) finishRef.current(false)
    }
    const onDocPointerEnd = (e: PointerEvent) => {
      if (!paintingRef.current) return
      if (e.type === 'pointercancel') {
        finishRef.current(false)
        return
      }
      // Our pointer lifted but the board didn't get it: finish it as the board would have.
      finishRef.current(e.pointerId === activePointerRef.current)
    }
    const onDocTouchEnd = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) return
      if (touchTimer != null) window.clearTimeout(touchTimer)
      const cancelled = e.type === 'touchcancel'
      // Give the board's own pointerup a moment to arrive first; then close whatever is left.
      touchTimer = window.setTimeout(() => {
        touchTimer = null
        if (paintingRef.current) finishRef.current(!cancelled)
      }, 120)
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('pointerup', onDocPointerEnd)
    document.addEventListener('pointercancel', onDocPointerEnd)
    document.addEventListener('touchend', onDocTouchEnd)
    document.addEventListener('touchcancel', onDocTouchEnd)
    return () => {
      if (touchTimer != null) window.clearTimeout(touchTimer)
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('pointerup', onDocPointerEnd)
      document.removeEventListener('pointercancel', onDocPointerEnd)
      document.removeEventListener('touchend', onDocTouchEnd)
      document.removeEventListener('touchcancel', onDocTouchEnd)
    }
  }, [])

  function onPointerDown(e: ReactPointerEvent) {
    if (disabled || solved || defeated) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    // Any gesture still open here was lost (or is a second finger): close it, never as a tap.
    if (paintingRef.current) finishGesture(false)
    unlockAudio()
    paintingRef.current = true
    activePointerRef.current = e.pointerId
    movedRef.current = false
    paintedRef.current = new Set()
    startErasedRef.current = false
    strokeRef.current += 1
    try {
      boardRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* not a live pointer; painting still works from elementFromPoint */
    }
    const i = indexFromPoint(e.clientX, e.clientY)
    startRef.current = { x: e.clientX, y: e.clientY, index: i }
    longPressedRef.current = false
    cancelLongPress()
    if (i != null) setPressed(i)
    const board = currentCells()
    // The start cell sets the drag: from an X it erases X's, otherwise it paints them.
    swipeModeRef.current = swipeModeFor(i != null ? board[i] : undefined)
    if (i != null && board[i] === 'empty') {
      paintedRef.current.add(i)
      applyAt(i, 'mark')
    } else if (i != null) {
      // Hold an X or buddy to clear it straight back to empty (one undo step).
      // A tap still cycles it; a swipe off the cell cancels the hold.
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null
        if (!paintingRef.current || movedRef.current) return
        if (currentCells()[i] === 'empty') return
        longPressedRef.current = true
        setPressed(null)
        applyAt(i, 'clear')
      }, LONG_PRESS_MS)
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!paintingRef.current || e.pointerId !== activePointerRef.current) return
    const i = indexFromPoint(e.clientX, e.clientY)
    // Finger wobble inside the tapped cell is still a tap (phones send pointermove for it).
    if (!movedRef.current && !hasLeftTap(startRef.current, e.clientX, e.clientY, i)) return
    movedRef.current = true
    cancelLongPress()
    if (i != null) setPressed(i)
    if (i == null || paintedRef.current.has(i)) return
    const mode = swipeModeRef.current
    const start = startRef.current.index
    // Erase mode clears the start X only once the finger really reaches another cell,
    // so a tap on an X still cycles it and holding still is the long-press clear.
    if (mode === 'erase' && !startErasedRef.current && start != null && i !== start) {
      startErasedRef.current = true
      paintedRef.current.add(start)
      applyAt(start, 'erase')
    }
    if (paintedRef.current.has(i)) return
    if (swipeTarget(mode, currentCells()[i]) == null) return
    paintedRef.current.add(i)
    applyAt(i, mode === 'erase' ? 'erase' : 'mark')
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (e.pointerId !== activePointerRef.current) return
    finishGesture(true)
  }

  return (
    <div
      ref={boardRef}
      className={`board theme-${themeId} ${celebrate ? 'board-win' : ''} ${defeated ? 'board-lose' : ''} ${solved ? 'is-solved' : ''}`}
      style={{ '--n': size } as CSSProperties}
      role="grid"
      aria-label={`${size} by ${size} Roman board. Swipe to mark, swipe from an X to erase. Tap to cycle.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => finishGesture(false)}
      onLostPointerCapture={(e) => {
        // Only the board's own capture ending counts (a cell's implicit capture moving to the
        // board bubbles up here too). Runs after pointerup normally, when painting is already off.
        if (e.target !== e.currentTarget || e.pointerId !== activePointerRef.current) return
        window.setTimeout(() => {
          if (paintingRef.current && activePointerRef.current === e.pointerId) finishGesture(false)
        }, 0)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {cells.map((state, i) => {
        const style = colorByRegion.get(puzzle.regions[i]) ?? {
          hue: 200,
          sat: 70,
          lit: 55,
          shape: 'dot' as TileShape,
          ink: 'light' as const,
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
            <TileMark shape={style.shape} ink={style.ink} />
            {state === 'mark' && <MarkX />}
            {state === 'stone' && (
              <Buddy
                angry={bad}
                win={celebrate}
                giggle={giggleIndex === i}
                themeId={themeId}
                buddySrc={buddyForHue(style.hue)}
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
