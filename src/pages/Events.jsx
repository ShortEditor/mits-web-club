import { useEffect, useState } from 'react'
import { listPublishedEvents } from '../lib/api'
import { useAuth } from '../lib/auth'
import EventRow from '../components/EventRow'

// Events list. `mode` is "current" (lifecycle ongoing) or "archive"
// (completed + incomplete). The published flag is separate from lifecycle:
// unpublished events never leave the admin panel (enforced by RLS).
export default function Events({ mode = 'current' }) {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const { isDemoMode } = useAuth()
  useEffect(() => {
    listPublishedEvents()
      .then((rows) => setEvents(rows.filter((e) => (mode === 'current' ? e.lifecycle === 'ongoing' : e.lifecycle !== 'ongoing'))))
      .catch((e) => setError(e.message))
  }, [mode])
  if (error) return <p className="error">Could not load events: {error}</p>
  if (!events) return <p className="muted">Loading…</p>
  return (
    <>
      <h1>{mode === 'current' ? 'Events' : 'Past Events'}</h1>
      {isDemoMode && <p className="demo-note">Local preview only: showing clearly-marked sample events until the club publishes real ones.</p>}
      {events.length === 0 && <p className="muted">Nothing here yet. New events will appear once the club publishes them.</p>}
      <ul className="event-list">
        {events.map((e) => <EventRow key={e.id} event={e} />)}
      </ul>
    </>
  )
}
