import { useEffect, useMemo, useState } from 'react'
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
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const categories = useMemo(
    () => [...new Set((events || []).map((e) => e.category).filter(Boolean))].sort(),
    [events])
  const q = query.trim().toLowerCase()
  const rows = (events || []).filter((e) =>
    (!cat || e.category === cat) &&
    (!q || (e.title || '').toLowerCase().includes(q) || (e.short_description || '').toLowerCase().includes(q)))
  if (error) return <p className="error">Could not load events: {error}</p>
  return (
    <>
      <h1>{mode === 'current' ? 'Events' : 'Past Events'}</h1>
      {isDemoMode && <p className="demo-note">Local preview only: showing clearly-marked sample events until the club publishes real ones.</p>}
      {events && events.length > 0 && (
        <div className="events-toolbar">
          <input type="search" placeholder="Search events" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search events" />
          {categories.length > 1 && (
            <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}
      {!events && (
        <ul className="event-list" aria-label="Loading events">
          {[0, 1, 2].map((i) => (
            <li className="event-row skeleton-row" key={i} aria-hidden="true">
              <span className="sk sk-poster" /><span className="sk sk-badge" />
              <span className="sk-lines"><span className="sk sk-line" /><span className="sk sk-line short" /></span>
            </li>
          ))}
        </ul>
      )}
      {events && rows.length === 0 && (
        <p className="muted">{events.length === 0
          ? 'Nothing here yet. New events will appear once the club publishes them.'
          : 'No events match this search.'}</p>
      )}
      {events && rows.length > 0 && (
        <ul className="event-list">
          {rows.map((e) => <EventRow key={e.id} event={e} />)}
        </ul>
      )}
    </>
  )
}
