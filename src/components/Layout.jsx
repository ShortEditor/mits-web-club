import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import { useAuth } from '../lib/auth'
import ProfileComplete from './ProfileComplete'

// Sticky branding header: college crest LEFT, official MITS text wordmark
// CENTER (user-supplied, text-only portion - no crest inside it), SAC crest
// RIGHT; simple nav row below.
// Name shown after login: prefer the real profile name (Google identity or the
// name collected at first-time setup). If none exists, show a neutral welcome -
// never invent a name from the email address.
function displayName(user) {
  const m = user?.user_metadata || {}
  return (m.full_name || m.name || '').trim()
}

export default function Layout({ children }) {
  const { session, isAdmin, isFacultyEditor, signOut, isDemoMode } = useAuth()
  return (
    <div className="site-shell">
      <header className="brand-header">
        <img src="/brand/mits-crest.jpg" alt="MITS college crest" className="brand-crest" />
        <img src="/brand/mits-wordmark-text.png" alt="MITS - Madanapalle Institute of Technology & Science (Deemed to be University)" className="brand-wordmark" />
        <img src="/brand/sac-crest.jpg" alt="Student Activity Center crest" className="brand-crest" />
      </header>
      <nav className="main-nav">
        <NavLink to="/" end><Icon name="home" />Home</NavLink>
        {session || isDemoMode ? (
          <>
            <NavLink to="/events"><Icon name="calendar" />Events</NavLink>
            <NavLink to="/past-events"><Icon name="clock" />Past Events</NavLink>
          </>
        ) : null}
        {(isAdmin || isFacultyEditor) && <NavLink to="/admin"><Icon name="shield" />Manage</NavLink>}
        <span className="nav-spacer" />
        {session ? (
          <button className="link-btn" onClick={signOut}>Sign out</button>
        ) : (
          <NavLink to="/login">Sign in</NavLink>
        )}
      </nav>
      {session && (
        <div className="welcome-strip"><Icon name="users" size={15} />
          Welcome{displayName(session.user) ? `, ${displayName(session.user)}` : ''}! Signed in as {session.user.email}{isAdmin ? ' · admin' : isFacultyEditor ? ' · faculty' : ''}
        </div>
      )}
      <main className="page">
        {session && !displayName(session.user) ? <ProfileComplete /> : children}
      </main>
      <footer className="footer">
        <div>&copy; Built by Web Club &middot; Madanapalle Institute of Technology and Science</div>
        <div>If you have any issues: <a href="mailto:sudarshanpeddakotla@gmail.com">sudarshanpeddakotla@gmail.com</a></div>
      </footer>
    </div>
  )
}
