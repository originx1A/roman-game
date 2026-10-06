import { useRef, useState } from 'react'
import { cosmeticsFor, levelInfo, petById, type MoodKind, type PetId } from '../game/pets'
import { PetArt } from './PetArt'

const TAP_LINES = ['Ave!', 'Again!', 'Hee hee!', 'Let’s play!', 'Roma!', 'Pat pat!', 'One more board?', 'Best buddy!']

/** 9.30-a: the active buddy lives on the home screen and reacts to taps. */
export function HomePet({ id, xp, mood, canPet, onTap, onStable }: { id: PetId | null; xp: number; mood?: MoodKind; canPet?: boolean; onTap: () => void; onStable: () => void }) {
  const [hop, setHop] = useState(0)
  const [line, setLine] = useState('')
  const last = useRef(-1)
  const timer = useRef<number | undefined>(undefined)
  if (!id) {
    return (
      <button type="button" className="home-pet is-solo" onClick={onStable} data-home-pet="solo">
        <span className="home-pet-empty" aria-hidden="true">?</span>
        <span className="home-pet-text">
          <strong>Solo</strong>
          <small>Pick a buddy in The Stable</small>
        </span>
      </button>
    )
  }
  const p = petById(id)!
  const lv = levelInfo(xp)
  const tap = () => {
    let i = Math.floor(Math.random() * TAP_LINES.length)
    if (i === last.current) i = (i + 1) % TAP_LINES.length
    last.current = i
    setLine(TAP_LINES[i])
    setHop((h) => h + 1)
    onTap()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLine(''), 1600)
  }
  return (
    <div className="home-pet" data-home-pet={id}>
      <button type="button" className="home-pet-tap" onClick={tap} aria-label={`Pet ${p.name}`}>
        <span key={hop} className={`home-pet-body ${hop ? (cosmeticsFor(lv.level).flip && hop % 4 === 0 ? 'is-flip' : 'is-hop') : ''}`}>
          <PetArt id={id} size={84} title={p.name} level={lv.level} stars={lv.stars} />
        </span>
        {canPet ? <span className="home-pet-dot" data-testid="pet-dot" aria-hidden="true" /> : null}
        {line ? <span className="home-pet-bubble">{line}</span> : null}
      </button>
      <button type="button" className="home-pet-text" onClick={onStable}>
        <strong>{p.name}</strong>
        <small>
          Lv {lv.level}{lv.stars ? ` ${'★'.repeat(lv.stars)}` : ''} · {mood === 'happy' ? '😊' : mood === 'hungry' ? '🥺' : '🙂'} · The Stable ›
        </small>
      </button>
    </div>
  )
}
