import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Atmosphere } from './Atmosphere'
import { HowDemo, type HowDemoId } from './HowDemo'

/* RG03 (preview, brief RG-2026-11-07): the first-run carousel leads with the
   five core-rule cards ONLY — placing a buddy, rows/columns, no touching,
   swipe & tap, hearts. Every other card stays in the deck (same component,
   same order after the core five, nothing deleted) and is presented as
   "More to discover" — secondary systems are introduced after the first
   clear instead of competing with the rules on a brand-new player's first
   screen. Returning players still start at the new-feature cards. */
export const HOW_CORE_COUNT = 5

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

/** The rules list, verbatim. Rendered whole when it fits; on short screens
 *  (9.33-a12: visual height <= 600 — Tony's phone band) it pages 8 + 8, because
 *  16 rules cannot fit a ~500px band at readable size without spilling over
 *  the buttons below (the a11 audit's blind spot: the spill painted OVER the
 *  cta row while main's scrollHeight still read "fits"). 9.33-a13: the full
 *  list is also measured after render at ANY size — if it does not fit its
 *  box (the 430x727 band spilled rules 15-16), the pager takes over. */
export const HOW_RULES: readonly string[] = [
  'One buddy in every colored region.',
  'One buddy in every row and column.',
  'No touching — not even diagonally.',
  'Swipe to mark × (quiet). Tap a mark to place a buddy.',
  '3 mistakes = lose a round (unless a shield saves you).',
  'Win to spin prizes. Catch the spark critter 5 times across games for a bonus prize.',
  'Perfect wins fill the buddy meter. 3 notches open Buddy Hunt: 5 taps to find 3 hidden buddies.',
  "Defender Boards: a board in a Defender's colours calls that Defender in — if you hold their calls. One call, one rescue of a board, never twice.",
  'Themed boards change buddy looks — rules stay the same.',
  'Stars: finish, beat the target time, then target time + high score + no mistakes.',
  "3 stars unlocks Roman's Trial. The Daily Challenge counts your first try only.",
  'Each color also has its own little shape in the tile corner.',
  'Your Defender flies by during play — tap them for rewards.',
  'Wild pets try to steal your treat pile on the board. Your Defenders guard it — tap the 🍖 count to stash treats safe.',
  'Every win earns 5 treats. Treats feed and grow Defenders. Swap safe treats for coins anytime.',
  'No Defenders yet? Claim your FREE Defender in the Stable — without Defenders your treats are in danger.',
]
export const HOW_RULES_PAGE = 8

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
  /** RG03: brand-new player's first pass — the Watch carousel cycles the
   *  core-rule cards only. "More to discover" opens the full deck. */
  firstRun?: boolean
}) {
  const [step, setStep] = useState(() => Math.max(0, Math.min(STEPS.length - 1, startAt)))
  // 9.33-a5: fit-to-screen — the demo and the full rules list are two panels of one screen, never a scroll
  const [panel, setPanel] = useState<'watch' | 'rules'>('watch')
  // 9.33-a12: on short screens the rules page 8 + 8 (see HOW_RULES note).
  const [rulesPage, setRulesPage] = useState(0)
  const [shortScreen, setShortScreen] = useState(
    () => typeof window !== 'undefined' && (window.visualViewport?.height ?? window.innerHeight) <= 600,
  )
  // 9.33-a13: the <=600 mount heuristic misses wider-but-short bands — at a
  // 727px-tall, 430px-wide band the full list still spilled rules 15-16 over
  // the buttons (larger type, same trap as a12). So the full list is also
  // MEASURED after render: if it does not fit its box, the pager takes over.
  // The height guess only decides the first paint; measurement decides.
  const [rulesMeasuredPaged, setRulesMeasuredPaged] = useState(false)
  const rulesListRef = useRef<HTMLOListElement | null>(null)
  useEffect(() => {
    const onResize = () => {
      setShortScreen((window.visualViewport?.height ?? window.innerHeight) <= 600)
      // size changed: let the full list render once and be measured again
      setRulesMeasuredPaged(false)
    }
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])
  const rulesPaged = shortScreen || rulesMeasuredPaged
  useLayoutEffect(() => {
    if (panel !== 'rules' || rulesPaged) return
    const ol = rulesListRef.current
    if (ol && ol.scrollHeight > ol.clientHeight + 2) setRulesMeasuredPaged(true)
  }, [panel, rulesPaged, step])
  // webfonts move the metrics; re-measure once they land
  useEffect(() => {
    if (panel !== 'rules' || rulesPaged) return
    let live = true
    document.fonts?.ready.then(() => {
      if (!live || rulesPaged) return
      const ol = rulesListRef.current
      if (ol && ol.scrollHeight > ol.clientHeight + 2) setRulesMeasuredPaged(true)
    })
    return () => {
      live = false
    }
  }, [panel, rulesPaged])
  // RG03: a first-run player starts in core-only mode; tapping "More to
  // discover" (or any dot past the core five) opens the full deck.
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
    <main className="panel how-panel fit-screen has-atmo">
      <Atmosphere variant="panel" tint="#2fd4a7" />
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
      </>
      ) : rulesPaged ? (
      <>
      <ol className="rules how-rules" start={rulesPage * HOW_RULES_PAGE + 1}>
        {HOW_RULES.slice(rulesPage * HOW_RULES_PAGE, (rulesPage + 1) * HOW_RULES_PAGE).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <div className="how-rules-pager">
        <button type="button" className="btn ghost" disabled={rulesPage === 0} onClick={() => setRulesPage((p) => Math.max(0, p - 1))}>
          ‹ Back
        </button>
        <span>
          Rules {rulesPage * HOW_RULES_PAGE + 1}–{Math.min(HOW_RULES.length, (rulesPage + 1) * HOW_RULES_PAGE)} of {HOW_RULES.length}
        </span>
        <button
          type="button"
          className="btn ghost"
          disabled={(rulesPage + 1) * HOW_RULES_PAGE >= HOW_RULES.length}
          onClick={() => setRulesPage((p) => p + 1)}
        >
          More rules ›
        </button>
      </div>
      </>
      ) : (
      <ol className="rules how-rules" ref={rulesListRef}>
        {HOW_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      )}
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
