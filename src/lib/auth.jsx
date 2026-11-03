import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isDemoMode, isMisconfigured } from './supabase'

const AuthCtx = createContext(null)

// Auth model (per confirmed brief):
// - Users create their own account, then sign in with an OTP (email OTP planned;
//   phone SMS OTP ruled out on cost - paid provider + India TRAI DLT).
// - Events and gallery require sign-in. Documentation is admin-only.
// - Self-signup NEVER grants admin: admins are seeded manually in the admins table.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) { setIsAdmin(false); return }
    supabase.from('admins').select('user_id').eq('user_id', session.user.id)
      .then(({ data }) => setIsAdmin((data || []).length > 0))
  }, [session])

  // Email OTP: Supabase emails a 6-digit code (needs custom SMTP in production).
  const requestOtp = (email) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  const verifyOtp = (email, token) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.verifyOtp({ email, token, type: 'email' })
  const signOut = () => (!supabase ? Promise.resolve() : supabase.auth.signOut())

  return (
    <AuthCtx.Provider value={{ session, isAdmin, loading, isDemoMode, isMisconfigured, requestOtp, verifyOtp, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}
export const useAuth = () => useContext(AuthCtx)
