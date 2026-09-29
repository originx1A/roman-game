import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CRITTER_STASH_GOAL } from './SparkCritter'
import { PetArt } from './PetArt'
import type { PetId } from '../game/pets'

/** Replay challenge extras for this win: stars, a record/near-miss banner, coins earned */
export type WinReplay = {
  showStars: boolean
  stars: number
  starsBefore: number
  banner?: { kind: 'record' | 'near' | 'trial' | 'daily' | 'first'; text: string }
  coinsLine?: string
  detail?: string
  /** 9.30-a: the buddy that rode along cheers (a sticker on the card corner; takes no layout space) */
  pet?: { id: PetId; name: string; text: string; cheer: boolean }
}

export type WinScreenProps = {
  puzzleName: string
  difficultyLabel: string
  themeLabel: string
  timeLabel: string
  score: number
  hintsUsed: number
  livesLeft: number
  maxLives: number
  sparkCount: number
  romanSaying: string
  spins: number
  perfect: boolean
  onNext: () => void
  /** 9.30-n: what the big button says ("Next Endless board" in Endless mode) */
  nextLabel?: string
  /** 9.30-n: a small note under the title ("Endless mode · 3 cleared", "Past Remix board") */
  modeNote?: string
  /** 9.30-t: "Next parade: 3 more wins" */
  paradeHint?: string
  onReplay: () => void
  onLevels: () => void
  onHome: () => void
  onSpin?: () => void
  onShare?: () => void
  onDuel?: () => void
  /** Buddy meter after this win: filled notches of `goal`; `pending` = Buddy Hunt is ready */
  buddyMeter?: { notches: number; goal: number; pending: boolean; perfect: boolean }
  onBuddyHunt?: () => void
  replay?: WinReplay
}

export function WinScreen({
  puzzleName,
  difficultyLabel,
  themeLabel,
  timeLabel,
  score,
  hintsUsed,
  livesLeft,
  maxLives,
  sparkCount,
  romanSaying,
  spins,
  perfect,
  onNext,
  nextLabel,
  modeNote,
  paradeHint,
  onReplay,
  onLevels,
  onHome,
  onSpin,
  onShare,
  onDuel,
  buddyMeter,
  onBuddyHunt,
  replay,
}: WinScreenProps) {
  const [entered, setEntered] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Fit everything on one screen: step through tighter layouts (data-fit 0..4) until the card
  // body stops overflowing. Runs on the real visible height, so Safari toolbars, safe areas and
  // short landscape screens are all handled; the less important bits shrink or hide first.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const fit = () => {
      const body = root.querySelector<HTMLElement>('.win-screen-body')
      const card = root.querySelector<HTMLElement>('.win-screen-card')
      if (!body || !card) return
      for (let level = 0; level <= 4; level++) {
        root.dataset.fit = String(level)
        const over = body.scrollHeight - body.clientHeight > 1 || card.scrollHeight - card.clientHeight > 1
        if (!over) break
      }
    }
    fit()
    const vv = window.visualViewport
    window.addEventListener('resize', fit)
    vv?.addEventListener('resize', fit)
    const late = window.setTimeout(fit, 350)
    document.fonts?.ready.then(fit).catch(() => {})
    return () => {
      window.removeEventListener('resize', fit)
      vv?.removeEventListener('resize', fit)
      window.clearTimeout(late)
    }
  }, [replay, buddyMeter, romanSaying, spins])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    <div ref={rootRef} data-fit="0" className={`win-screen ${entered ? 'in' : ''}`} role="dialog" aria-label="Board cleared">
      <div className="win-screen-burst" aria-hidden="true" />
      <div className="win-screen-sparkles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="win-spark" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>

      <div className="win-screen-card">
        {replay?.pet ? (
          <div className={`win-pet ${replay.pet.cheer ? 'is-cheer' : ''}`} data-win-pet={replay.pet.id} aria-label={`${replay.pet.name}: ${replay.pet.text}`}>
            <PetArt id={replay.pet.id} size={40} />
            <span className="win-pet-bubble">{replay.pet.text}</span>
          </div>
        ) : null}
        {/* Scrolls on its own only if a very short screen can't fit it; the buttons stay pinned below. */}
        <div className="win-screen-body">
          <h2 className="win-screen-title">Victory!</h2>
          {modeNote ? <p className="win-mode-note" data-testid="win-mode-note">{modeNote}</p> : null}
          {paradeHint ? <p className="next-parade-hint" data-testid="next-parade-hint">{paradeHint}</p> : null}
          <p className="win-screen-kicker">
            <span className="win-screen-board">{puzzleName}</span> · {difficultyLabel} · {themeLabel}
          </p>

          <p className="win-roman-says">{romanSaying}</p>

          {replay && (replay.showStars || replay.banner) ? (
            <div className="win-replay">
              {replay.showStars ? (
                <span className="win-stars" aria-label={`${replay.stars} of 3 stars`} data-stars={replay.stars}>
                  {[1, 2, 3].map((i) => (
                    <i key={i} className={`${i <= replay.stars ? 'on' : ''} ${i > replay.starsBefore && i <= replay.stars ? 'new' : ''}`}>
                      ★
                    </i>
                  ))}
                </span>
              ) : null}
              {replay.banner ? (
                <span className={`win-record is-${replay.banner.kind}`} data-banner={replay.banner.kind}>
                  {replay.banner.text}
                </span>
              ) : null}
            </div>
          ) : null}
          {replay ? (
            <p className="win-replay-detail">{[replay.detail, replay.coinsLine].filter(Boolean).join(' · ')}</p>
          ) : perfect ? (
            <p className="win-perfect">Perfect clear — no hints</p>
          ) : null}

          <div className="win-stats" aria-label="Run stats">
            <div className="win-stat">
              <span className="win-stat-label">Time</span>
              <strong className="win-stat-value">{timeLabel}</strong>
            </div>
            <div className="win-stat">
              <span className="win-stat-label">Score</span>
              <strong className="win-stat-value">{score}</strong>
            </div>
            <div className="win-stat win-stat-minor">
              <span className="win-stat-label">Sparks</span>
              <strong className="win-stat-value">
                {sparkCount}/{CRITTER_STASH_GOAL}
              </strong>
            </div>
            <div className="win-stat win-stat-minor">
              <span className="win-stat-label">Hints</span>
              <strong className="win-stat-value">{hintsUsed}</strong>
            </div>
            <div className="win-stat">
              <span className="win-stat-label">Hearts</span>
              <strong className="win-stat-value">
                {livesLeft}/{maxLives}
              </strong>
            </div>
          </div>

          {buddyMeter ? (
            <div
              className={`buddy-meter ${buddyMeter.pending ? 'is-full' : ''}`}
              aria-label={`Buddy meter ${buddyMeter.pending ? buddyMeter.goal : buddyMeter.notches} of ${buddyMeter.goal}`}
              data-meter={buddyMeter.pending ? buddyMeter.goal : buddyMeter.notches}
            >
              <span className="buddy-meter-label">Buddy meter</span>
              <span className="buddy-meter-notches">
                {Array.from({ length: buddyMeter.goal }, (_, i) => (
                  <i
                    key={i}
                    className={
                      buddyMeter.pending || i < buddyMeter.notches
                        ? `on ${buddyMeter.perfect && (buddyMeter.pending ? i === buddyMeter.goal - 1 : i === buddyMeter.notches - 1) ? 'new' : ''}`
                        : ''
                    }
                  />
                ))}
              </span>
              <span className="buddy-meter-hint">
                {buddyMeter.pending ? 'Full!' : buddyMeter.perfect ? 'Perfect win +1' : 'Perfect wins fill it'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="win-screen-actions">
          {buddyMeter?.pending && onBuddyHunt ? (
            <button type="button" className="btn primary win-cta win-hunt" onClick={onBuddyHunt}>
              Buddy Hunt!
            </button>
          ) : null}
          <button type="button" className={`btn ${buddyMeter?.pending && onBuddyHunt ? 'ghost' : 'primary'} win-cta`} onClick={onNext}>
            {nextLabel ?? 'Next board'}
          </button>
          <div className="win-screen-row">
            {onShare ? (
              <button type="button" className="btn ghost win-cta" onClick={onShare}>
                Share
              </button>
            ) : null}
            <button type="button" className="btn ghost win-cta" onClick={onReplay}>
              Play again
            </button>
            {onDuel ? (
              <button type="button" className="btn ghost win-cta" onClick={onDuel}>
                Head-to-head
              </button>
            ) : null}
            {spins > 0 && onSpin ? (
              <button type="button" className="btn ghost win-cta win-spin" onClick={onSpin}>
                Spin prize ({spins})
              </button>
            ) : null}
          </div>
          <div className="win-screen-secondary">
            <button type="button" className="btn tool" onClick={onLevels}>
              Levels
            </button>
            <button type="button" className="btn tool" onClick={onHome}>
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
