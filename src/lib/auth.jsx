import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isDemoMode, isMisconfigured } from './supabase'

const AuthCtx = createContext(null)

// Auth model (per confirmed brief, updated 2026-11-03 with user approval):
// - First time: verify email with a 6-digit code, then set a password.
// - Returning: sign in with email + password, or "Continue with Google".
// - Events and gallery require sign-in. Documentation is admin-only.
// - Self-signup NEVER grants admin: admins are seeded manually in the admins table.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isFacultyEditor, setIsFacultyEditor] = useState(false)
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
    if (!supabase || !session?.user) { setIsAdmin(false); setIsFacultyEditor(false); return }
    supabase.from('admins').select('user_id').eq('user_id', session.user.id)
      .then(({ data }) => setIsAdmin((data || []).length > 0))
    supabase.from('faculty_editors').select('user_id').eq('user_id', session.user.id)
      .then(({ data }) => setIsFacultyEditor((data || []).length > 0))
  }, [session])

  const requestOtp = (email) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  const verifyOtp = (email, token) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.verifyOtp({ email, token, type: 'email' })
  const signInWithPassword = (email, password) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.signInWithPassword({ email, password })
  const setPassword = (password, fullName) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.updateUser({ password, data: { full_name: fullName } })
  // Post-login name completion (any provider, incl. Google). Display only.
  // Roles are NEVER self-declared here: faculty/admin authority is assigned
  // server-side by an existing admin (user direction 2026-11-03).
  const saveProfile = (fullName) =>
    !supabase ? Promise.resolve({ error: { message: 'Backend not connected' } }) : supabase.auth.updateUser({ data: { full_name: fullName } })
  const signInWithGoogle = () =>
    !supabase
      ? Promise.resolve({ error: { message: 'Backend not connected' } })
      : supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/events' } })
  const signOut = () => (!supabase ? Promise.resolve() : supabase.auth.signOut())

  return (
    <AuthCtx.Provider value={{ session, isAdmin, isFacultyEditor, loading, isDemoMode, isMisconfigured, requestOtp, verifyOtp, signInWithPassword, setPassword, saveProfile, signInWithGoogle, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}
export const useAuth = () => useContext(AuthCtx)
