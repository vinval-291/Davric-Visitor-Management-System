import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, HOME_FOR_ROLE } from './lib/auth.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import ReceptionDashboard from './pages/ReceptionDashboard.jsx'
import NewVisitor from './pages/NewVisitor.jsx'
import History from './pages/History.jsx'
import PaDashboard from './pages/PaDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  )
}

/** Sends each signed-in user to the dashboard their role belongs to. */
function RoleHome() {
  const { session, role, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={HOME_FOR_ROLE[role] ?? '/login'} replace />
}
