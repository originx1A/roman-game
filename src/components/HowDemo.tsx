import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Buddy, MarkX } from './Board'
import { regionColorMap } from '../game/themes'

const SIZE = 5

/** Small classic-style regions so the demo uses the real palette. */
const REGIONS = [
  0, 0, 0, 1, 1,
  0, 0, 1, 1, 2,
  3, 3, 1, 2, 2,
  3, 4, 4, 2, 2,
  3, 4, 4, 4, 2,
]

export type HowDemoId = 'region' | 'lines' | 'touch' | 'swipe' | 'hearts' | 'critter'

const REGION_CELLS = new Set([0, 1, 2, 5, 6])
const REGION_BUDDY = 1
const LINE_ROW = new Set([5, 6, 7, 8, 9])
const LINE_COL = new Set([3, 8, 13, 18, 23])
const ROW_BUDDY = 5
const COL_BUDDY = 23
const TOUCH_BUDDY = 12
const TOUCH_NEAR = new Set([6, 7, 8, 11, 13, 16, 17, 18])
const TOUCH_X = 6
const SWIPE_MARKS = [10, 11, 13]
const SWIPE_BUDDY = 12
const WRONG_TAPS = [0, 9, 21]
const HINT_CELL = 16

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}

function edgeClass(i: number): string {
  const row = Math.floor(i / SIZE)
  const col = i % SIZE
  const reg = REGIONS[i]
  const parts: string[] = []
  if (row === 0 || REGIONS[i - SIZE] !== reg) parts.push('edge-t')
  if (row === SIZE - 1 || REGIONS[i + SIZE] !== reg) parts.push('edge-b')
  if (col === 0 || REGIONS[i - 1] !== reg) parts.push('edge-l')
  if (col === SIZE - 1 || REGIONS[i + 1] !== reg) parts.push('edge-r')
  return parts.join(' ')
}

export function HowDemo({ demo }: { demo: HowDemoId }) {
  const reduce = usePrefersReducedMotion()
  const colors = useMemo(() => regionColorMap('classic', REGIONS, SIZE), [])

  return (
    <div
      className={`how-demo${reduce ? '' : ' is-animated'}`}
      data-demo={demo}
      aria-hidden
    >
      <div className="how-demo-hearts">
        {WRONG_TAPS.map((cell, i) => (
          <span key={cell} className="heart" style={{ '--at': `${0.4 + i * 0.55}s` } as CSSProperties} />
        ))}
      </div>
      <div className="how-demo-grid">
        {REGIONS.map((region, i) => {
          const color = colors.get(region) ?? { hue: 200, sat: 70, lit: 55 }
          const buddy =
            (demo === 'region' && i === REGION_BUDDY) ||
            (demo === 'lines' && (i === ROW_BUDDY || i === COL_BUDDY)) ||
            (demo === 'touch' && i === TOUCH_BUDDY) ||
            (demo === 'swipe' && i === SWIPE_BUDDY)
          const mark = demo === 'touch' && i === TOUCH_X
          const swipeMark = demo === 'swipe' && SWIPE_MARKS.includes(i)
          const swipeSwap = demo === 'swipe' && i === SWIPE_BUDDY
          const classes = [
            'cell',
            edgeClass(i),
            REGION_CELLS.has(i) ? 'demo-region' : '',
            LINE_ROW.has(i) ? 'demo-row' : '',
            LINE_COL.has(i) ? 'demo-col' : '',
            TOUCH_NEAR.has(i) ? 'demo-near' : '',
            WRONG_TAPS.includes(i) ? 'demo-wrong' : '',
            i === HINT_CELL ? 'demo-hint' : '',
            swipeMark ? 'demo-swipe-mark' : '',
            swipeSwap ? 'demo-swap' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const at =
            demo === 'lines' && LINE_ROW.has(i)
              ? `${(i - 5) * 0.12}s`
              : demo === 'lines' && LINE_COL.has(i)
                ? `${1.15 + [3, 8, 13, 18, 23].indexOf(i) * 0.12}s`
                : demo === 'swipe' && swipeMark
                  ? `${[0.22, 0.62, 1.14][[10, 11, 13].indexOf(i)]}s`
                  : demo === 'hearts' && WRONG_TAPS.includes(i)
                    ? `${0.4 + WRONG_TAPS.indexOf(i) * 0.55}s`
                    : undefined
          return (
            <div
              key={i}
              className={classes}
              style={
                {
                  '--hue': color.hue,
                  '--sat': `${color.sat}%`,
                  '--lit': `${color.lit}%`,
                  '--at': at,
                } as CSSProperties
              }
            >
              <span className="cell-fill" />
              {(mark || swipeMark || swipeSwap) && <MarkX />}
              {buddy && (
                <Buddy
                  themeId="classic"
                  className={
                    demo === 'lines' && i === COL_BUDDY
                      ? 'demo-in demo-in-late'
                      : 'demo-in'
                  }
                />
              )}
            </div>
          )
        })}
        {demo === 'swipe' && <span className="how-demo-finger" />}
        {demo === 'critter' && (
          <span className="how-demo-critter">
            <span className="how-demo-tap" />
            <span className="critter-body">
              <span className="critter-eye l" />
              <span className="critter-eye r" />
              <span className="critter-tail" />
            </span>
            <span className="critter-glow" />
          </span>
        )}
      </div>
    </div>
  )
}
