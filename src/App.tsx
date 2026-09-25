import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ResetPassword from './pages/ResetPassword'
import { Toaster } from 'sonner'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') {
        window.location.pathname = '/reset-password'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <Router>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/reset-password" element={session ? <ResetPassword /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App
