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
  { title: 'Stars', blurb: '★ finish · ★★ beat the target time · ★★★ target time, a high score and zero undos. 3 stars unlocks the Trial.', demo: 'stars', isNew: true },
  { title: 'Combo', blurb: 'Quick good moves build a combo: ×1.5, ×2, up to ×3 points. Wait 4 seconds or slip up and it resets.', demo: 'combo', isNew: true },
  { title: 'Undo costs 25', blurb: 'Undo is always there, but each one costs 25 points and breaks your combo.', demo: 'undo', isNew: true },
  { title: "Roman's Trial", blurb: 'Beat a board with 3 stars to unlock it: race the clock with 2 hearts and no undo. Double coins.', demo: 'trial', isNew: true },
  { title: 'Daily Challenge', blurb: 'One new board every day. Only your first try counts — win daily to grow your streak.', demo: 'daily', isNew: true },
  { title: 'Pace timer', blurb: 'Replaying a board? The timer turns green when you are ahead of your best and red when behind.', demo: 'pace', isNew: true },
  { title: 'Remix boards', blurb: 'New boards every 3 days, the same set for everyone, so you can compare scores. Want more? Endless mode makes unlimited new boards.', demo: 'remix', isNew: true },
  { title: 'Buddy flyby', blurb: 'Your active buddy swoops across the board every couple of minutes. Tap it for a reward — coins, hints, hearts, even rescues!', demo: 'critter', isNew: true },
  { title: 'Treat defense', blurb: 'Wild pets sneak onto the board trying to steal your treat pile! Your pets chase them off automatically (+3-5 treats). Or tap the invader yourself (+1-2). Tap the 🍖 count up top to stash your treats safe.', demo: 'hunt', isNew: true },
  { title: 'Treats & coins', blurb: 'Every win earns 5 field treats. Treats feed your buddies. Safe snacks can convert into coins. Bought treats can never be stolen.', demo: 'stars', isNew: true },
  { title: 'Shop', blurb: 'Real money buys coin packs and the starter pack, each with a price. A separate Spend coins section uses a coin icon. Coins are earned or bought in the game. They are not cash.', demo: 'stars', isNew: true },
  { title: 'Convert treats', blurb: 'Turn safe snacks into coins. You confirm first. The rate is set in the game. Nothing converts back to real money.', demo: 'hunt', isNew: true },
  { title: 'Scores & friends', blurb: 'A name keeps scores on this device. Sign in and finished games save to your account. Share a board so a friend can beat your time. Star players on the Board to follow them.', demo: 'daily', isNew: true },
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
      <p className="sub how-sub">The short version. The pictures below walk through the same ideas.</p>
      <section className="how-plain" aria-label="How the game works">
        <h3>Rules and levels</h3>
        <p>One buddy in every row, every column, and every colored region. They cannot touch, even at a corner. Swipe an X. Tap an X to place a buddy. Levels run easy, medium, hard, and expert. Stars: finish, beat the time, then beat the time and the score with no undos.</p>
        <h3>Hints and revives</h3>
        <p>Three mistakes cost a heart. A hint or a revive spends coins, or a free hint if you have one. Undo costs 25 points and breaks a combo.</p>
        <h3>Coins</h3>
        <p>You earn coins by playing. You can also buy them. Coins are not real money and cannot be cashed out.</p>
        <h3>Treats</h3>
        <p>Wins earn field treats. Claim them safe, then feed buddies or convert snacks into coins. You confirm before converting. Feasts and field treats are not converted. Nothing turns back into cash.</p>
        <h3>Shop</h3>
        <p>Real money is its own section: coin packs and the starter pack, each with a card icon and a price. Spend coins is separate, with a coin icon, for animals, treats, and badge upgrades.</p>
        <h3>Buddies</h3>
        <p>Buddies live in the Stable. Feed them, and one can ride along. New players can claim one buddy free.</p>
        <h3>Rewards</h3>
        <p>Badges, streaks, and daily prizes come from playing. Upgrade a badge with coins.</p>
        <h3>Scores and account</h3>
        <p>A name saves scores on this device. Sign in and finished games upload to your account.</p>
        <h3>Friends</h3>
        <p>Share a board so a friend can beat your time. Star players on the Board to keep a friends list. The Daily is one board a day. Remix boards change every three days.</p>
      </section>
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
        <li>Every win earns 5 treats. Feed buddies, or convert safe snacks into coins after you confirm. No cash-out.</li>
        <li>Real money buys coin packs and the starter pack. Spend coins on animals, treats, and badge upgrades.</li>
        <li>Sign in to save scores to your account. Share a board with a friend, or star players on the Board.</li>
        <li>No pets yet? Claim your FREE buddy in the Stable — without defenders your treats are in danger.</li>
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
