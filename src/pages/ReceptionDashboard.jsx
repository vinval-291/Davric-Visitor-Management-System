import { Link } from 'react-router-dom'
import AppShell, { ComingSoon } from '../components/AppShell.jsx'
import AccessProbe from '../components/AccessProbe.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function ReceptionDashboard() {
  const { profile } = useAuth()

  return (
    <AppShell
      title="Reception"
      subtitle={`Signed in as ${profile?.full_name}`}
      actions={
        <Link
          to="/reception/new"
          className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          New Visitor
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ComingSoon step={10}>
          Live visitor counts, active visitor table and check-out
        </ComingSoon>
        <AccessProbe />
      </div>
    </AppShell>
  )
}
