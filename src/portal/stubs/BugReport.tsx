import { Atmosphere } from '../../components/Atmosphere'

/** Portal stand-in: nothing is sent to an API. */
export function BugReport({ onBack }: { currentScreen: string; onBack: () => void }) {
  return (
    <main className="page bug-report fit-screen has-atmo">
      <Atmosphere variant="panel" tint="#ff9a3c" />
      <h1>Report a bug</h1>
      <p>This copy keeps progress on this device and does not send reports.</p>
      <button type="button" className="btn ghost" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
