import { WinScreen } from './components/WinScreen'

/** Temporary stub — full App.tsx is assembled by scripts/inflate-win-payload.mjs */
export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', color: '#f4fbff', background: '#07122a', minHeight: '100vh' }}>
      <h1>Roman</h1>
      <p>Source payloads are on this branch. Run <code>node scripts/inflate-win-payload.mjs</code> after all chunks land, or wait for the inflate workflow.</p>
      <WinScreen
        puzzleName="Loading"
        difficultyLabel="—"
        themeLabel="—"
        timeLabel="0:00"
        score={0}
        hintsUsed={0}
        livesLeft={3}
        maxLives={3}
        sparkCount={0}
        romanSaying="Roman says: payloads incoming."
        spins={0}
        perfect={false}
        onNext={() => {}}
        onReplay={() => {}}
        onLevels={() => {}}
        onHome={() => {}}
      />
    </div>
  )
}
