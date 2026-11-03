import { useState } from 'react'
import { useAuth } from '../lib/auth'

// Shown after any sign-in (Google or email) while the profile is missing a
// name. Display info only - it grants no access. Roles are never self-declared
// here; faculty/admin authority is assigned by an existing admin (user
// direction 2026-11-03). Google identities keep their Google name prefilled.
export default function ProfileComplete() {
  const { session, saveProfile } = useAuth()
  const m = session?.user?.user_metadata || {}
  const [name, setName] = useState((m.full_name || m.name || '').trim())
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await saveProfile(name.trim())
    setBusy(false)
    if (error) setMsg(error.message)
  }

  return (
    <section className="card auth-card auth-box">
      <h1>Complete your profile</h1>
      <p className="muted">Tell the club your name. This is display info only - access is assigned by the admins.</p>
      <form onSubmit={save}>
        <label className="field"><span>Your name</span><input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
