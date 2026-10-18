import { useEffect, useState } from 'react'
import { HowDemo, type HowDemoId } from './HowDemo'

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
  { title: 'Spark critter', blurb: 'A silly spark zig-zags by. Catch it up to 5 times a day. A full set unlocks one prize spin.', demo: 'critter' },
  { title: 'Stars', blurb: '★ finish · ★★ beat the target time · ★★★ target time, a high score and zero undos. 3 stars unlocks the Trial.', demo: 'stars', isNew: true },
  { title: 'Combo', blurb: 'Quick good moves build a combo: ×1.5, ×2, up to ×3 points. Wait 4 seconds or slip up and it resets.', demo: 'combo', isNew: true },
  { title: 'Undo costs 25', blurb: 'Undo is always there, but each one costs 25 points and breaks your combo.', demo: 'undo', isNew: true },
  { title: "Roman's Trial", blurb: 'Beat a board with 3 stars to unlock it: race the clock with 2 hearts and no undo. Double coins.', demo: 'trial', isNew: true },
  { title: 'Daily Challenge', blurb: 'One new board every day. Only your first try counts — win daily to grow your streak.', demo: 'daily', isNew: true },
  { title: 'Pace timer', blurb: 'Replaying a board? The timer turns green when you are ahead of your best and red when behind.', demo: 'pace', isNew: true },
  { title: 'Remix boards', blurb: 'New boards every 3 days, the same set for everyone, so you can compare scores. Want more? Endless mode makes unlimited new boards.', demo: 'remix', isNew: true },
  { title: 'Buddy flyby', blurb: 'Your active buddy swoops across the board every couple of minutes. Tap it for a reward — coins, hints, hearts, even rescues!', demo: 'critter', isNew: true },
  { title: 'Treat defense', blurb: 'Wild buddies eye the treat pile. Your buddies chase them for 2–3 treats, or you tap to scare one off for 1 treat. Defense treats stop at 10 a day.', demo: 'hunt', isNew: true },
  { title: 'Treats & coins', blurb: 'A win earns 1 field treat, up to 5 a day. Snack 35, Feast 100, Banquet 250. Up to 3 feeds a day. Treats feed buddies. They are not coins.', demo: 'stars', isNew: true },
  { title: 'The Unseen', blurb: 'The Unseen watches between games and sometimes points you somewhere useful. Never a replay of where to press.', demo: 'combo', isNew: true },
  { title: 'Free buddy', blurb: 'New players pick one welcome buddy free: Lupa, Aquila, or Leo. Yours forever.', demo: 'region', isNew: true },
  { title: 'Special cards', blurb: 'Clear boards and win the Daily to unlock a special card. Collect it at romansgame.com in the Cards section. The Unseen card will appear there soon.', demo: 'stars', isNew: true },
] as const satisfies readonly { title: string; blurb: string; demo: HowDemoId; ms?: number; isNew?: boolean }[]

/** Index of the first card about the replay features (returning players start here). */
export const HOW_NEW_START = STEPS.findIndex((s) => 'isNew' in s && s.isNew)

const STEP_MS = 4500

export function HowToPlay({
  onDone,
  onBack,
  startAt = 0,
  doneLabel = 'Choose a level',
}: {
  onDone: () => void
  onBack?: () => void
  startAt?: number
  doneLabel?: string
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(STEPS.length - 1, startAt)))
  const current = STEPS[step]

  useEffect(() => {
    const s = STEPS[step] as { ms?: number }
    const id = window.setTimeout(() => setStep((n) => (n + 1) % STEPS.length), s.ms ?? STEP_MS)
    return () => window.clearTimeout(id)
  }, [step])

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
            {step + 1} / {STEPS.length}
            {'isNew' in current && current.isNew ? <span className="how-new-tag">New</span> : null}
          </p>
          <h3>{current.title}</h3>
          <p>{current.blurb}</p>
        </div>
      </div>
      <div className="how-dots" role="tablist" aria-label="How to play steps">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            className={i === step ? 'on' : ''}
            aria-label={s.title}
            onClick={() => setStep(i)}
          />
        ))}
      </div>
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
        <li>A win earns 1 field treat, up to 5 a day. Feed a buddy up to 3 times a day. Snack 35, Feast 100, Banquet 250. Treats are not coins.</li>
        <li>No buddy yet? Claim a free welcome buddy in the Stable: Lupa, Aquila, or Leo.</li>
        <li>Special cards are earned here. Collect them at romansgame.com in the Cards section. The Unseen card will appear there soon.</li>
        <li>More at <a href="https://romansgame.com/?from=game" target="_blank" rel="noopener noreferrer">romansgame.com</a>.</li>
      </ol>
      <div className="cta-row">
        <button type="button" className="btn primary" onClick={onDone}>
          {doneLabel}
        </button>
        <button type="button" className="btn ghost" onClick={() => setStep((s) => (s + 1) % STEPS.length)}>
          Next tip
        </button>
      </div>
    </main>
  )
}
