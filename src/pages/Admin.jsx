import { useCallback, useEffect, useState } from 'react'
import {
  listAllEvents, createEvent, updateEvent, slugify,
  uploadMedia, addGalleryImage, removeGalleryImage,
  getEventDocument, upsertEventDocument, listGallery, mediaUrl,
  listMembers, addMember, listParticipants, addParticipant, removeParticipant,
} from '../lib/api'

// Admin panel: manage events, posters, gallery images and admin-only
// documentation. Every write goes through Supabase; RLS on the admins
// table is the real gate, this UI just exposes the operations.
// (Demo mode never reaches this page - the route guard requires a live session.)

const EMPTY_EVENT = {
  title: '', slug: '', short_description: '', description: '',
  event_date: '', start_time: '', end_time: '', venue: '', category: '',
  eligibility: '', rules: '', guidelines: '', schedule: '', prizes: '',
  external_registration_url: '', lifecycle: 'ongoing', published: false,
}

export default function Admin() {
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)   // event row being edited, or 'new'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try {
      setEvents(await listAllEvents())
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <>
      <h1>Admin panel</h1>
      <p className="muted">
        Manage club events. Only seeded admin accounts can reach this page -
        self-signup never grants admin access.
      </p>
      {error && <p className="notice">{error}</p>}
      {!selected && <MembersSection />}
      {selected ? (
        <EventEditor
          key={selected === 'new' ? 'new' : selected.id}
          event={selected === 'new' ? null : selected}
          onDone={() => { setSelected(null); refresh() }}
          onCancel={() => setSelected(null)}
        />
      ) : (
        <>
          <button type="button" onClick={() => setSelected('new')} disabled={busy}>
            New event
          </button>
          <ul className="admin-list">
            {events.map((e) => (
              <li key={e.id}>
                <button type="button" className="linklike" onClick={() => setSelected(e)}>
                  {e.title}
                </button>
                <span className="muted">
                  {' '}- {e.lifecycle}, {e.published ? 'published' : 'draft'}
                  {e.event_date ? `, ${e.event_date}` : ''}
                </span>
              </li>
            ))}
            {events.length === 0 && <li className="muted">No events yet.</li>}
          </ul>
        </>
      )}
    </>
  )
}

function EventEditor({ event, onDone, onCancel }) {
  const [form, setForm] = useState(event ? { ...EMPTY_EVENT, ...event } : EMPTY_EVENT)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null) // persisted event row (for uploads)
  const [busy, setBusy] = useState(false)

  const set = (k) => (ev) => {
    const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(ev) {
    ev.preventDefault()
    setBusy(true); setError('')
    const fields = {
      ...form,
      slug: form.slug || slugify(form.title),
      event_date: form.event_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
    }
    delete fields.id; delete fields.created_at; delete fields.updated_at
    try {
      const row = event ? await updateEvent(event.id, fields) : await createEvent(fields)
      setSaved(row)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const persisted = saved || event

  return (
    <section>
      <h2>{event ? `Edit: ${event.title}` : 'New event'}</h2>
      {error && <p className="notice">{error}</p>}
      <form onSubmit={save} className="admin-form">
        <label>Title* <input required value={form.title} onChange={set('title')} /></label>
        <label>Slug (URL) <input value={form.slug} onChange={set('slug')} placeholder="auto from title" /></label>
        <label>Short description <input value={form.short_description || ''} onChange={set('short_description')} /></label>
        <label>Full description <textarea rows={4} value={form.description || ''} onChange={set('description')} /></label>
        <label>Date <input type="date" value={form.event_date || ''} onChange={set('event_date')} /></label>
        <label>Start time <input type="time" value={form.start_time || ''} onChange={set('start_time')} /></label>
        <label>End time <input type="time" value={form.end_time || ''} onChange={set('end_time')} /></label>
        <label>Venue <input value={form.venue || ''} onChange={set('venue')} /></label>
        <label>Category <input value={form.category || ''} onChange={set('category')} placeholder="Workshop, Bootcamp, ..." /></label>
        <label>Eligibility <input value={form.eligibility || ''} onChange={set('eligibility')} /></label>
        <label>Rules <textarea rows={3} value={form.rules || ''} onChange={set('rules')} /></label>
        <label>Guidelines <textarea rows={3} value={form.guidelines || ''} onChange={set('guidelines')} /></label>
        <label>Schedule <textarea rows={3} value={form.schedule || ''} onChange={set('schedule')} /></label>
        <label>Prizes <input value={form.prizes || ''} onChange={set('prizes')} /></label>
        <label>External registration link <input type="url" value={form.external_registration_url || ''} onChange={set('external_registration_url')} /></label>
        <label>Lifecycle{' '}
          <select value={form.lifecycle} onChange={set('lifecycle')}>
            <option value="ongoing">ongoing</option>
            <option value="completed">completed</option>
            <option value="incomplete">incomplete</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={!!form.published} onChange={set('published')} />
          {' '}Published (visible to signed-in users)
        </label>
        <div>
          <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save event'}</button>
          <button type="button" onClick={onCancel}>Back</button>
        </div>
      </form>
      {persisted && <EventAssets event={persisted} onChanged={onDone} />}
      {persisted && <ParticipantsEditor event={persisted} />}
      {persisted && <DocEditor event={persisted} />}
    </section>
  )
}

function EventAssets({ event, onChanged }) {
  const [gallery, setGallery] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try { setGallery(await listGallery(event.id)) } catch (e) { setError(e.message) }
  }, [event.id])
  useEffect(() => { refresh() }, [refresh])

  async function upload(ev, kind) {
    const file = ev.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const path = await uploadMedia('events', event.id, file)
      if (kind === 'poster') {
        await updateEvent(event.id, { poster_path: path })
      } else {
        await addGalleryImage(event.id, path, '')
      }
      await refresh()
      if (kind === 'poster') onChanged()
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
      ev.target.value = ''
    }
  }

  async function remove(image) {
    if (!window.confirm('Remove this gallery image?')) return
    setBusy(true); setError('')
    try { await removeGalleryImage(image); await refresh() } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <section className="admin-assets">
      <h3>Poster and gallery</h3>
      {error && <p className="notice">{error}</p>}
      <p>Current poster: {event.poster_path ? <code>{event.poster_path}</code> : 'none'}</p>
      <label>Upload poster <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e, 'poster')} /></label>
      <label>Add gallery image <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e, 'gallery')} /></label>
      <ul className="admin-list">
        {gallery.map((g) => (
          <li key={g.id}>
            <GalleryThumb image={g} />
            <button type="button" disabled={busy} onClick={() => remove(g)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function GalleryThumb({ image }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { mediaUrl(image.image_path).then(setUrl) }, [image.image_path])
  return url
    ? <img src={url} alt={image.alt_text || 'Gallery image'} className="admin-thumb" />
    : <span className="muted">loading...</span>
}

function DocEditor({ event }) {
  const [doc, setDoc] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const row = await getEventDocument(event.id)
      setDoc(row)
      setPdfUrl(row?.pdf_path ? await mediaUrl(row.pdf_path) : null)
      setLoaded(true)
    } catch (e) { setError(e.message) }
  }, [event.id])
  useEffect(() => { refresh() }, [refresh])

  async function saveDoc(ev) {
    ev.preventDefault()
    setBusy(true); setError('')
    const fields = { ...doc }
    delete fields.id; delete fields.event_id; delete fields.created_at; delete fields.updated_at
    try { await upsertEventDocument(event.id, fields); await refresh() } catch (e2) { setError(e2.message) }
    finally { setBusy(false) }
  }

  async function uploadPdf(ev) {
    const file = ev.target.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try {
      const path = await uploadMedia('docs', event.id, file)
      await upsertEventDocument(event.id, { pdf_path: path })
      await refresh()
    } catch (e2) { setError(e2.message) }
    finally { setBusy(false); ev.target.value = '' }
  }

  if (!loaded) return null
  const d = doc || {}
  const setD = (k) => (ev) => setDoc((cur) => ({ ...(cur || {}), [k]: ev.target.value }))

  return (
    <section className="admin-docs">
      <h3>Documentation (admin-only)</h3>
      <p className="muted">
        Visible only to admins - enforced in the database and storage policies, not just here.
      </p>
      {error && <p className="notice">{error}</p>}
      <form onSubmit={saveDoc} className="admin-form">
        <label>Objectives <textarea rows={2} value={d.objectives || ''} onChange={setD('objectives')} /></label>
        <label>Activities <textarea rows={2} value={d.activities || ''} onChange={setD('activities')} /></label>
        <label>Outcomes <textarea rows={2} value={d.outcomes || ''} onChange={setD('outcomes')} /></label>
        <label>Winners <textarea rows={2} value={d.winners || ''} onChange={setD('winners')} /></label>
        <label>Organizing team <textarea rows={2} value={d.organizing_team || ''} onChange={setD('organizing_team')} /></label>
        <label>Participation summary <textarea rows={2} value={d.participation_summary || ''} onChange={setD('participation_summary')} /></label>
        <label>Acknowledgements <textarea rows={2} value={d.acknowledgements || ''} onChange={setD('acknowledgements')} /></label>
        <label>Report write-up <textarea rows={6} value={d.report_content || ''} onChange={setD('report_content')} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save documentation'}</button>
      </form>
      <p>Report PDF: {pdfUrl ? <a href={pdfUrl} target="_blank" rel="noreferrer">view current PDF</a> : 'none'}</p>
      <label>Upload report PDF <input type="file" accept="application/pdf" disabled={busy} onChange={uploadPdf} /></label>
    </section>
  )
}

function MembersSection() {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ name: '', role: 'student', roll_number: '', department: '', section: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try { setMembers(await listMembers()) } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { if (open) refresh() }, [open, refresh])

  async function add(ev) {
    ev.preventDefault()
    setBusy(true); setError('')
    try {
      await addMember({
        name: form.name,
        role: form.role,
        roll_number: form.roll_number || null,
        department: form.department || null,
        section: form.section || null,
      })
      setForm({ name: '', role: 'student', roll_number: '', department: '', section: '' })
      await refresh()
    } catch (e2) { setError(e2.message) }
    finally { setBusy(false) }
  }

  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))

  return (
    <section className="admin-assets">
      <h3>
        Registered members{' '}
        <button type="button" className="linklike" onClick={() => setOpen((o) => !o)}>
          {open ? 'hide' : 'show'}
        </button>
      </h3>
      {!open ? null : (
        <>
          <p className="muted">
            Students and faculty registered as viewers. Registering someone here never
            grants admin; that is seeded separately in the admins table.
          </p>
          {error && <p className="notice">{error}</p>}
          <form onSubmit={add} className="admin-form">
            <label>Name* <input required value={form.name} onChange={set('name')} /></label>
            <label>Role{' '}
              <select value={form.role} onChange={set('role')}>
                <option value="student">student</option>
                <option value="faculty">faculty</option>
              </select>
            </label>
            {form.role === 'student' && (
              <label>Roll number* <input required value={form.roll_number} onChange={set('roll_number')} /></label>
            )}
            <label>Department <input value={form.department} onChange={set('department')} /></label>
            <label>Section <input value={form.section} onChange={set('section')} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Register member'}</button>
          </form>
          <ul className="admin-list">
            {members.map((m) => (
              <li key={m.id}>
                {m.name} <span className="muted">- {m.role}{m.roll_number ? `, ${m.roll_number}` : ''}{m.department ? `, ${m.department}` : ''}{m.activated ? '' : ' (not activated)'}</span>
              </li>
            ))}
            {members.length === 0 && <li className="muted">No members registered yet.</li>}
          </ul>
        </>
      )}
    </section>
  )
}

function ParticipantsEditor({ event }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ roll_number: '', name: '', department: '', section: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try { setRows(await listParticipants(event.id)) } catch (e) { setError(e.message) }
  }, [event.id])
  useEffect(() => { refresh() }, [refresh])

  async function add(ev) {
    ev.preventDefault()
    setBusy(true); setError('')
    try {
      await addParticipant(event.id, {
        roll_number: form.roll_number,
        name: form.name,
        department: form.department || null,
        section: form.section || null,
      })
      setForm({ roll_number: '', name: '', department: '', section: '' })
      await refresh()
    } catch (e2) { setError(e2.message) }
    finally { setBusy(false) }
  }

  async function remove(id) {
    if (!window.confirm('Remove this participant row?')) return
    setBusy(true); setError('')
    try { await removeParticipant(id); await refresh() } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))

  return (
    <section className="admin-assets">
      <h3>Participants ({rows.length})</h3>
      <p className="muted">Per-event registry: name, roll number, department, section. No contact details or attendance.</p>
      {error && <p className="notice">{error}</p>}
      <form onSubmit={add} className="admin-form">
        <label>Roll number* <input required value={form.roll_number} onChange={set('roll_number')} /></label>
        <label>Name* <input required value={form.name} onChange={set('name')} /></label>
        <label>Department <input value={form.department} onChange={set('department')} /></label>
        <label>Section <input value={form.section} onChange={set('section')} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add participant'}</button>
      </form>
      <ul className="admin-list">
        {rows.map((r) => (
          <li key={r.id}>
            {r.roll_number} - {r.name}
            <span className="muted">{r.department ? `, ${r.department}` : ''}{r.section ? ` ${r.section}` : ''}</span>{' '}
            <button type="button" disabled={busy} onClick={() => remove(r.id)}>Remove</button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">No participants recorded.</li>}
      </ul>
    </section>
  )
}
