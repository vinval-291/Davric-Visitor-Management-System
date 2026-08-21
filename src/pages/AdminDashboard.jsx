import AppShell, { ComingSoon } from '../components/AppShell.jsx'
import AccessProbe from '../components/AccessProbe.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function AdminDashboard() {
  const { profile } = useAuth()
  return (
    <AppShell
      title="Administration"
      subtitle={`Signed in as ${profile?.full_name}`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ComingSoon step={11}>
          Users, departments, executives and PA assignment
        </ComingSoon>
        <AccessProbe />
      </div>
    </AppShell>
  )
}
