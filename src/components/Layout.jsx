import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Sticky branding header: college crest LEFT, club name CENTER (the official
// wordmark image embeds the same crest - showing both read as a duplicate logo),
// SAC crest RIGHT; simple nav row below.
export default function Layout({ children }) {
  const { session, isAdmin, signOut, isDemoMode } = useAuth()
  return (
    <div className="site-shell">
      <header className="brand-header">
        <img src="/brand/mits-crest.jpg" alt="MITS college crest" className="brand-crest" />
        <div className="brand-title">MITS Web Club</div>
        <img src="/brand/sac-crest.jpg" alt="Student Activity Center crest" className="brand-crest" />
      </header>
      <nav className="main-nav">
        <NavLink to="/" end>Home</NavLink>
        {session || isDemoMode ? (
          <>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/past-events">Past Events</NavLink>
          </>
        ) : null}
        {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        <span className="nav-spacer" />
        {session ? (
          <button className="link-btn" onClick={signOut}>Sign out</button>
        ) : (
          <NavLink to="/login">Sign in</NavLink>
        )}
      </nav>
      <main className="page">{children}</main>
      <footer className="site-footer">Built by Web Club</footer>
    </div>
  )
}
