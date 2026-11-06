import { useEffect, useState } from 'react'
import { getMyRegistration, registerForEvent } from '../lib/api'
import { useAuth } from '../lib/auth'
import Icon from './Icon'

// Student-facing registration on the event page (user direction 2026-11-06):
// a signed-in student sees "Register Now" on an ongoing published event, fills
// roll number, name, college email, department, section and year, and later
// sees their own present/absent status here once faculty mark attendance.
const YEARS = ['1st', '2nd', '3rd', '4th']

export default function RegistrationPanel({ event }) {
  const { session, isDemoMode } = useAuth()
  const [mine, setMine] = useState(undefined) // undefined = loading
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)

  useEffect(() => {
    let live = true
    getMyRegistration(event.id)
      .then((r) => { if (live) setMine(r) })
      .catch(() => { if (live) setMine(null) })
    return () => { live = false }
  }, [event.id])

  function startForm() {
    const m = session?.user?.user_metadata || {}
    setForm({
      roll_number: '',
      name: (m.full_name || m.name || '').trim(),
      email: session?.user?.email || '',
      department: '',
      section: '',
      year: '',
    })
    setError('')
    setOpen(true)
  }

  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))

  async function submit(ev) {
    ev.preventDefault()
    setBusy(true); setError('')
    try {
      const row = await registerForEvent(event.id, {
        roll_number: form.roll_number.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department.trim(),
        section: form.section.trim(),
        year: form.year,
      })
      setMine(row)
      setOpen(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (mine === undefined) return null

  if (mine) {
    return (
      <section className="card registration-panel">
        <div className="card-head"><Icon name="users" size={18} /><h2>Your registration</h2></div>
        <p className="notice-ok">You are registered for this event.</p>
        <dl className="registration-details">
          <div><dt>Roll number</dt><dd>{mine.roll_number}</dd></div>
          <div><dt>Name</dt><dd>{mine.name}</dd></div>
          <div><dt>College email</dt><dd>{mine.email}</dd></div>
          {mine.department && <div><dt>Department</dt><dd>{mine.department}</dd></div>}
          {mine.section && <div><dt>Section</dt><dd>{mine.section}</dd></div>}
          {mine.year && <div><dt>Year</dt><dd>{mine.year}</dd></div>}
        </dl>
        <p className="attendance-line">
          Attendance:{' '}
          {mine.attendance_status === 'present' ? (
            <span className="att-badge att-present">Present</span>
          ) : mine.attendance_status === 'absent' ? (
            <span className="att-badge att-absent">Absent</span>
          ) : (
            <span className="muted">Not marked yet</span>
          )}
        </p>
      </section>
    )
  }

  if (event.lifecycle !== 'ongoing') return null

  return (
    <section className="card registration-panel">
      <div className="card-head"><Icon name="users" size={18} /><h2>Register for this event</h2></div>
      {isDemoMode && <p className="demo-note">Local preview only: registration needs the live backend.</p>}
      {error && <p className="notice">{error}</p>}
      {!open ? (
        <p>
          <button type="button" className="btn btn-primary" onClick={startForm}>
            <Icon name="plus" size={16} /> Register Now
          </button>
        </p>
      ) : (
        <form onSubmit={submit} className="admin-form">
          <label>Roll number* <input required value={form.roll_number} onChange={set('roll_number')} placeholder="e.g. 23471A05B2" /></label>
          <label>Name* <input required value={form.name} onChange={set('name')} /></label>
          <label>College email* <input type="email" required value={form.email} onChange={set('email')} /></label>
          <label>Department* <input required value={form.department} onChange={set('department')} placeholder="e.g. CSE" /></label>
          <label>Section* <input required value={form.section} onChange={set('section')} placeholder="e.g. A" /></label>
          <label>Year*{' '}
            <select required value={form.year} onChange={set('year')}>
              <option value="" disabled>Select year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div>
            <button type="submit" disabled={busy}>{busy ? 'Registering...' : 'Submit registration'}</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  )
}
