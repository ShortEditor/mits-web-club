import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Privacy from './pages/Privacy'
import { AuthProvider } from './lib/auth'
import Layout from './components/Layout'
import { RequireAuth, RequireEditor } from './components/Guards'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Login from './pages/Login'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/events" element={<RequireAuth><Events mode="current" /></RequireAuth>} />
            <Route path="/past-events" element={<RequireAuth><Events mode="archive" /></RequireAuth>} />
            <Route path="/events/:slug" element={<RequireAuth><EventDetail /></RequireAuth>} />
            <Route path="/admin" element={<RequireEditor><Admin /></RequireEditor>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
