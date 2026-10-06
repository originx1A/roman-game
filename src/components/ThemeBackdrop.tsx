/** Reconstructed from roman-game.surge.sh production JS. */
import type { ThemeId } from '../game/themes'

export function ThemeBackdrop({ themeId }: { themeId: ThemeId }) {
  return (
    <div className={`theme-backdrop tb-${themeId}`} aria-hidden>
      <span className="tb-orb a" />
      <span className="tb-orb b" />
      <span className="tb-orb c" />
      <span className="tb-spark s1" />
      <span className="tb-spark s2" />
      <span className="tb-spark s3" />
      <span className="tb-spark s4" />
      <span className="tb-motif" />
    </div>
  )
}
