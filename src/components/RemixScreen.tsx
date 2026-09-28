import type { Difficulty, Puzzle } from '../game/types'
import { REMIX_SIZES, remixCountdownLabel, remixId, type RemixSize } from '../game/remix'
import type { EndlessStats } from '../game/storage'

const DIFF_FOR_SIZE: Record<RemixSize, Difficulty> = { 5: 'easy', 6: 'medium', 7: 'hard', 8: 'expert' }
const LABEL: Record<RemixSize, string> = { 5: 'Easy', 6: 'Medium', 7: 'Hard', 8: 'Expert' }

export interface RemixLevelInfo {
  stars: number
  bestMs?: number
}

/** 9.30-i: the Remix boards screen (live set + countdown) and Endless mode */
export function RemixScreen({
  set,
  msLeft,
  boards,
  building,
  failed,
  levelInfo,
  formatMs,
  starString,
  onOpenBoard,
  endless,
  endlessBusy,
  onEndless,
}: {
  set: number
  msLeft: number
  boards: Partial<Record<RemixSize, Puzzle>>
  building: readonly RemixSize[]
  failed: readonly RemixSize[]
  levelInfo: (id: string) => RemixLevelInfo | undefined
  formatMs: (ms: number) => string
  starString: (n: number) => string
  onOpenBoard: (size: RemixSize) => void
  endless: EndlessStats
  endlessBusy: Difficulty | null
  onEndless: (d: Difficulty) => void
}) {
  return (
    <main className="panel levels remix-screen scroll-pane">
      <h2>Remix boards</h2>
      <section className="remix-countdown" aria-live="polite">
        <strong data-remix-countdown>New boards in {remixCountdownLabel(msLeft)}</strong>
        <span className="remix-note">Same boards for everyone until the countdown ends. Compare scores with friends.</span>
      </section>
      <div className="level-grid remix-grid" data-remix-set={set}>
        {REMIX_SIZES.map((size) => {
          const p = boards[size]
          const id = remixId(set, size)
          const info = levelInfo(id)
          const stars = info?.stars ?? 0
          const isBuilding = building.includes(size)
          const isFailed = failed.includes(size)
          return (
            <button
              key={size}
              type="button"
              className={`level-card remix-card ${info?.bestMs != null ? 'cleared' : ''} ${isBuilding ? 'is-building' : ''}`}
              data-level={id}
              disabled={isBuilding}
              aria-busy={isBuilding}
              onClick={() => onOpenBoard(size)}
            >
              <span className="lv-name">
                {p ? p.name : `Remix ${String.fromCharCode(60 + size)}`}
                <span className={`lv-stars s${stars}`} aria-label={`${stars} of 3 stars`}>{starString(stars)}</span>
              </span>
              <span className="lv-meta">
                {size}×{size} · {LABEL[size]}
                {isBuilding
                  ? ' · Building board…'
                  : isFailed
                    ? ' · Tap to try again'
                    : !p
                      ? ' · Tap to build'
                      : info?.bestMs != null
                        ? ` · best ${formatMs(info.bestMs)}`
                        : ''}
              </span>
            </button>
          )
        })}
      </div>

      <section className="diff-block endless-block" aria-label="Endless mode">
        <div className="diff-head">
          <h3>Endless mode</h3>
          <span className="endless-count" data-endless-count>
            {endless.cleared} cleared
          </span>
        </div>
        <p className="sub">Unlimited brand-new boards, made on your phone. Pick a size and keep going.</p>
        <div className="endless-sizes">
          {REMIX_SIZES.map((size) => {
            const d = DIFF_FOR_SIZE[size]
            return (
              <button
                key={size}
                type="button"
                className="btn ghost endless-btn"
                data-endless={size}
                disabled={endlessBusy != null}
                onClick={() => onEndless(d)}
              >
                {endlessBusy === d ? 'Making…' : `${size}×${size}`}
                <small>{endless.bySize[size] ? `${endless.bySize[size]} cleared` : LABEL[size]}</small>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}
