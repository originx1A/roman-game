import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloudScoresButton, useCloud } from '../cloud/CloudScores'
import { loadSavedVote, saveSavedVote } from '../game/analytics'

/** Hooded figure on a wide home screen. Hidden on phones and on narrower windows, where he covers buttons. The bubble is up only while his line plays. */
export function HomeUnseen({ onUnseen, unseenLine }: { onUnseen: () => void; unseenLine: string | null }) {
  const [bubble, setBubble] = useState<{ text: string; leaving: boolean } | null>(null)
  useEffect(() => {
    if (unseenLine) {
      setBubble({ text: unseenLine.replace(/^The Unseen:\s*/i, ''), leaving: false })
      return
    }
    setBubble((cur) => (cur && !cur.leaving ? { ...cur, leaving: true } : cur))
    const t = window.setTimeout(() => setBubble((cur) => (cur?.leaving ? null : cur)), 1000)
    return () => window.clearTimeout(t)
  }, [unseenLine])
  return (
    <div className="home-unseen-wrap">
      {bubble ? <span className={`home-unseen-line${bubble.leaving ? ' is-leaving' : ''}`}>{bubble.text}</span> : null}
      <button type="button" className="home-unseen" data-testid="home-unseen" aria-label="The Unseen" onClick={onUnseen}>
        <picture>
          <source srcSet="/images/unseen.webp" type="image/webp" />
          <img src="/images/unseen.png" alt="" draggable={false} />
        </picture>
      </button>
    </div>
  )
}

/** Phone-only arrival screen. No hooded figure here: at phone size he covers the card or the bottom tabs. */
export function PhoneHome({
  playerName,
  onPlay,
  onHow,
  onShop,
  onAccount,
  onStable,
  onShare,
  onBoard,
  onBug,
  onFamily,
  onInfo,
  buddy,
  unseen,
}: {
  playerName: string
  onPlay: () => void
  onHow: () => void
  onShop: () => void
  onAccount: () => void
  onStable: () => void
  onShare: () => void
  onBoard: () => void
  onBug: () => void
  onFamily: () => void
  onInfo: () => void
  buddy: ReactNode
  unseen: ReactNode
}) {
  const cloud = useCloud()
  const signed = cloud.status === 'signed-in' && !!cloud.name
  const who = signed ? cloud.publicName || cloud.name : playerName || 'Guest'
  return (
    <main className="phone-home scroll-pane">
      <div className="phone-who">
        <div>
          <strong>{who}</strong>
          <small>{signed ? 'Saved' : 'On this device'}</small>
        </div>
        <button type="button" className="family-link" onClick={onFamily}>
          Parent & kid accounts
        </button>
      </div>
      {buddy}
      <button type="button" className="btn primary phone-play" onClick={onPlay}>
        Play
      </button>
      <div className="phone-grid">
        <button type="button" onClick={onShop}><span aria-hidden>🪙</span>Shop</button>
        <CloudScoresButton suggestedName={playerName} short onInfo={onInfo} />
        <button type="button" onClick={onAccount}><span aria-hidden>☺</span>You</button>
        <button type="button" onClick={onHow}><span aria-hidden>?</span>How</button>
        <button type="button" onClick={onStable}><span aria-hidden>🐾</span>Buddies</button>
        <button type="button" onClick={onShare}><span aria-hidden>↗</span>Share</button>
        <button type="button" onClick={onBoard}><span aria-hidden>🏆</span>Leaderboard</button>
      </div>
      {unseen}
      <button type="button" className="phone-quiet" onClick={onBug}>Report a bug</button>
    </main>
  )
}

/** Phone Info row: the question and the thumbs on one line. One stored vote, and a tap can change it. */
export function PhoneVote({ onVote }: { onVote: (vote: 'up' | 'down', account: string) => void }) {
  const cloud = useCloud()
  const account = cloud.status === 'signed-in' ? cloud.email ?? '' : ''
  const [vote, setVote] = useState<'up' | 'down' | null>(() => loadSavedVote(typeof localStorage === 'undefined' ? null : localStorage, account))
  const [thanks, setThanks] = useState(false)
  useEffect(() => {
    setVote(loadSavedVote(typeof localStorage === 'undefined' ? null : localStorage, account))
  }, [account])
  return (
    <div className="info-vote">
      <span>Do you like the game?</span>
      <button type="button" className={`fb-btn${vote === 'up' ? ' is-on' : ''}`} aria-label="Thumbs up" aria-pressed={vote === 'up'} onClick={() => { setVote('up'); saveSavedVote(typeof localStorage === 'undefined' ? null : localStorage, 'up', account); onVote('up', account); setThanks(true) }}>👍</button>
      <button type="button" className={`fb-btn${vote === 'down' ? ' is-on' : ''}`} aria-label="Thumbs down" aria-pressed={vote === 'down'} onClick={() => { setVote('down'); saveSavedVote(typeof localStorage === 'undefined' ? null : localStorage, 'down', account); onVote('down', account); setThanks(true) }}>👎</button>
      {thanks ? <small>Thanks!</small> : null}
    </div>
  )
}

export function InfoSheet({
  open,
  onClose,
  buildTag,
  soundOn,
  onToggleSound,
  feedback,
  onFamily,
}: {
  open: boolean
  onClose: () => void
  buildTag: string
  soundOn: boolean
  onToggleSound: () => void
  feedback: ReactNode
  onFamily: () => void
}) {
  const [view, setView] = useState<'main' | 'terms' | 'privacy' | 'contact'>('main')
  if (!open) return null
  return createPortal(
    <div className="phone-sheet" role="dialog" aria-modal="true" aria-label="Info">
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="phone-sheet-card">
        <header>
          <strong>{view === 'main' ? 'Info' : view === 'terms' ? 'Terms' : view === 'privacy' ? 'Privacy' : 'Contact'}</strong>
          <button type="button" onClick={view === 'main' ? onClose : () => setView('main')} aria-label={view === 'main' ? 'Close' : 'Back'}>
            {view === 'main' ? '✕' : 'Back'}
          </button>
        </header>
        {view === 'main' ? (
          <div className="info-list">
            <button type="button" onClick={onToggleSound}><span aria-hidden>🔊</span>Sound<small>{soundOn ? 'On' : 'Off'}</small></button>
            <div className="info-feedback">{feedback}</div>
            <button type="button" onClick={() => setView('privacy')}><span aria-hidden>🔒</span>Privacy</button>
            <button type="button" onClick={() => setView('terms')}><span aria-hidden>📄</span>Terms</button>
            <button type="button" onClick={() => setView('contact')}><span aria-hidden>✉️</span>Contact</button>
            <button type="button" onClick={onFamily}><span aria-hidden>👨‍👧</span>Parent & kid accounts</button>
            <a href="https://jrny.fun" target="_blank">A JRNY project</a>
            <p className="info-build">Roman's Game · {buildTag}</p>
          </div>
        ) : null}
        {view === 'terms' ? (
          <div className="info-copy">
            <p>Free to play. No account needed.</p>
            <p>No purchase is required.</p>
            <a href="https://romansgame.com/terms" target="_blank" rel="noopener noreferrer">Full terms</a>
          </div>
        ) : null}
        {view === 'privacy' ? (
          <div className="info-copy">
            <p>The game can count play without your name. You can switch that off in You.</p>
            <p>Card payments stay with the store or Stripe.</p>
            <a href="./privacy.html">Full privacy</a>
          </div>
        ) : null}
        {view === 'contact' ? (
          <div className="info-copy">
            <p>support@romansgame.com</p>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function PlayerPanel({
  open,
  onClose,
  fallbackName,
  coins,
  stats,
  onShop,
  onAccount,
}: {
  open: boolean
  onClose: () => void
  fallbackName: string
  coins: number
  stats: { label: string; value: string }[]
  onShop: () => void
  onAccount: () => void
}) {
  const cloud = useCloud()
  if (!open) return null
  const signed = cloud.status === 'signed-in' && !!cloud.name
  const who = signed ? cloud.publicName || cloud.name : fallbackName || 'Guest'
  return createPortal(
    <div className="phone-sheet" role="dialog" aria-modal="true" aria-label="Player">
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="phone-sheet-card player-panel" data-testid="player-panel">
        <header>
          <strong>{who}</strong>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <p className="player-saved">{signed ? 'Saved' : 'On this device'}</p>
        <p className="player-coins"><b>{coins}</b><span>coins</span></p>
        <dl className="player-stats">
          {stats.map((s) => (
            <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
          ))}
        </dl>
        <div className="player-actions">
          <button type="button" className="btn primary" data-testid="coin-shop" onClick={onShop}>Coin shop</button>
          <button type="button" className="btn ghost" onClick={onAccount}>You</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Phone settings once an account holds the save. Sound, account, and About. */
export function PhoneSettings({
  playerName,
  soundOn,
  reduceMotion,
  onToggleSound,
  onToggleMotion,
  onInfo,
  onFamily,
  buildTag,
}: {
  playerName: string
  soundOn: boolean
  reduceMotion: boolean
  onToggleSound: () => void
  onToggleMotion: () => void
  onInfo: () => void
  onFamily: () => void
  buildTag: string
}) {
  const cloud = useCloud()
  const signed = cloud.status === 'signed-in' && !!cloud.name
  const who = signed ? cloud.publicName || cloud.name : playerName || 'Guest'
  return (
    <main className="phone-settings scroll-pane">
      <h2>Settings</h2>
      <button type="button" className="set-row" onClick={onToggleSound}>
        <span>Sound</span>
        <small>{soundOn ? 'On' : 'Off'}</small>
      </button>
      <button type="button" className="set-row" onClick={onToggleMotion}>
        <span>Reduce motion</span>
        <small>{reduceMotion ? 'On' : 'Off'}</small>
      </button>
      <section className="set-block">
        <h3>Account</h3>
        <p className="set-who">
          <strong>{who}</strong>
          <small>{signed ? 'Saved to your account' : 'On this device'}</small>
        </p>
        <CloudScoresButton suggestedName={playerName} short onInfo={onInfo} />
        <button type="button" className="family-link" onClick={onFamily}>
          Parent & kid accounts
        </button>
      </section>
      <section className="set-block">
        <h3>About</h3>
        <button type="button" className="set-row" onClick={onInfo}>
          <span>Info</span>
        </button>
        <p className="info-build">Roman's Game · {buildTag}</p>
      </section>
    </main>
  )
}

/** In-game explanation. Nothing here opens another website. */
export function FamilySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return createPortal(
    <div className="phone-sheet" role="dialog" aria-modal="true" aria-label="Parent and kid accounts">
      <button type="button" className="phone-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="phone-sheet-card">
        <header>
          <strong>Parent & kid accounts</strong>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <ul className="family-points">
          <li>Anyone can play. No account.</li>
          <li>Under 13, a parent signs up.</li>
          <li>They can read the news with you.</li>
          <li>Scores stay on this device until you sign in.</li>
          <li>Payments are for adults. Kids get gifts from a linked grown-up.</li>
        </ul>
        <button type="button" className="btn primary" onClick={onClose}>OK</button>
      </div>
    </div>,
    document.body,
  )
}
