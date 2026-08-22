import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, HOME_FOR_ROLE } from './lib/auth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Logo from './components/Logo.jsx'
import Login from './pages/Login.jsx'

/**
 * Every screen except the login is loaded on demand.
 *
 * A receptionist never opens the admin screens, and a PA never opens
 * history or reports, so shipping all of it in one bundle makes the
 * first paint slower for everyone. It matters most on the reception
 * tablet, which is the device least likely to be on fast, reliable
 * internet -- and the one that has to be ready when someone is
 * standing at the desk.
 */
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard.jsx'))
const NewVisitor = lazy(() => import('./pages/NewVisitor.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const PaDashboard = lazy(() => import('./pages/PaDashboard.jsx'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/reception"
              element={
                <ProtectedRoute allow={['receptionist', 'super_admin']}>
                  <ReceptionDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reception/new"
              element={
                <ProtectedRoute allow={['receptionist', 'super_admin']}>
                  <NewVisitor />
                </ProtectedRoute>
              }
            />

            <Route
              path="/history"
              element={
                <ProtectedRoute allow={['receptionist', 'super_admin']}>
                  <History />
                </ProtectedRoute>
              }
            />

            <Route
              path="/pa"
              element={
                <ProtectedRoute allow={['pa', 'super_admin']}>
                  <PaDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allow={['super_admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<RoleHome />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Sends each signed-in user to the dashboard their role belongs to. */
function RoleHome() {
  const { session, role, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={HOME_FOR_ROLE[role] ?? '/login'} replace />
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center bg-steel-50">
      <div className="text-center">
        <Logo size="lg" className="mx-auto opacity-90" />
        <p className="mt-6 text-sm text-steel-500">Loading…</p>
      </div>
    </div>
  )
}
