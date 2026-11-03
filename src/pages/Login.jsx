import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Sign-in flow (user-approved 2026-11-03):
// - Returning users: email + password, or Continue with Google.
// - First time: verify email with a 6-digit code, then set a password.
// Self-signup never grants admin; admins are seeded separately.
const GOOGLE_ENABLED = false // Google provider is configured in Supabase; keep in sync.

export default function Login() {
  const { requestOtp, verifyOtp, signInWithPassword, setPassword: saveAccountPassword, signInWithGoogle, isDemoMode, isMisconfigured } = useAuth()
  const [mode, setMode] = useState('password') // password | first-code | first-setpass
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState(null)
  const nav = useNavigate()
  const loc = useLocation()

  if (isDemoMode) return <p className="demo-note">Sign-in is disabled in this local preview because the backend is not connected yet.</p>
  if (isMisconfigured) return <p className="notice">Sign-in is not available yet - the site's backend has not been connected.</p>

  const done = () => nav(loc.state?.from || '/events', { replace: true })

  const signIn = async (ev) => {
    ev.preventDefault()
    const { error } = await signInWithPassword(email.trim(), password)
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'Wrong email or password. First time here? Verify your email with a code below.' : error.message)
    else done()
  }
  const send = async (ev) => {
    ev.preventDefault()
    const { error } = await requestOtp(email.trim())
    setMsg(error ? error.message : 'Code sent. Check your email for the 6-digit sign-in code.')
    if (!error) setMode('first-code')
  }
  const verify = async (ev) => {
    ev.preventDefault()
    const { error } = await verifyOtp(email.trim(), code.trim())
    if (error) setMsg(error.message)
    else { setMsg(null); setMode('first-setpass') }
  }
  const savePassword = async (ev) => {
    ev.preventDefault()
    if (password.length < 8) { setMsg('Password must be at least 8 characters.'); return }
    const { error } = await saveAccountPassword(password, name.trim())
    if (error) setMsg(error.message)
    else done()
  }
  const google = async () => {
    const { error } = await signInWithGoogle()
    if (error) setMsg(error.message)
  }

  return (
    <section className="auth-box">
      <h1>Sign in</h1>
      {mode === 'password' && (
        <>
          <p className="muted">For registered MITS students and faculty.</p>
          <form onSubmit={signIn}>
            <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn" type="submit">Sign in</button>
          </form>
          {GOOGLE_ENABLED && (
            <p><button className="btn btn-secondary" type="button" onClick={google}>Continue with Google</button></p>
          )}
          <p className="muted">
            First time here?{' '}
            <button className="linklike" type="button" onClick={() => { setMsg(null); setMode('first-email') }}>
              Verify your email with a code
            </button>
          </p>
        </>
      )}
      {mode === 'first-email' && (
        <>
          <p className="muted">Enter your email. We will send a 6-digit code to verify it - no password needed yet.</p>
          <form onSubmit={send}>
            <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="btn" type="submit">Send code</button>
          </form>
          <p className="muted"><button className="linklike" type="button" onClick={() => { setMsg(null); setMode('password') }}>Back to password sign-in</button></p>
        </>
      )}
      {mode === 'first-code' && (
        <>
          <p className="muted">Enter the 6-digit code we emailed to {email}.</p>
          <form onSubmit={verify}>
            <label>6-digit code <input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button className="btn" type="submit">Verify</button>
          </form>
        </>
      )}
      {mode === 'first-setpass' && (
        <>
          <p className="muted">Email verified. Set a password for future sign-ins.</p>
          <form onSubmit={savePassword}>
            <label>Your name <input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>New password (min 8 characters) <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn" type="submit">Save password and sign in</button>
          </form>
        </>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
