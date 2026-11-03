import { useState } from 'react'
import { useAuth } from '../lib/auth'

// Shown after any sign-in (Google or email) while the profile is missing a
// name or role. Self-declared display info only - it grants no access and is
// never presented as verified status. Google identities keep their Google
// name as the prefilled default; no password is ever asked here.
export default function ProfileComplete() {
  const { session, saveProfile } = useAuth()
  const m = session?.user?.user_metadata || {}
  const [name, setName] = useState((m.full_name || m.name || '').trim())
  const [role, setRole] = useState('student')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (ev) => {
    ev.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await saveProfile(name.trim(), role)
    setBusy(false)
    if (error) setMsg(error.message)
  }

  return (
    <section className="card auth-card auth-box">
      <h1>Complete your profile</h1>
      <p className="muted">Tell the club who you are. This is display info only - it does not grant extra access.</p>
      <form onSubmit={save}>
        <label className="field"><span>Your name</span><input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>I am a</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="faculty">Faculty member</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
