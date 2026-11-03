import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Email OTP sign-in: enter college email, receive a 6-digit code, enter code.
// Self-signup creates a viewer account only; admin rights are seeded separately.
// Sign-in stays hidden until numeric-code email delivery is verified end to end
// (custom SMTP + template). Flip to true once that is confirmed live.
const SIGNIN_READY = true

export default function Login() {
  const { requestOtp, verifyOtp, isDemoMode, isMisconfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('email')
  const [msg, setMsg] = useState(null)
  const nav = useNavigate()
  const loc = useLocation()

  if (isDemoMode) return <p className="demo-note">Sign-in is disabled in this local preview because the backend is not connected yet.</p>
  if (isMisconfigured) return <p className="notice">Sign-in is not available yet - the site's backend has not been connected.</p>
  if (!SIGNIN_READY) return <p className="notice">Sign-in is being set up and is not available yet. Please check back soon.</p>

  const send = async (ev) => {
    ev.preventDefault()
    const { error } = await requestOtp(email.trim())
    setMsg(error ? error.message : 'Code sent. Check your email for the 6-digit sign-in code.')
    if (!error) setStage('code')
  }
  const verify = async (ev) => {
    ev.preventDefault()
    const { error } = await verifyOtp(email.trim(), code.trim())
    if (error) setMsg(error.message)
    else nav(loc.state?.from || '/events', { replace: true })
  }
  return (
    <section className="auth-box">
      <h1>Sign in</h1>
      <p className="muted">For registered MITS students and faculty. A sign-in code goes to your email - no password needed.</p>
      {stage === 'email' ? (
        <form onSubmit={send}>
          <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn" type="submit">Send code</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label>6-digit code <input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <button className="btn" type="submit">Verify and sign in</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
