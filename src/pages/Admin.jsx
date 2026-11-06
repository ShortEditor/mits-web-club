import { useCallback, useEffect, useState } from 'react'
import {
  listAllEvents, createEvent, updateEvent, slugify,
  uploadMedia, addGalleryImage, removeGalleryImage,
  getEventDocument, upsertEventDocument, listGallery, mediaUrl,
  listMembers, addMember, listRegistrations, saveAttendance,
  listAdminDirectory, addAdminByEmail, deleteEvent, duplicateEvent, updateGalleryImage,
  listFacultyDirectory, addFacultyByEmail, removeFacultyByEmail } from '../lib/api'
import { useAuth } from '../lib/auth'
import Icon from '../components/Icon'
import { downloadAttendanceSheet } from '../lib/excel'

// Admin panel: manage events, posters, gallery images and admin-only
// documentation. Every write goes through Supabase; RLS on the admins
// table is the real gate, this UI just exposes the operations.
// (Demo mode never reaches this page - the route guard requires a live session.)

const EMPTY_EVENT = {
  title: '', slug: '', short_description: '', description: '',
  event_date: '', start_time: '', end_time: '', venue: '', category: '',
  eligibility: '', rules: '', prizes: '',
  external_registration_url: '', lifecycle: 'ongoing', published: false,
}

export default function Admin() {
  const { isAdmin } = useAuth()
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

  const [tab, setTab] = useState('events')

  async function copyEvent(e) {
    setBusy(true)
    setError('')
    try {
      await duplicateEvent(e.id)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }


  async function removeEvent(e) {
    if (!window.confirm(`Delete "${e.title}"? This permanently removes the event, its photos and documents. This cannot be undone.`)) return
    setBusy(true)
    setError('')
    try {
      const res = await deleteEvent(e.id)
      if (selected && selected !== 'new' && selected.id === e.id) setSelected(null)
      await refresh()
      if (res?.orphanedFiles?.length) {
        setError(`Event deleted, but ${res.orphanedFiles.length} stored file(s) could not be removed: ${res.orphanedFiles.join(', ')}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }


  return (
    <>
      <div className="admin-hero">
        <div>
          <h1>Club Admin Dashboard</h1>
          <p>Create, edit and manage club events.</p>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      {!selected && (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'events'} className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
            <Icon name="calendar" /> Events Directory
          </button>
          {isAdmin && (
            <button type="button" role="tab" aria-selected={tab === 'admins'} className={tab === 'admins' ? 'active' : ''} onClick={() => setTab('admins')}>
              <Icon name="shield" /> Access &amp; Privileges
            </button>
          )}
        </div>
      )}
      {!selected && tab === 'admins' && isAdmin && (
        <>
          <AdminsSection />
          <FacultySection />
        </>
      )}
      {!selected && tab === 'events' && (
        <>
          <section>
            <div className="card-head"><Icon name="calendar" size={20} /><h2>Events Management</h2></div>
            <AdminStats events={events} />
            <p className="muted">All published, draft and completed events.</p>
            <AdminEventsTable events={events} onNew={() => setSelected('new')} onEdit={setSelected} onDelete={removeEvent} onDuplicate={copyEvent} busy={busy} />
          </section>
          {isAdmin && <MembersSection />}
        </>
      )}
      {selected && (
        <EventEditor
          key={selected === 'new' ? 'new' : selected.id}
          event={selected === 'new' ? null : selected}
          onDone={() => { setSelected(null); refresh() }}
          onCancel={() => setSelected(null)}
        />
      )}
    </>
  )
}

export function EventEditor({ event, onDone, onCancel }) {
  const { isAdmin } = useAuth()
  const [form, setForm] = useState(event ? { ...EMPTY_EVENT, ...event } : EMPTY_EVENT)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null) // persisted event row (for uploads)
  const [posterFile, setPosterFile] = useState(null) // poster chosen in the form, uploaded on save
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
      let finalRow = row
      if (posterFile) {
        const path = await uploadMedia('poster', row.id, posterFile)
        finalRow = await updateEvent(row.id, { poster_path: path })
        setPosterFile(null)
      }
      setSaved(finalRow)
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  const persisted = saved || event
  const persistedPoster = persisted?.poster_path

  return (
    <section className="card">
      <div className="card-head"><Icon name="edit" size={20} /><h2>{event ? `Edit: ${event.title}` : 'New event'}</h2></div>
      {error && <p className="notice">{error}</p>}
      <form onSubmit={save} className="admin-form">
        <label>Title* <input required value={form.title} onChange={set('title')} /></label>
        <label>Slug (URL) <input value={form.slug} onChange={set('slug')} placeholder="auto from title" /></label>
        <label>Event poster <input type="file" accept="image/*" onChange={(ev) => setPosterFile(ev.target.files?.[0] || null)} /></label>
        {persistedPoster && !posterFile && <p className="hint muted">A poster is already attached; it stays unless you choose a new file above.</p>}
        <label>Short description <input value={form.short_description || ''} onChange={set('short_description')} /></label>
        <label>Full description <textarea rows={4} value={form.description || ''} onChange={set('description')} /></label>
        <label>Date <input type="date" value={form.event_date || ''} onChange={set('event_date')} /></label>
        <label>Start time <input type="time" value={form.start_time || ''} onChange={set('start_time')} /></label>
        <label>End time <input type="time" value={form.end_time || ''} onChange={set('end_time')} /></label>
        <label>Venue <input value={form.venue || ''} onChange={set('venue')} /></label>
        <label>Category <input value={form.category || ''} onChange={set('category')} placeholder="Workshop, Bootcamp, ..." /></label>
        <label>Eligibility <input value={form.eligibility || ''} onChange={set('eligibility')} /></label>
        <label>Rules &amp; Guidelines <textarea rows={3} value={form.rules || ''} onChange={set('rules')} /></label>
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
          {' '}Published (unpublished events stay in the admin panel)
        </label>
        <div>
          <button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save event'}</button>
          <button type="button" onClick={onCancel}>Back</button>
        </div>
      </form>
      {persisted && (
        <p><a href={`/events/${persisted.slug}`} target="_blank" rel="noreferrer">Preview event page (opens the public view)</a></p>
      )}
      {persisted && <EventAssets event={persisted} onChanged={onDone} />}
      {persisted && <RegistrationsPanel event={persisted} />}
      {persisted && isAdmin && <DocEditor event={persisted} />}
    </section>
  )
}

function EventAssets({ event, onChanged }) {
  const { isAdmin, session } = useAuth()
  const canEdit = isAdmin || (session?.user?.id && event.created_by === session.user.id)
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
      const path = await uploadMedia(kind, event.id, file)
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


  async function move(a, b) {
    if (!b) return
    setBusy(true); setError('')
    try {
      await updateGalleryImage(a.id, { display_order: b.display_order })
      await updateGalleryImage(b.id, { display_order: a.display_order })
      await refresh()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <section className="card admin-assets">
      <div className="card-head"><Icon name="image" size={18} /><h3>Poster and gallery</h3></div>
      {error && <p className="notice">{error}</p>}
      <p>Current poster: {event.poster_path ? <code>{event.poster_path}</code> : 'none'}</p>
      {canEdit && (
        <label>Upload poster <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e, 'poster')} /></label>
      )}
      {isAdmin && (
        <label>Add gallery image <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e, 'gallery')} /></label>
      )}
      <ul className="admin-list">
        {gallery.map((g, i) => (
          <li key={g.id} className="gallery-item">
            <GalleryThumb image={g} />
            {isAdmin ? (
              <>
                <GalleryMeta image={g} onSaved={refresh} disabled={busy} />
                <span className="gallery-order">
                  <button type="button" className="icon-btn" title="Move up" disabled={busy || i === 0}
                    onClick={() => move(g, gallery[i - 1])}>&uarr;</button>
                  <button type="button" className="icon-btn" title="Move down" disabled={busy || i === gallery.length - 1}
                    onClick={() => move(g, gallery[i + 1])}>&darr;</button>
                </span>
                <button type="button" disabled={busy} onClick={() => remove(g)}>Remove</button>
              </>
            ) : (
              <span className="muted">{g.caption || g.alt_text || ''}</span>
            )}
          </li>
        ))}
      </ul>    </section>
  )
}

function GalleryThumb({ image }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { mediaUrl(image.image_path).then(setUrl) }, [image.image_path])
  return url
    ? <img src={url} alt={image.alt_text || 'Gallery image'} className="admin-thumb" />
    : <span className="muted">loading...</span>
}


// Caption + alt text editor for one gallery image (saved on demand).
function GalleryMeta({ image, onSaved, disabled }) {
  const [caption, setCaption] = useState(image.caption || '')
  const [alt, setAlt] = useState(image.alt_text || '')
  const [state, setState] = useState('')
  async function save() {
    setState('saving')
    try {
      await updateGalleryImage(image.id, { caption, alt_text: alt })
      setState('saved')
      onSaved()
    } catch { setState('error') }
  }
  return (
    <span className="gallery-meta">
      <input type="text" placeholder="Caption" value={caption} disabled={disabled}
        onChange={(e) => setCaption(e.target.value)} aria-label="Image caption" />
      <input type="text" placeholder="Alt text" value={alt} disabled={disabled}
        onChange={(e) => setAlt(e.target.value)} aria-label="Image alt text" />
      <button type="button" disabled={disabled || state === 'saving'} onClick={save}>
        {state === 'saving' ? 'Saving...' : 'Save'}
      </button>
      {state === 'error' && <span className="error">Could not save.</span>}
    </span>
  )
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
    <section className="card admin-docs">
      <div className="card-head"><Icon name="doc" size={18} /><h3>Documentation (admin-only until viewer access is opened)</h3></div>
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
        <label>
          <input type="checkbox" checked={!!d.published}
            onChange={(ev) => setDoc((cur) => ({ ...(cur || {}), published: ev.target.checked }))} />
          {' '}Documentation published (ready to share once viewer access is opened)
        </label>
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


  async function move(a, b) {
    if (!b) return
    setBusy(true); setError('')
    try {
      await updateGalleryImage(a.id, { display_order: b.display_order })
      await updateGalleryImage(b.id, { display_order: a.display_order })
      await refresh()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <section className="card admin-assets">
      <div className="card-head"><Icon name="users" size={18} /><h3>
        Registered members{' '}
        <button type="button" className="linklike" onClick={() => setOpen((o) => !o)}>
          {open ? 'hide' : 'show'}
        </button>
      </h3></div>
      {!open ? null : (
        <>
          <p className="muted">Students and faculty registered as viewers. Member registration does not grant admin access.</p>
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

// Registrations & attendance for one event (user direction 2026-11-06).
// Admins and the event-owning faculty editor see the registered students list,
// mark/edit present-absent per student, Save the changes, read the totals and
// download an Excel copy. RLS enforces the same own-event scope server-side.
function RegistrationsPanel({ event }) {
  const [rows, setRows] = useState(null)
  const [marks, setMarks] = useState({})
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const data = await listRegistrations(event.id)
      setRows(data)
      const m = {}
      for (const r of data) m[r.id] = r.attendance_status || null
      setMarks(m)
      setDirty(false)
    } catch (e) { setError(e.message) }
  }, [event.id])
  useEffect(() => { refresh() }, [refresh])

  const list = rows || []
  const present = list.filter((r) => marks[r.id] === 'present').length
  const absent = list.filter((r) => marks[r.id] === 'absent').length

  function mark(id, status) {
    setMarks((m) => ({ ...m, [id]: m[id] === status ? null : status }))
    setDirty(true)
    setOk('')
  }

  async function save() {
    setBusy(true); setError(''); setOk('')
    try {
      const changed = list
        .filter((r) => (r.attendance_status || null) !== (marks[r.id] || null))
        .map((r) => ({ id: r.id, status: marks[r.id] || null }))
      await saveAttendance(changed)
      await refresh()
      setOk('Attendance saved.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  function download() {
    const merged = list.map((r) => ({ ...r, attendance_status: marks[r.id] || null }))
    downloadAttendanceSheet(event, merged)
  }

  return (
    <section className="card admin-assets">
      <div className="card-head"><Icon name="users" size={18} /><h3>Registrations &amp; attendance ({list.length})</h3></div>
      <p className="muted">Students who registered on the event page. Mark Present or Absent, then Save attendance. Download Excel keeps a faculty copy.</p>
      {error && <p className="notice">{error}</p>}
      {ok && <p className="notice-ok">{ok}</p>}
      {rows === null ? (
        <p className="muted">Loading...</p>
      ) : list.length === 0 ? (
        <p className="muted">No registrations yet.</p>
      ) : (
        <>
          <p className="attendance-totals">
            <span>Total Present: <strong>{present}</strong></span>
            <span>Total Absent: <strong>{absent}</strong></span>
            <span className="muted">Registered: {list.length}</span>
          </p>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>College Email</th>
                  <th>Dept</th>
                  <th>Sec</th>
                  <th>Year</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>{r.roll_number}</td>
                    <td>{r.name}</td>
                    <td className="cell-muted">{r.email}</td>
                    <td className="cell-muted">{r.department || '-'}</td>
                    <td className="cell-muted">{r.section || '-'}</td>
                    <td className="cell-muted">{r.year || '-'}</td>
                    <td>
                      <span className="att-actions">
                        <button type="button" className={`att-btn ${marks[r.id] === 'present' ? 'att-on-present' : ''}`}
                          onClick={() => mark(r.id, 'present')} disabled={busy}>Present</button>
                        <button type="button" className={`att-btn ${marks[r.id] === 'absent' ? 'att-on-absent' : ''}`}
                          onClick={() => mark(r.id, 'absent')} disabled={busy}>Absent</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="att-savebar">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !dirty}>
              {busy ? 'Saving...' : 'Save attendance'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
              <Icon name="doc" size={16} /> Download Excel
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function AdminsSection() {
  const [admins, setAdmins] = useState([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try { setAdmins(await listAdminDirectory()) } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function add(ev) {
    ev.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      const res = await addAdminByEmail(email.trim())
      if (res && res.added) {
        setOk(`${email.trim()} is now an admin.`)
        setEmail('')
        await refresh()
      } else {
        setError('No account exists for that email yet. Ask them to sign in on the site once, then add them here.')
      }
    } catch (e2) {
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="card-head"><Icon name="shield" size={20} /><h2>Admins</h2></div>
      <p className="muted">Admins can manage events and grant admin access to other signed-up accounts.</p>
      {error && <p className="notice">{error}</p>}
      {ok && <p className="notice-ok">{ok}</p>}
      <ul className="admin-list">
        {admins.map((a) => (
          <li key={a.user_id}>
            <span className="item-title">{a.email}</span>
          </li>
        ))}
        {admins.length === 0 && !error && <li className="muted">Loading...</li>}
      </ul>
      <form onSubmit={add} className="admin-form" style={{ marginTop: 16 }}>
        <label>Add admin by email*
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
        </label>
        <p className="hint muted">They must have signed in on this site at least once. The change applies in the database immediately.</p>
        <button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Grant admin access'}</button>
      </form>
    </section>
  )
}


function formatAdminDate(e) {
  if (!e.event_date) return null
  const d = new Date(`${e.event_date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmt = (t) => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    const ap = h >= 12 ? 'PM' : 'AM'
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`
  }
  const start = fmt(e.start_time)
  return start ? `${date} - ${start}` : date
}

// Events table (approved admin design): full-width search, category filter,
// plain EVENT / CATEGORY / DATE AND TIME / VENUE LOCATION / ACTIONS columns.
// Row descriptions come from the event's real short_description.

// PRD dashboard: total, upcoming, published past, recent updates (30 days).
function AdminStats({ events }) {
  const now = Date.now()
  const month = 30 * 24 * 60 * 60 * 1000
  const upcoming = events.filter((e) => e.lifecycle === 'ongoing').length
  const pastPublished = events.filter((e) => e.lifecycle !== 'ongoing' && e.published).length
  const recent = events.filter((e) => e.updated_at && now - new Date(e.updated_at).getTime() < month).length
  const cards = [
    ['Total events', events.length],
    ['Upcoming', upcoming],
    ['Published past', pastPublished],
    ['Updated in 30 days', recent],
  ]
  return (
    <div className="stat-grid">
      {cards.map(([label, n]) => (
        <div className="stat-card" key={label}><strong>{n}</strong><span>{label}</span></div>
      ))}
    </div>
  )
}

export function AdminEventsTable({ events, onNew, onEdit, onDelete, onDuplicate, busy }) {
  const { isAdmin, session } = useAuth()
  const uid = session?.user?.id
  const canModify = (e) => isAdmin || (uid && e.created_by === uid)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')
  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))].sort()
  const q = query.trim().toLowerCase()
  const rows = events.filter((e) =>
    (!cat || e.category === cat) &&
    (!q || (e.title || '').toLowerCase().includes(q) || (e.short_description || '').toLowerCase().includes(q)))
  return (
    <>
      <div className="admin-toolbar">
        <div className="search-wrap">
          <Icon name="search" size={16} />
          <input type="text" placeholder="Search events" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="btn btn-primary" onClick={onNew} disabled={busy}>
          <Icon name="plus" /> New Event
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Category</th>
            <th>Date and Time</th>
            <th>Venue Location</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <div className="cell-title">{e.title}</div>
                {e.short_description && <div className="cell-sub">{e.short_description}</div>}
                <div className="cell-sub">{e.lifecycle} &middot; {e.published ? 'published' : 'draft'}</div>
              </td>
              <td>{e.category ? <span className="badge">{e.category}</span> : <span className="cell-muted">-</span>}</td>
              <td className="cell-muted">{formatAdminDate(e) || '-'}</td>
              <td className="cell-muted">{e.venue || '-'}</td>
              <td>
                <div className="row-actions">
                  {canModify(e) && (
                    <button type="button" className="icon-btn" title="Edit event" onClick={() => onEdit(e)} disabled={busy}>
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                  <button type="button" className="icon-btn" title="Duplicate as draft" onClick={() => onDuplicate(e)} disabled={busy}>
                    <Icon name="copy" size={16} />
                  </button>
                  {canModify(e) && (
                    <button type="button" className="icon-btn danger" title="Delete event" onClick={() => onDelete(e)} disabled={busy}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                  {!canModify(e) && <span className="cell-muted">managed by {e.created_by ? 'another editor' : 'admin'}</span>}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="cell-muted">
              {events.length === 0 ? 'No events yet. Create the first one.' : 'No events match this search.'}
            </td></tr>
          )}
        </tbody>
      </table>
    </>
  )
}

// Faculty editors: admins assign faculty event-management access by email
// (user direction 2026-11-03: never self-assigned at login). Faculty editors
// can create, edit and delete events; documentation stays admin-only.
function FacultySection() {
  const [editors, setEditors] = useState([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try { setEditors(await listFacultyDirectory()) } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function add(ev) {
    ev.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      const res = await addFacultyByEmail(email.trim())
      if (res && res.added) {
        setOk(`${email.trim()} can now manage events as faculty.`)
        setEmail('')
        await refresh()
      } else {
        setError('No account exists for that email yet. Ask them to sign in on the site once, then add them here.')
      }
    } catch (e2) { setError(e2.message) }
    finally { setBusy(false) }
  }

  async function remove(target) {
    if (!window.confirm(`Remove event-management access for ${target}?`)) return
    setBusy(true); setError(''); setOk('')
    try { await removeFacultyByEmail(target); await refresh() }
    catch (e2) { setError(e2.message) }
    finally { setBusy(false) }
  }

  return (
    <section className="card">
      <div className="card-head"><Icon name="users" size={20} /><h2>Faculty editors</h2></div>
      <p className="muted">Assigned faculty can create, edit and delete events and manage event photos. Documentation and access control stay admin-only.</p>
      {error && <p className="notice">{error}</p>}
      {ok && <p className="notice-ok">{ok}</p>}
      <ul className="admin-list">
        {editors.map((f) => (
          <li key={f.user_id}>
            <span className="item-title">{f.email}</span>
            {' '}<button type="button" className="linklike" disabled={busy} onClick={() => remove(f.email)}>remove</button>
          </li>
        ))}
        {editors.length === 0 && !error && <li className="muted">No faculty editors assigned yet.</li>}
      </ul>
      <form onSubmit={add} className="admin-form" style={{ marginTop: 16 }}>
        <label>Assign faculty editor by email*
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="faculty@example.com" />
        </label>
        <p className="hint muted">They must have signed in on this site at least once. The change applies in the database immediately.</p>
        <button type="submit" disabled={busy}>{busy ? 'Assigning...' : 'Assign faculty editor'}</button>
      </form>
    </section>
  )
}
