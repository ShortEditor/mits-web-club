import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isMisconfigured } from '../lib/supabase'
import { listPublishedEvents } from '../lib/api'
import EventRow from '../components/EventRow'

// Homepage per the approved practical design: plain hero (who the club is),
// a Browse events action, and a small preview of upcoming events. Event data
// is real only; visitors who cannot see events get an honest sign-in path.
export default function Home() {
  const { session, isDemoMode } = useAuth()
  const canSeeEvents = !!session || isDemoMode
  const [events, setEvents] = useState(null)
  useEffect(() => {
    if (!canSeeEvents) return
    listPublishedEvents()
      .then((rows) => setEvents(rows.filter((e) => e.lifecycle === 'ongoing').slice(0, 3)))
      .catch(() => setEvents([]))
  }, [canSeeEvents])
  return (
    <>
      <section>
        <h1>MITS Web Club</h1>
        <p className="lead">
          The student web development club at MITS, run under the Student Activity Center.
        </p>
        <p><Link className="btn" to="/events">Browse events</Link></p>
      </section>
      <section>
        <h2 className="section-title">Upcoming Events</h2>
        {isMisconfigured ? (
          <p className="notice">This site is not connected to its backend yet - events are unavailable until sign-in is live.</p>
        ) : !canSeeEvents ? (
          <p className="muted"><Link to="/login">Sign in</Link> to view upcoming events.</p>
        ) : !events ? (
          <p className="muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="muted">Nothing here yet. New events will appear once the club publishes them.</p>
        ) : (
          <ul className="event-list">
            {events.map((e) => <EventRow key={e.id} event={e} />)}
          </ul>
        )}
      </section>
    </>
  )
}
