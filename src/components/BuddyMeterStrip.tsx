/** Notches for the buddy meter, drawn inside the victory card's stats. */

export function BuddyMeterStrip({
  notches,
  goal,
  pending,
  perfect = false,
}: {
  notches: number
  goal: number
  pending: boolean
  /** This clear just filled a notch. */
  perfect?: boolean
}) {
  const filled = pending ? goal : notches
  const hint = pending ? 'Full!' : perfect ? 'Perfect win +1' : 'Perfect wins fill it'
  return (
    <div
      className={`buddy-meter buddy-meter-win ${pending ? 'is-full' : ''}`}
      aria-label={`Buddy meter ${filled} of ${goal}`}
      data-testid="buddy-meter-win"
      data-meter={filled}
    >
      <span className="buddy-meter-notches" aria-hidden="true">
        {Array.from({ length: goal }, (_, i) => (
          <i
            key={i}
            className={
              pending || i < notches
                ? `on ${perfect && (pending ? i === goal - 1 : i === notches - 1) ? 'new' : ''}`
                : ''
            }
          />
        ))}
      </span>
      <span className="buddy-meter-hint">{hint}</span>
    </div>
  )
}
