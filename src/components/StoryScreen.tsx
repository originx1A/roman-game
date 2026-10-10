import { useRef, useState } from 'react'
import { getProgress } from '../game/storage'

export interface StoryChapter {
  id: string
  numeral: string
  title: string
  /** start time in seconds within full-story.mp4 */
  start: number
  /** end time in seconds within full-story.mp4 */
  end: number
  unlockLevels: number
  blurb: string
}

// Chapter boundaries within the combined full-story.mp4 (3:15 total)
export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1',
    numeral: 'I',
    title: 'Between the Squares',
    start: 0,
    end: 27.08,
    unlockLevels: 0,
    blurb: 'There is a world you\'ve never seen. It lives in the spaces between the squares.',
  },
  {
    id: 'ch2',
    numeral: 'II',
    title: 'The Lost Boy',
    start: 27.08,
    end: 42.17,
    unlockLevels: 5,
    blurb: 'He came as a boy, and got lost. The defenders found him.',
  },
  {
    id: 'ch3',
    numeral: 'III',
    title: 'The Five',
    start: 42.17,
    end: 93.25,
    unlockLevels: 12,
    blurb: 'Lupa, Aquila, Leo, Invictus, Nox — they raised him as one of their own.',
  },
  {
    id: 'ch4',
    numeral: 'IV',
    title: 'The Keeper',
    start: 93.25,
    end: 118.33,
    unlockLevels: 21,
    blurb: 'He earned the title Keeper. Protector of the throne.',
  },
  {
    id: 'ch5',
    numeral: 'V',
    title: 'The Law',
    start: 118.33,
    end: 144.42,
    unlockLevels: 32,
    blurb: 'Beat everything. Beat the Keeper. The throne is yours.',
  },
  {
    id: 'ch6',
    numeral: 'VI',
    title: 'The Trial',
    start: 144.42,
    end: 177.5,
    unlockLevels: 45,
    blurb: 'Players come. They tap. The world reacts.',
  },
  {
    id: 'ch7',
    numeral: 'VII',
    title: 'The Empty Throne',
    start: 177.5,
    end: 195.5,
    unlockLevels: 60,
    blurb: 'He keeps the throne. He cannot take it. The throne is still empty.',
  },
]

const FULL_VIDEO = 'story/full-story.mp4'

export function getUnlockedChapters(): number {
  try {
    const clears = getProgress().clears ?? []
    const uniqueCleared = new Set(clears.map((c) => c.puzzleId)).size
    return uniqueCleared
  } catch {
    return 0
  }
}

export function StoryScreen({ onBack, onStoryEnd }: { onBack: () => void; onStoryEnd?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [startAt, setStartAt] = useState(0)
  const [atBoundary, setAtBoundary] = useState(false)
  const [showEndCard, setShowEndCard] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const levelsBeaten = getUnlockedChapters()
  const unlockedChapters = STORY_CHAPTERS.filter((ch) => levelsBeaten >= ch.unlockLevels)
  // Furthest the player may watch = end of last unlocked chapter
  const maxTime = unlockedChapters.length > 0
    ? unlockedChapters[unlockedChapters.length - 1].end
    : 0
  const totalDuration = STORY_CHAPTERS[STORY_CHAPTERS.length - 1].end

  const startPlayback = (from: number) => {
    setStartAt(from)
    setAtBoundary(false)
    setShowEndCard(false)
    setPlaying(true)
  }

  // Exit fullscreen so overlays are visible (iOS covers them otherwise)
  const exitFullscreenForOverlay = () => {
    const v = videoRef.current
    if (!v) return
    const vie = v as unknown as { webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean }
    if (vie.webkitDisplayingFullscreen && vie.webkitExitFullscreen) {
      vie.webkitExitFullscreen()
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Clamp seeking + stop at the unlock boundary
  const handleTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setProgress(v.currentTime)
    if (v.currentTime > maxTime) {
      v.currentTime = maxTime
      v.pause()
      // Exit fullscreen so the lock overlay is visible (iOS covers it otherwise)
      exitFullscreenForOverlay()
      setAtBoundary(true)
    }
  }
  const handleSeeking = () => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime > maxTime) {
      v.currentTime = maxTime
    }
  }

  if (playing) {
    const currentChapter = [...STORY_CHAPTERS].reverse().find((ch) => startAt >= ch.start)
    return (
      <main className="panel story-player">
        <div className="story-player-top">
          <button
            type="button"
            className="hud-back"
            onClick={() => setPlaying(false)}
            aria-label="Back to chapters"
          >
            ←
          </button>
          <h2>The Story</h2>
        </div>
        {currentChapter && (
          <p className="sub story-playall-note">
            {currentChapter.numeral}. {currentChapter.title}
          </p>
        )}
        <div className="story-video-container">
          <video
            ref={videoRef}
            className="story-video"
            src={FULL_VIDEO}
            autoPlay
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onEnded={() => {
              exitFullscreenForOverlay()
              setShowEndCard(true)
              onStoryEnd?.() // 9.31-m: owner-dashboard story completion
            }}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              v.currentTime = startAt
              v.play().catch(() => {})
            }}
          />
          <button
            type="button"
            className="story-fs-btn"
            aria-label="Fullscreen"
            onClick={() => {
              const v = videoRef.current
              if (!v) return
              const vie = v as unknown as {
                webkitExitFullscreen?: () => void
                webkitDisplayingFullscreen?: boolean
                webkitEnterFullscreen?: () => void
              }
              if (vie.webkitDisplayingFullscreen && vie.webkitExitFullscreen) {
                vie.webkitExitFullscreen()
              } else if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {})
              } else {
                const req = v.requestFullscreen?.bind(v)
                  || vie.webkitEnterFullscreen?.bind(v)
                req?.()
              }
            }}
          >
            ⛶
          </button>
        </div>
        {atBoundary && (
          <div className="story-boundary-overlay">
            <div className="story-boundary-card">
              <span className="story-boundary-lock">🔒</span>
              <h3>That's as far as you've earned!</h3>
              <p>
                The rest of the story is still locked. Nothing's broken —
                you just need to keep playing.
              </p>
              <p className="sub">
                Beat {unlockedChapters.length < STORY_CHAPTERS.length
                  ? STORY_CHAPTERS[unlockedChapters.length].unlockLevels - levelsBeaten
                  : 0} more level{unlockedChapters.length < STORY_CHAPTERS.length
                  && STORY_CHAPTERS[unlockedChapters.length].unlockLevels - levelsBeaten !== 1 ? 's' : ''} to
                unlock "{unlockedChapters.length < STORY_CHAPTERS.length
                  ? STORY_CHAPTERS[unlockedChapters.length].title
                  : ''}".
              </p>
              <button type="button" className="btn primary" onClick={() => setPlaying(false)}>
                Back to chapters
              </button>
            </div>
          </div>
        )}
        {showEndCard && !atBoundary && (
          <div className="story-boundary-overlay">
            <div className="story-boundary-card">
              <span className="story-boundary-lock">▶️</span>
              <h3>The story continues…</h3>
              <p>
                Subscribe on YouTube for more lore — new chapters, trailers,
                and behind-the-scenes from the world of Roman&rsquo;s Game.
              </p>
              <a
                className="btn primary yt-btn"
                href="https://www.youtube.com/@RomansGameOG"
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶️ Subscribe on YouTube
              </a>
              <p className="sub" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setPlaying(false)}
                >
                  Back to chapters
                </button>
              </p>
            </div>
          </div>
        )}
        {/* Progress bar: gold = watched, grey = unlocked but unwatched, dark = locked */}
        <div className="story-progress-track" aria-hidden="true">
          <div
            className="story-progress-unlocked"
            style={{ width: `${(maxTime / totalDuration) * 100}%` }}
          />
          <div
            className="story-progress-watched"
            style={{ width: `${Math.min(progress, maxTime) / totalDuration * 100}%` }}
          />
          {STORY_CHAPTERS.map((ch) => (
            <span
              key={ch.id}
              className={`story-progress-marker${levelsBeaten >= ch.unlockLevels ? '' : ' is-locked'}`}
              style={{ left: `${(ch.start / totalDuration) * 100}%` }}
              title={ch.title}
            />
          ))}
        </div>
        <p className="sub story-progress-label">
          {unlockedChapters.length} of {STORY_CHAPTERS.length} chapters unlocked
        </p>
      </main>
    )
  }

  return (
    <main className="panel scroll-pane story-panel">
      <div className="story-top">
        <button type="button" className="hud-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>The Story</h2>
      </div>
      <p className="sub story-sub">
        The legend of the Keeper. Beat levels to unlock each chapter.
      </p>
      {unlockedChapters.length > 1 && (
        <button type="button" className="btn primary story-playall-btn" onClick={() => startPlayback(0)}>
          ▶ Play Full Story ({unlockedChapters.length} of {STORY_CHAPTERS.length} chapters)
        </button>
      )}
      <div className="story-chapters">
        {STORY_CHAPTERS.map((ch) => {
          const unlocked = levelsBeaten >= ch.unlockLevels
          return (
            <button
              key={ch.id}
              type="button"
              className={`story-chapter${unlocked ? '' : ' is-locked'}`}
              onClick={() => unlocked && startPlayback(ch.start)}
              disabled={!unlocked}
              aria-label={
                unlocked
                  ? `Watch chapter ${ch.numeral}: ${ch.title}`
                  : `Chapter ${ch.numeral} locked — beat ${ch.unlockLevels} levels`
              }
            >
              <span className="story-chapter-numeral">{ch.numeral}</span>
              <span className="story-chapter-info">
                <span className="story-chapter-title">{ch.title}</span>
                <span className="story-chapter-blurb">{ch.blurb}</span>
                {!unlocked && (
                  <span className="story-chapter-lock">
                    🔒 Beat {ch.unlockLevels} levels to unlock
                  </span>
                )}
              </span>
              {unlocked && <span className="story-chapter-play">▶</span>}
            </button>
          )
        })}
      </div>
    </main>
  )
}
