import { Link } from 'react-router-dom'
import Icon from './Icon'
import PosterImage from './PosterImage'

// One calendar-style event row: date badge, category tag, title, time + venue.
function badgeParts(iso) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return {
    dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    md: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}
function timeLine(e) {
  if (!e.start_time && !e.end_time) return null
  const fmt = (t) => {
    const [h, m] = t.split(':').map(Number)
    const ap = h >= 12 ? 'PM' : 'AM'
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
  }
  return e.end_time ? `${fmt(e.start_time)} – ${fmt(e.end_time)}` : fmt(e.start_time)
}
export default function EventRow({ event: e }) {
  const badge = badgeParts(e.event_date)
  const time = timeLine(e)
  return (
    <li className="event-row">
      <PosterImage path={e.poster_path} alt={`${e.title} poster`} className="row-poster" />
      {badge && (
        <div className="date-badge">
          <span className="dow">{badge.dow}</span>
          <span className="md">{badge.md}</span>
        </div>
      )}
      <div className="row-main">
        {e.category && <div className="tag-row"><span className="tag">{e.category}</span></div>}
        <h2><Link to={`/events/${e.slug}`}>{e.title}</Link></h2>
        <p className="event-meta">
          {time && <><Icon name="clock" /> {time}</>}
          {time && e.venue && <span>•</span>}
          {e.venue && <>{e.venue}</>}
        </p>
      </div>
      <Link className="row-action" to={`/events/${e.slug}`}>Details →</Link>
    </li>
  )
}
