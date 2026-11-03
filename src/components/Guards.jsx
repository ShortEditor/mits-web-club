import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isMisconfigured } from '../lib/supabase'

// Route guards. The real enforcement is Postgres RLS + private Storage on the
// backend; these guards only keep the UI honest. Per the confirmed brief:
// events + gallery need a signed-in registered student/faculty viewer;
// documentation and the admin panel are admin-only.
export function RequireAuth({ children }) {
  const { session, loading, isDemoMode } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="muted">Loading…</p>
  // A production build with no backend must NOT fall back to open access.
  if (isMisconfigured) {
    return <p className="notice">This site is not connected to its backend yet - events are unavailable until sign-in is live.</p>
  }
  if (!session && !isDemoMode) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return children
}

export function RequireAdmin({ children }) {
  const { session, isAdmin, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="muted">Loading…</p>
  if (isMisconfigured) {
    return <p className="notice">This site is not connected to its backend yet.</p>
  }
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!isAdmin) return <p className="muted">This area is limited to Web Club admins.</p>
  return children
}

// Event management area: admins and admin-assigned faculty editors only.
export function RequireEditor({ children }) {
  const { session, isAdmin, isFacultyEditor, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <p className="muted">Loading…</p>
  if (isMisconfigured) {
    return <p className="notice">This site is not connected to its backend yet.</p>
  }
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!isAdmin && !isFacultyEditor) return <p className="muted">This area is limited to Web Club admins and assigned faculty editors.</p>
  return children
}
