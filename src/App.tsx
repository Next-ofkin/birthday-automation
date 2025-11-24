import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import ForgotPassword from "./pages/ForgotPassword"
import ResetPassword from "./pages/ResetPassword"
import Dashboard from "./pages/Dashboard"
import TestRLS from "./pages/TestRLS"
import DebugRLS from "./pages/DebugRLS"
import { useEffect } from "react"
import { supabase } from "./lib/supabase"
import { Layout } from "./components/Layout"
import Contacts from "./pages/Contacts"
import ContactDetail from "./pages/ContactDetail" // Add this import
import Templates from "./pages/Templates"
import BulkUpload from "./pages/BulkUpload"
import Analytics from "./pages/Analytics"
import Notifications from "./pages/Notifications"
import Settings from "./pages/Settings"
import UserManagement from "./pages/UserManagement"


// Component to handle password recovery redirect
function PasswordRecoveryHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if this is a password recovery session
    const checkRecovery = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        // Check if URL has recovery token
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const type = hashParams.get('type')

        if (type === 'recovery') {
          navigate('/reset-password', { replace: true })
        }
      }
    }

    checkRecovery()

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      }
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [navigate])

  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PasswordRecoveryHandler />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes with Layout */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <Layout>
                  <Contacts />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contacts/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ContactDetail />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <Layout>
                  <Templates />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulk-upload"
            element={
              <ProtectedRoute>
                <Layout>
                  <BulkUpload />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Protected routes without Layout (if intentional) */}
          <Route
            path="/test-rls"
            element={
              <ProtectedRoute>
                <TestRLS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/debug-rls"
            element={
              <ProtectedRoute>
                <DebugRLS />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRole={['developer', 'admin']}>
                <Layout>
                  <UserManagement />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App