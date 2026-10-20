import { useEffect, useState } from 'react'
import { markInboxRead, onSocial, respondRequest, socialSnapshot, type InboxItem } from '../social/hub'

export function InboxButton({ onOpen }: { onOpen: () => void }) {
  const [unread, setUnread] = useState(() => socialSnapshot().unread)
  useEffect(() => onSocial(() => setUnread(socialSnapshot().unread)), [])
  return (
    <button type="button" className="btn ghost btn-sm inbox-btn" data-testid="home-inbox" onClick={onOpen}>
      Inbox{unread > 0 ? <span className="inbox-badge">{unread}</span> : null}
    </button>
  )
}

export function InboxScreen({
  onBack,
  onPlay,
}: {
  onBack: () => void
  onPlay: (item: InboxItem) => void
}) {
  const [items, setItems] = useState(() => socialSnapshot().inbox)
  useEffect(() => onSocial(() => setItems(socialSnapshot().inbox)), [])
  useEffect(() => {
    const unread = items.filter((item) => !item.read).map((item) => item.id)
    if (unread.length) void markInboxRead(unread)
  }, [items])

  return (
    <main className="panel inbox-screen scroll-pane" data-testid="inbox">
      <button type="button" className="btn ghost btn-sm" onClick={onBack}>
        Home
      </button>
      <h2>Inbox</h2>
      {items.length === 0 ? <p className="sub">No messages yet.</p> : null}
      <ul className="inbox-list">
        {items.map((item) => (
          <li key={item.id} className="inbox-row">
            <p>
              <strong>{item.fromName}</strong> {item.body}
            </p>
            {item.kind === 'request' ? (
              <div className="inbox-actions">
                <button type="button" className="btn primary btn-sm" onClick={() => void respondRequest(item.id, true)}>
                  Accept
                </button>
                <button type="button" className="btn ghost btn-sm" onClick={() => void respondRequest(item.id, false)}>
                  Ignore
                </button>
              </div>
            ) : null}
            {item.kind === 'challenge' || item.kind === 'live' ? (
              <button type="button" className="btn primary btn-sm" onClick={() => onPlay(item)}>
                {item.kind === 'live' ? 'Join' : 'Play'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  )
}
