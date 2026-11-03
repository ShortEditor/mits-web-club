import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getEventBySlug, listGallery, mediaUrl } from '../lib/api'
import Icon from '../components/Icon'
import PosterImage from '../components/PosterImage'

// Event page: details + gallery for completed events. Media comes from private
// Storage via short-lived signed URLs, so sign-in is enforced server-side too.
export default function EventDetail() {
  const { slug } = useParams()
  const [event, setEvent] = useState(undefined)
  const [photos, setPhotos] = useState([])
  useEffect(() => {
    getEventBySlug(slug).then(async (e) => {
      setEvent(e)
      if (!e) return
      const rows = await listGallery(e.id)
      const withUrls = await Promise.all(rows.map(async (r) => ({ ...r, url: await mediaUrl(r.image_path) })))
      setPhotos(withUrls.filter((p) => p.url))
    })
  }, [slug])
  if (event === undefined) return <p className="muted">Loading…</p>
  if (!event) return <p className="muted">Event not found or not published yet.</p>
  return (
    <article>
      <PosterImage path={event.poster_path} alt={`${event.title} poster`} className="detail-poster" />
      <h1>{event.title}</h1>
      <p className="muted">
        {event.event_date && <><Icon name="calendar" /> {event.event_date} </>}
        {(event.start_time || event.end_time) && (
          <><Icon name="clock" /> {event.start_time || ''}{event.end_time ? `–${event.end_time}` : ''} </>
        )}
        {event.venue && <><Icon name="location" /> {event.venue} </>}
        {event.category && <><Icon name="tag" /> {event.category} </>}
        <span className="lifecycle-badge">{event.lifecycle}</span>
      </p>
      {event.description && <p>{event.description}</p>}
      {event.external_registration_url && (
        <p><a className="btn" href={event.external_registration_url} target="_blank" rel="noreferrer">Register <Icon name="arrow" /></a></p>
      )}
      {[['Eligibility','eligibility'],['Schedule','schedule'],['Rules','rules'],['Guidelines','guidelines'],['Prizes','prizes']]
        .filter(([, k]) => event[k])
        .map(([label, k]) => (
          <section key={k}>
            <h2>{label}</h2>
            <p className="prewrap">{event[k]}</p>
          </section>
        ))}
      {photos.length > 0 && (
        <section>
          <h2>Photos</h2>
          <div className="gallery-grid">
            {photos.map((p) => <img key={p.id} src={p.url} alt={p.caption || `${event.title} photo`} loading="lazy" />)}
          </div>
        </section>
      )}
    </article>
  )
}
