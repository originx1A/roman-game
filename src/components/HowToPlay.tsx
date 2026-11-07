import { useEffect, useState } from 'react'
import { HowDemo, type HowDemoId } from './HowDemo'

/* RG03 (Tony Nov 7, hand-ported from 9d165d1): the first-run carousel leads
   with the five core-rule cards ONLY — placing a buddy, rows/columns, no
   touching, swipe & tap, hearts. Every other card stays in the deck (same
   component, same order after the core five, nothing deleted) and is
   presented as "More to discover" — secondary systems are introduced after
   the first clear instead of competing with the rules on a brand-new
   player's first screen. Returning players still start at the new-feature
   cards. */
export const HOW_CORE_COUNT = 5

const STEPS = [
  { title: 'One per region', blurb: 'Each colored area gets exactly one buddy.', demo: 'region' },
  { title: 'Rows & columns', blurb: 'Every row and every column gets one buddy too.', demo: 'lines' },
  { title: 'No touching', blurb: "Buddies can't share an edge or a corner — not even diagonally.", demo: 'touch' },
  { title: 'Swipe & tap', blurb: 'Swipe to paint × marks (no talking!). Tap a mark to place a buddy.', demo: 'swipe' },
  { title: 'Hearts & hints', blurb: 'Three mistakes cost a heart. Hints cost coins (or free hints).', demo: 'hearts' },
  {
    title: 'Buddy Hunt',
    blurb:
      'Every perfect win (no hints, no wrong buddies) fills one notch of the buddy meter. 3 notches open Buddy Hunt: 5 taps to find 3 hidden buddies. Find 1 = 8 coins, 2 = 15, all 3 = 15 + a bonus heart.',
    demo: 'hunt',
    // longer text: stay up a bit longer before the next tip
    ms: 8000,
  },
  { title: 'Spark critter', blurb: 'A silly spark zig-zags by at random. Catch it across games — 5 catches unlock a prize spin!', demo: 'critter' },
  { title: 'Stars', blurb: '★ finish · ★★ beat the target time · ★★★ target time, a high score and zero undos. 3 stars unlocks the Trial.', demo: 'stars', isNew: true },
  { title: 'Combo', blurb: 'Quick good moves build a combo: ×1.5, ×2, up to ×3 points. Wait 4 seconds or slip up and it resets.', demo: 'combo', isNew: true },
  { title: 'Undo costs 25', blurb: 'Undo is always there, but each one costs 25 points and breaks your combo.', demo: 'undo', isNew: true },
  { title: "Roman's Trial", blurb: 'Beat a board with 3 stars to unlock it: race the clock with 2 hearts and no undo. Double coins.', demo: 'trial', isNew: true },
  { title: 'Daily Challenge', blurb: 'One new board every day. Only your first try counts — win daily to grow your streak.', demo: 'daily', isNew: true },
  { title: 'Pace timer', blurb: 'Replaying a board? The timer turns green when you are ahead of your best and red when behind.', demo: 'pace', isNew: true },
  { title: 'Remix boards', blurb: 'New boards every 3 days, the same set for everyone, so you can compare scores. Want more? Endless mode makes unlimited new boards.', demo: 'remix', isNew: true },
  { title: 'Buddy flyby', blurb: 'Your active buddy swoops across the board every couple of minutes. Tap it for a reward — coins, hints, hearts, even rescues!', demo: 'critter', isNew: true },
  { title: 'Treat defense', blurb: 'Wild pets sneak onto the board trying to steal your treat pile! Your pets chase them off automatically (+3-5 treats). Or tap the invader yourself (+1-2). Tap the 🍖 count up top to stash your treats safe.', demo: 'hunt', isNew: true },
  { title: 'Treats & coins', blurb: 'Every win earns 5 field treats. Treats feed and upgrade your pets. Swap safe treats for coins (15 coins each). Bought treats can never be stolen.', demo: 'stars', isNew: true },
  { title: 'The Unseen', blurb: 'A faceless hooded figure watches you play. He creeps up from the corner and points at the board with a jab when he speaks.', demo: 'combo', isNew: true },
  { title: 'Free buddy', blurb: 'New players pick one buddy FREE — Lupa, Aquila, Leo, Invictus, or Nox. Yours forever.', demo: 'region', isNew: true },
] as const satisfies readonly { title: string; blurb: string; demo: HowDemoId; ms?: number; isNew?: boolean }[]

/** Index of the first card about the replay features (returning players start here). */
export const HOW_NEW_START = STEPS.findIndex((s) => 'isNew' in s && s.isNew)

const STEP_MS = 4500

export function HowToPlay({
  onDone,
  onBack,
  startAt = 0,
  doneLabel = 'Choose a level',
  firstRun = false,
}: {
  onDone: () => void
  onBack?: () => void
  startAt?: number
  doneLabel?: string
  /** RG03: brand-new player's first pass — the carousel cycles the
   *  core-rule cards only. "More to discover" opens the full deck. */
  firstRun?: boolean
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(STEPS.length - 1, startAt)))
  // RG03: a first-run player starts in core-only mode; tapping "More to
  // discover" opens the full deck.
  const [coreOnly, setCoreOnly] = useState(() => firstRun && startAt < HOW_CORE_COUNT)
  const current = STEPS[step]

  useEffect(() => {
    const s = STEPS[step] as { ms?: number }
    const id = window.setTimeout(
      () =>
        setStep((n) => {
          const next = n + 1
          if (coreOnly) return next >= HOW_CORE_COUNT ? 0 : next
          return next % STEPS.length
        }),
      s.ms ?? STEP_MS,
    )
    return () => window.clearTimeout(id)
  }, [step, coreOnly])

  return (
    <main className="panel scroll-pane how-panel">
      <div className="how-top">
        {onBack && (
          <button type="button" className="hud-back how-back" onClick={onBack} aria-label="Back">
            ←
          </button>
        )}
        <h2>How to play</h2>
      </div>
      <p className="sub how-sub">Watch the demo, then jump in.</p>
      <div className="how-stage" data-demo={current.demo}>
        <HowDemo key={current.demo} demo={current.demo} />
        <div className="how-caption">
          <p className="how-step-label">
            {step + 1} / {coreOnly ? HOW_CORE_COUNT : STEPS.length}
            {'isNew' in current && current.isNew ? <span className="how-new-tag">New</span> : null}
          </p>
          <h3>{current.title}</h3>
          <p>{current.blurb}</p>
        </div>
      </div>
      <div className="how-dots" role="tablist" aria-label="How to play steps">
        {STEPS.map((s, i) => {
          if (coreOnly && i >= HOW_CORE_COUNT) return null
          return (
            <button
              key={s.title}
              type="button"
              className={i === step ? 'on' : ''}
              aria-label={s.title}
              onClick={() => setStep(i)}
            />
          )
        })}
      </div>
      {coreOnly && (
        <button
          type="button"
          className="btn ghost how-more"
          onClick={() => {
            setCoreOnly(false)
            setStep(HOW_CORE_COUNT)
          }}
        >
          More to discover — hunts, stars, Defenders &amp; more
        </button>
      )}
      <ol className="rules how-rules">
        <li>One buddy in every colored region.</li>
        <li>One buddy in every row and column.</li>
        <li>No touching — not even diagonally.</li>
        <li>Swipe to mark × (quiet). Tap a mark to place a buddy.</li>
        <li>3 mistakes = lose a round (unless a shield saves you).</li>
        <li>Win to spin prizes. Catch the spark critter 5 times across games for a bonus prize.</li>
        <li>Perfect wins fill the buddy meter. 3 notches open Buddy Hunt: 5 taps to find 3 hidden buddies.</li>
        <li>Themed boards change buddy looks — rules stay the same.</li>
        <li>Stars: finish, beat the target time, then target time + high score + no undos. Undo costs 25 points.</li>
        <li>3 stars unlocks Roman&apos;s Trial. The Daily Challenge counts your first try only.</li>
        <li>Each color also has its own little shape in the tile corner.</li>
        <li>Your buddy flies by during play — tap it for rewards.</li>
        <li>Wild pets try to steal your treat pile on the board. Your pets defend it — tap the 🍖 count to stash treats safe.</li>
        <li>Every win earns 5 treats. Treats feed and upgrade pets. Swap safe treats for coins anytime.</li>
        <li>No pets yet? Claim your FREE buddy in the Stable — without defenders your treats are in danger.</li>
      </ol>
      <div className="cta-row">
        <button type="button" className="btn primary" onClick={onDone}>
          {doneLabel}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() =>
            setStep((s) => {
              const next = s + 1
              if (coreOnly) return next >= HOW_CORE_COUNT ? 0 : next
              return next % STEPS.length
            })
          }
        >
          Next tip
        </button>
      </div>
    </main>
  )
}
