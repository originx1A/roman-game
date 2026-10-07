import { useEffect, useState, type ReactElement } from 'react'
import { cosmeticsFor, type PetId } from '../game/pets'

/*
 * 9.30-a buddy art: chunky, round, cartoon pets with the game's navy outline and gold/red Roman
 * touches (bulla, SPQR standard, laurel, crest, a witch hat for the Halloween owl). Pure SVG, so
 * it's crisp at any size and the locked silhouette is the same drawing with a CSS filter.
 */
const INK = '#07122a'
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Eye({ x, y, r = 6, iris }: { x: number; y: number; r?: number; iris?: string }) {
  return (
    <g className="pet-eye" style={{ transformOrigin: `${x}px ${y}px` }}>
      <circle cx={x} cy={y} r={r} fill="#fff" {...S} strokeWidth={2.5} />
      {iris ? <circle cx={x} cy={y + 0.5} r={r * 0.62} fill={iris} /> : null}
      <circle cx={x + 0.6} cy={y + 0.8} r={r * 0.45} fill={INK} />
      <circle cx={x + 2} cy={y - 1.6} r={r * 0.2} fill="#fff" />
    </g>
  )
}

function Wolf() {
  return (
    <>
      <path d="M22 44 L26 14 L44 32 Z" fill="#8391b3" {...S} />
      <path d="M78 44 L74 14 L56 32 Z" fill="#8391b3" {...S} />
      <path d="M28 36 L29 22 L38 31 Z" fill="#ffb3c1" />
      <path d="M72 36 L71 22 L62 31 Z" fill="#ffb3c1" />
      <ellipse cx="50" cy="52" rx="31" ry="27" fill="#9aa8c7" {...S} />
      <path d="M22 58 Q30 50 36 60 Q30 66 22 58 Z" fill="#b8c3dc" />
      <path d="M78 58 Q70 50 64 60 Q70 66 78 58 Z" fill="#b8c3dc" />
      <ellipse cx="50" cy="64" rx="16" ry="12" fill="#eef2fa" {...S} />
      <ellipse cx="50" cy="57.5" rx="5.5" ry="3.8" fill={INK} />
      <path d="M44 66 Q50 71 56 66" fill="none" {...S} strokeWidth={2.5} />
      <Eye x={38} y={47} />
      <Eye x={62} y={47} />
      <path d="M24 78 Q50 90 76 78 L74 86 Q50 97 26 86 Z" fill="#e63946" {...S} />
      <circle cx="50" cy="90" r="5" fill="#ffd166" {...S} strokeWidth={2.5} />
    </>
  )
}

function Eagle() {
  return (
    <>
      <path d="M26 50 Q6 56 10 80 Q22 70 32 72 Z" fill="#7a4a22" {...S} />
      <path d="M74 50 Q94 56 90 80 Q78 70 68 72 Z" fill="#7a4a22" {...S} />
      <ellipse cx="50" cy="62" rx="24" ry="26" fill="#8b5a2b" {...S} />
      <path d="M40 72 Q50 78 60 72" fill="none" stroke="#b07a45" strokeWidth={3} strokeLinecap="round" />
      <path d="M42 80 Q50 85 58 80" fill="none" stroke="#b07a45" strokeWidth={3} strokeLinecap="round" />
      <circle cx="50" cy="36" r="21" fill="#f4fbff" {...S} />
      <path d="M43 40 Q50 36 57 40 Q56 51 50 55 Q44 51 43 40 Z" fill="#ffc233" {...S} strokeWidth={2.5} />
      <path d="M36 26.5 L45 27.5" {...S} strokeWidth={2.5} />
      <path d="M64 26.5 L55 27.5" {...S} strokeWidth={2.5} />
      <Eye x={41} y={34} r={5} />
      <Eye x={59} y={34} r={5} />
      <rect x="28" y="84" width="44" height="12" rx="4" fill="#ffd166" {...S} strokeWidth={2.5} />
      <text x="50" y="93.5" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK} fontFamily="Titan One, Fredoka, system-ui, sans-serif">
        SPQR
      </text>
    </>
  )
}

function Lion() {
  const mane = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return <circle key={i} cx={50 + Math.cos(a) * 27} cy={55 + Math.sin(a) * 26} r={11} fill="#d9661f" {...S} />
  })
  const leaves = Array.from({ length: 5 }, (_, i) => {
    const t = (i - 2) / 2
    const lx = 50 + t * 20
    const ly = 22 + Math.abs(t) * 7
    return (
      <g key={i}>
        <ellipse cx={lx - 3} cy={ly} rx="5.5" ry="3" fill="#3fbf6f" stroke={INK} strokeWidth={1.8} transform={`rotate(${-30 + t * 25} ${lx - 3} ${ly})`} />
      </g>
    )
  })
  return (
    <>
      {mane}
      <circle cx="50" cy="55" r="25" fill="#e8812a" />
      <circle cx="32" cy="36" r="7" fill="#ffc15e" {...S} />
      <circle cx="68" cy="36" r="7" fill="#ffc15e" {...S} />
      <circle cx="50" cy="56" r="23" fill="#ffc15e" {...S} />
      <ellipse cx="50" cy="66" rx="13" ry="9.5" fill="#fff1d0" {...S} strokeWidth={2.5} />
      <path d="M45 60 L55 60 L50 65.5 Z" fill="#b5523b" {...S} strokeWidth={2} />
      <path d="M44 69 Q50 73 56 69" fill="none" {...S} strokeWidth={2.2} />
      <Eye x={41} y={51} r={5.5} />
      <Eye x={59} y={51} r={5.5} />
      <circle cx="35" cy="62" r="3.5" fill="#ff9b8a" opacity="0.7" />
      <circle cx="65" cy="62" r="3.5" fill="#ff9b8a" opacity="0.7" />
      {leaves}
      <circle cx="50" cy="22" r="3.2" fill="#ffd166" stroke={INK} strokeWidth={1.8} />
    </>
  )
}

function Horse() {
  return (
    <>
      <path d="M34 26 L30 6 L44 20 Z" fill="#6b4226" {...S} />
      <path d="M66 26 L70 6 L56 20 Z" fill="#6b4226" {...S} />
      <path d="M50 4 Q30 4 28 20 Q40 14 50 14 Q60 14 72 20 Q70 4 50 4 Z" fill="#e63946" {...S} />
      <path d="M24 34 Q18 50 22 70 L32 62 Z" fill="#2b1a10" {...S} />
      <path d="M76 34 Q82 50 78 70 L68 62 Z" fill="#2b1a10" {...S} />
      <path d="M30 34 Q30 18 50 18 Q70 18 70 34 L68 70 Q66 90 50 94 Q34 90 32 70 Z" fill="#7b4a2a" {...S} />
      <path d="M34 26 Q50 20 66 26 L64 34 Q50 29 36 34 Z" fill="#ffd166" {...S} strokeWidth={2.5} />
      <circle cx="50" cy="29" r="2.8" fill="#e63946" stroke={INK} strokeWidth={1.6} />
      <path d="M46 38 Q50 34 54 38 L52 58 L48 58 Z" fill="#f4fbff" />
      <ellipse cx="50" cy="78" rx="17" ry="13" fill="#d9b08c" {...S} />
      <ellipse cx="43" cy="78" rx="2.8" ry="3.8" fill={INK} />
      <ellipse cx="57" cy="78" rx="2.8" ry="3.8" fill={INK} />
      <path d="M44 86 Q50 89 56 86" fill="none" {...S} strokeWidth={2.2} />
      <Eye x={39} y={48} r={5.5} />
      <Eye x={61} y={48} r={5.5} />
    </>
  )
}

function Owl() {
  return (
    <>
      <path d="M26 46 Q12 62 22 84 Q28 70 34 66 Z" fill="#4b2fa3" {...S} />
      <path d="M74 46 Q88 62 78 84 Q72 70 66 66 Z" fill="#4b2fa3" {...S} />
      <ellipse cx="50" cy="60" rx="28" ry="32" fill="#6c4bd1" {...S} />
      <ellipse cx="50" cy="74" rx="15" ry="14" fill="#c9b8ff" />
      <path d="M43 70 l3 3 l3 -3 M51 70 l3 3 l3 -3 M47 78 l3 3 l3 -3" fill="none" stroke="#8e76e8" strokeWidth={2} strokeLinecap="round" />
      <circle cx="39" cy="50" r="12" fill="#e6ddff" {...S} strokeWidth={2.5} />
      <circle cx="61" cy="50" r="12" fill="#e6ddff" {...S} strokeWidth={2.5} />
      <Eye x={39} y={50} r={8} iris="#ff9f1c" />
      <Eye x={61} y={50} r={8} iris="#ff9f1c" />
      <path d="M46 58 L54 58 L50 65 Z" fill="#ffc233" {...S} strokeWidth={2} />
      <path d="M26 30 L50 2 L74 30 Z" fill="#1d1340" {...S} />
      <rect x="31" y="22" width="38" height="7" rx="2" fill="#ff8c1a" stroke={INK} strokeWidth={2} />
      <ellipse cx="50" cy="31" rx="32" ry="5.5" fill="#1d1340" {...S} />
      <path d="M40 92 l-3 5 M46 93 l0 5 M54 93 l0 5 M60 92 l3 5" stroke="#ffc233" strokeWidth={3} strokeLinecap="round" />
    </>
  )
}

const ART: Record<PetId, () => ReactElement> = { lupa: Wolf, aquila: Eagle, leo: Lion, invictus: Horse, nox: Owl }

/** Where each buddy's head top sits (x, y, scale) so a hat lands on it */
const HEAD: Record<PetId, { x: number; y: number; k: number }> = {
  lupa: { x: 50, y: 22, k: 0.95 },
  aquila: { x: 50, y: 17, k: 0.9 },
  leo: { x: 50, y: 19, k: 0.95 },
  invictus: { x: 50, y: 8, k: 0.85 },
  nox: { x: 50, y: 3, k: 0.7 },
}

/** 9.30-m milestone hats: laurel (Lv10), legion helmet (Lv20), golden crown (Lv30) */
function Hat({ id, hat }: { id: PetId; hat: 'laurel' | 'helmet' | 'crown' }) {
  const h = HEAD[id]
  return (
    <g className={`pet-hat hat-${hat}`} transform={`translate(${h.x} ${h.y}) scale(${h.k})`}>
      {hat === 'laurel' ? (
        <>
          {[-22, -14, -6, 6, 14, 22].map((x, i) => (
            <ellipse key={i} cx={x} cy={Math.abs(x) * 0.18} rx="6" ry="3.2" fill="#3fbf6f" stroke={INK} strokeWidth={1.8} transform={`rotate(${x * 1.6} ${x} ${Math.abs(x) * 0.18})`} />
          ))}
          <circle cx="0" cy="-1" r="3" fill="#e63946" stroke={INK} strokeWidth={1.6} />
        </>
      ) : hat === 'helmet' ? (
        <>
          <path d="M-20 4 Q-20 -16 0 -16 Q20 -16 20 4 Z" fill="#c8d3e6" {...S} strokeWidth={2.5} />
          <rect x="-22" y="1" width="44" height="6" rx="2" fill="#ffd166" {...S} strokeWidth={2} />
          <path d="M-3 -16 Q0 -30 10 -24 Q4 -20 3 -16 Z" fill="#e63946" {...S} strokeWidth={2} />
        </>
      ) : (
        <>
          <path d="M-18 4 L-20 -12 L-9 -5 L0 -17 L9 -5 L20 -12 L18 4 Z" fill="#ffd166" {...S} strokeWidth={2.5} />
          <circle cx="0" cy="-2" r="3" fill="#e63946" stroke={INK} strokeWidth={1.5} />
          <circle cx="-10" cy="-1" r="2" fill="#4ad6ff" stroke={INK} strokeWidth={1.2} />
          <circle cx="10" cy="-1" r="2" fill="#4ad6ff" stroke={INK} strokeWidth={1.2} />
        </>
      )}
    </g>
  )
}

/* Cinematic reskin (2026-10-07): portrait images per pet id */
const PET_IMG: Record<PetId, string> = {
  lupa: '/images/cinematic/pet-lupa.webp',
  aquila: '/images/cinematic/pet-aquila.webp',
  leo: '/images/cinematic/pet-leo.webp',
  invictus: '/images/cinematic/pet-invictus.webp',
  nox: '/images/cinematic/pet-nox.webp',
}

export function PetArt({
  id,
  size = 96,
  locked = false,
  className = '',
  title,
  level = 1,
  stars = 0,
}: {
  id: PetId
  size?: number
  locked?: boolean
  className?: string
  title?: string
  /** 9.30-m: the buddy's level (hat at 10 / 20 / 30, a gentle sway from 15) */
  level?: number
  /** prestige stars after level 30 */
  stars?: number
}) {
  const Draw = ART[id]
  const cos = locked ? cosmeticsFor(1, 0) : cosmeticsFor(level, stars)
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => { setImgOk(true) }, [id])
  const imgSrc = PET_IMG[id]
  // Cinematic portrait; falls back to the SVG drawing if the image is missing
  if (imgOk && imgSrc) {
    return (
      <span
        className={`pet-art pet-${id} ${locked ? 'is-locked' : ''} ${className}`}
        style={{ width: size, height: size, display: 'inline-block', overflow: 'hidden', borderRadius: '50%' }}
        role="img"
        aria-label={title ?? (locked ? 'Locked buddy' : `${id} buddy`)}
        data-pet={id}
      >
        <img
          className="pet-img"
          src={imgSrc}
          alt=""
          draggable={false}
          style={locked ? { filter: 'brightness(0) opacity(0.7)' } : undefined}
          onError={() => setImgOk(false)}
        />
      </span>
    )
  }
  return (
    <svg
      className={`pet-art pet-${id} ${locked ? 'is-locked' : ''} ${cos.idle ? 'has-sway' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? (locked ? 'Locked buddy' : `${id} buddy`)}
      data-pet={id}
      data-hat={cos.hat}
    >
      <g className="pet-body">
        <Draw />
        {cos.hat !== 'none' ? <Hat id={id} hat={cos.hat} /> : null}
      </g>
      {cos.stars > 0 ? (
        <text x="50" y="99" textAnchor="middle" fontSize="11" fill="#ffd166" stroke={INK} strokeWidth={0.6} className="pet-stars">
          {'★'.repeat(cos.stars)}
        </text>
      ) : null}
    </svg>
  )
}
