import { useEffect, useState } from 'react'
import { HowDemo, type HowDemoId } from './HowDemo'

const STEPS = [
  { title: 'One per region', blurb: 'Each colored area gets exactly one buddy.', demo: 'region' },
  { title: 'Rows & columns', blurb: 'Every row and every column gets one buddy too.', demo: 'lines' },
  { title: 'No touching', blurb: "Buddies can't share an edge or a corner — not even diagonally.", demo: 'touch' },
  { title: 'Swipe & tap', blurb: 'Swipe to paint × marks (no talking!). Tap a mark to place a buddy.', demo: 'swipe' },
  { title: 'Hearts', blurb: 'Three mistakes cost a heart. Lose all three and the board is lost — place every buddy to win it.', demo: 'hearts' },
  {
    title: 'Buddy Hunt',
    blurb:
      'Every perfect win (no mistakes, no wrong buddies) fills one notch of the buddy meter. 3 notches open Buddy Hunt: 5 taps to find 3 hidden buddies. Find 1 = 8 coins, 2 = 15, all 3 = 15 + a bonus heart.',
    demo: 'hunt',
    // longer text: stay up a bit longer before the next tip
    ms: 8000,
  },
  { title: 'Spark critter', blurb: 'A silly spark zig-zags by at random. Catch it across games — 5 catches unlock a prize spin!', demo: 'critter' },
  { title: 'Stars', blurb: '★ finish · ★★ beat the target time · ★★★ target time, a high score and no mistakes. 3 stars unlocks the Trial.', demo: 'stars', isNew: true },
  { title: 'Combo', blurb: 'Quick good moves build a combo: ×1.5, ×2, up to ×3 points. Wait 4 seconds or slip up and it resets.', demo: 'combo', isNew: true },
  { title: "Roman's Trial", blurb: 'Beat a board with 3 stars to unlock it: race the clock with 2 hearts. Double coins. No Defenders ride in the Trial.', demo: 'trial', isNew: true },
  { title: 'Daily Challenge', blurb: 'One new board every day. Only your first try counts — win daily to grow your streak.', demo: 'daily', isNew: true },
  { title: 'Pace timer', blurb: 'Replaying a board? The timer turns green when you are ahead of your best and red when behind.', demo: 'pace', isNew: true },
  { title: 'Remix boards', blurb: 'New boards every 3 days, the same set for everyone, so you can compare scores. Want more? Endless mode makes unlimited new boards.', demo: 'remix', isNew: true },
  { title: 'Defender flyby', blurb: 'Your riding Defender swoops across the board every couple of minutes. Tap them for a reward — coins, treats, even hearts!', demo: 'critter', isNew: true },
  { title: 'Treat defense', blurb: 'Wild pets sneak onto the board trying to steal your treat pile! Your Defenders chase them off automatically (+3-5 treats). Or tap the invader yourself (+1-2). Tap the 🍖 count up top to stash your treats safe.', demo: 'hunt', isNew: true },
  { title: 'Treats & coins', blurb: 'Every win earns 5 field treats. Treats feed and grow your Defenders (levels 1-30). Swap safe treats for coins (15 coins each). Coins are earned by playing — never bought.', demo: 'stars', isNew: true },
  { title: 'The Unseen', blurb: 'A faceless hooded figure watches from the smoke. He never helps and cannot be bought — he just mocks, especially when a Defender has to save you.', demo: 'combo', isNew: true },
  { title: 'Defender Boards', blurb: "Some boards wear a Defender's colours. If you hold calls for that Defender, they step in and help — once. Buy calls in The Stable with coins you win.", demo: 'region', isNew: true },
  { title: 'Free Defender', blurb: 'New players pick one Defender FREE — Lupa, Aquila, Leo, Invictus, or Nox — with 10 calls in the bank. Choose wisely.', demo: 'region', isNew: true },
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
  // 9.33-a5: fit-to-screen — the demo and the full rules list are two panels of one screen, never a scroll
  const [panel, setPanel] = useState<'watch' | 'rules'>('watch')
  const current = STEPS[step]

  useEffect(() => {
    const s = STEPS[step] as { ms?: number }
    const id = window.setTimeout(() => setStep((n) => (n + 1) % STEPS.length), s.ms ?? STEP_MS)
    return () => window.clearTimeout(id)
  }, [step])

  return (
    <main className="panel how-panel fit-screen">
      <div className="how-top">
        {onBack && (
          <button type="button" className="hud-back how-back" onClick={onBack} aria-label="Back">
            ←
          </button>
        )}
        <h2>How to play</h2>
      </div>
      <p className="sub how-sub">Watch the demo, then jump in.</p>
      <div className="how-tabs" role="tablist" aria-label="How to play sections">
        <button type="button" role="tab" aria-selected={panel === 'watch'} className={`how-tab ${panel === 'watch' ? 'on' : ''}`} onClick={() => setPanel('watch')}>
          Watch
        </button>
        <button type="button" role="tab" aria-selected={panel === 'rules'} className={`how-tab ${panel === 'rules' ? 'on' : ''}`} onClick={() => setPanel('rules')}>
          The rules
        </button>
      </div>
      {panel === 'watch' ? (
      <>
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
      </>
      ) : (
      <ol className="rules how-rules">
        <li>One buddy in every colored region.</li>
        <li>One buddy in every row and column.</li>
        <li>No touching — not even diagonally.</li>
        <li>Swipe to mark × (quiet). Tap a mark to place a buddy.</li>
        <li>3 mistakes = lose a round (unless a shield saves you).</li>
        <li>Win to spin prizes. Catch the spark critter 5 times across games for a bonus prize.</li>
        <li>Perfect wins fill the buddy meter. 3 notches open Buddy Hunt: 5 taps to find 3 hidden buddies.</li>
        <li>Defender Boards: a board in a Defender's colours calls that Defender in — if you hold their calls. One call, one rescue of a board, never twice.</li>
        <li>Themed boards change buddy looks — rules stay the same.</li>
        <li>Stars: finish, beat the target time, then target time + high score + no mistakes.</li>
        <li>3 stars unlocks Roman&apos;s Trial. The Daily Challenge counts your first try only.</li>
        <li>Each color also has its own little shape in the tile corner.</li>
        <li>Your Defender flies by during play — tap them for rewards.</li>
        <li>Wild pets try to steal your treat pile on the board. Your Defenders guard it — tap the 🍖 count to stash treats safe.</li>
        <li>Every win earns 5 treats. Treats feed and grow Defenders. Swap safe treats for coins anytime.</li>
        <li>No Defenders yet? Claim your FREE Defender in the Stable — without Defenders your treats are in danger.</li>
      </ol>
      )}
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
