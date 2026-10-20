/** Notch strip for the buddy meter. Play uses the board strip; the win sheet uses the inline copy. */

export function BuddyMeterStrip({
  notches,
  goal,
  pending,
  perfect = false,
  variant,
}: {
  notches: number
  goal: number
  pending: boolean
  /** This clear just filled a notch. */
  perfect?: boolean
  variant: 'play' | 'win'
}) {
  const filled = pending ? goal : notches
  const hint =
    variant === 'win'
      ? pending
        ? 'Full!'
        : perfect
          ? 'Perfect win +1'
          : 'Perfect wins fill it'
      : pending
        ? 'Full'
        : `${filled}/${goal}`
  return (
    <div
      className={`buddy-meter ${variant === 'play' ? 'buddy-meter-inline' : 'buddy-meter-win'} ${pending ? 'is-full' : ''}`}
      aria-label={`Buddy meter ${filled} of ${goal}`}
      data-testid={variant === 'play' ? 'buddy-meter-inline' : 'buddy-meter-win'}
      data-meter={filled}
    >
      <span className="buddy-meter-label">Buddy meter</span>
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
