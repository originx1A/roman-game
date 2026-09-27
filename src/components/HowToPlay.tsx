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
  { title: 'Spark critter', blurb: 'A silly spark zig-zags by at random. Catch it across games — 5 catches unlock a prize spin!', demo: 'critter' },
] as const satisfies readonly { title: string; blurb: string; demo: HowDemoId; ms?: number }[]

const STEP_MS = 4500

export function HowToPlay({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const [step, setStep] = useState(0)
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
      </ol>
      <div className="cta-row">
        <button type="button" className="btn primary" onClick={onDone}>
          Choose a level
        </button>
        <button type="button" className="btn ghost" onClick={() => setStep((s) => (s + 1) % STEPS.length)}>
          Next tip
        </button>
      </div>
    </main>
  )
}
