import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, HOME_FOR_ROLE } from '../lib/auth.jsx'
import Logo from './Logo.jsx'

/**
 * Gate for every authenticated route.
 *
 * This is convenience, not security. The database policies from Step 4
 * are what actually protect the data -- a determined user can edit
 * client-side JavaScript, but they cannot edit Row Level Security.
 * This exists so the right people see the right screen.
 */
export default function ProtectedRoute({ allow, children }) {
  const { session, profile, role, loading, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Signed in, but no profile row or deactivated by an admin.
  if (!profile || !profile.is_active) {
    return <NoAccess reason={profileError} />
  }

  if (allow && !allow.includes(role)) {
    return <Navigate to={HOME_FOR_ROLE[role] ?? '/login'} replace />
  }

  return children
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

function NoAccess({ reason }) {
  const { signOut, user } = useAuth()
  return (
    <div className="flex min-h-full items-center justify-center bg-steel-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-steel-200">
        <Logo size="md" className="mx-auto" />
        <h1 className="mt-6 text-lg font-semibold text-ink">
          Account not activated
        </h1>
        <p className="mt-2 text-sm text-steel-600">
          {user?.email} signed in successfully, but has no active profile in
          the Visitor Management System. Ask a system administrator to
          activate this account.
        </p>
        {reason && (
          <p className="mt-3 rounded-lg bg-steel-50 px-3 py-2 font-mono text-xs text-steel-500">
            {reason}
          </p>
        )}
        <button
          onClick={signOut}
          className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
