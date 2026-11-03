import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isMisconfigured } from '../lib/supabase'
import { listPublishedEvents, listRecentPhotos, mediaUrl } from '../lib/api'
import Icon from '../components/Icon'
import PosterImage from '../components/PosterImage'

// Homepage per the approved design direction (2026-11-03): navy gradient hero
// (who the club is + See events), poster-first cards for upcoming events, and a
// short About. Event data is real only; visitors who cannot see events get an
// honest sign-in path.
function formatDate(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function EventCard({ event: e }) {
  const date = formatDate(e.event_date)
  return (
    <li>
      <Link className="event-card" to={`/events/${e.slug}`}>
        <PosterImage path={e.poster_path} alt={`${e.title} poster`} className="card-poster" />
        <div className="card-body">
          {e.category && <span className="badge">{e.category}</span>}
          <h3>{e.title}</h3>
          <div className="card-meta">
            {date && <span><Icon name="calendar" size={14} /> {date}</span>}
            {e.venue && <span><Icon name="location" size={14} /> {e.venue}</span>}
          </div>
        </div>
      </Link>
    </li>
  )
}


// One homepage photo: signed URL from the private media bucket.
function PhotoCard({ photo }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { mediaUrl(photo.image_path).then(setUrl) }, [photo.image_path])
  if (!url) return null
  return (
    <li>
      <img src={url} alt={photo.alt_text || photo.caption || 'Event photo'} loading="lazy" />
      {photo.caption && <p className="muted">{photo.caption}</p>}
    </li>
  )
}

export default function Home() {
  const { session, isDemoMode } = useAuth()
  const canSeeEvents = !!session || isDemoMode
  const [events, setEvents] = useState(null)
  const [past, setPast] = useState(null)
  const [photos, setPhotos] = useState([])
  useEffect(() => {
    if (!canSeeEvents) return
    listPublishedEvents()
      .then((rows) => {
        setEvents(rows.filter((e) => e.lifecycle === 'ongoing').slice(0, 3))
        setPast(rows.filter((e) => e.lifecycle === 'completed').slice(0, 3))
      })
      .catch(() => { setEvents([]); setPast([]) })
    listRecentPhotos(6).then(setPhotos)
  }, [canSeeEvents])
  return (
    <>
      <section className="hero-grad">
        <h1>MITS Web Club</h1>
        <p>The student web development club at Madanapalle Institute of Technology and Science.</p>
        <div className="hero-actions">
          <Link className="btn btn-white" to="/events">See events</Link>
          <Link className="btn btn-outline" to="/past-events">View past events</Link>
          {!canSeeEvents && <Link className="btn btn-outline" to="/login">Sign in</Link>}
        </div>
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
          <ul className="cards-grid">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </ul>
        )}
      </section>
            {canSeeEvents && past && past.length > 0 && (
        <section>
          <h2 className="section-title">Recently Completed</h2>
          <ul className="card-grid">
            {past.map((e) => <EventCard key={e.id} event={e} />)}
          </ul>
        </section>
      )}
      {photos.length > 0 && (
        <section>
          <h2 className="section-title">Event Photos</h2>
          <ul className="photo-strip">
            {photos.map((p) => <PhotoCard key={p.id} photo={p} />)}
          </ul>
        </section>
      )}
<section className="about-panel">
        <h2 className="section-title">About</h2>
        <p>
          We run workshops, hackathons and hands-on sessions, and build websites
          and tools for campus.
        </p>
      </section>
    </>
  )
}
