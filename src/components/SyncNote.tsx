import { useEffect, useState } from 'react'
import { onSocial, socialSnapshot } from '../social/hub'

/** Tiny line while writes are still on this device. */
export function SyncNote() {
  const [pending, setPending] = useState(() => socialSnapshot().pendingWrites)
  useEffect(() => onSocial(() => setPending(socialSnapshot().pendingWrites)), [])
  if (pending < 1) return null
  return (
    <p className="sync-note" data-testid="sync-note">
      Saved on this device, will sync
    </p>
  )
}
