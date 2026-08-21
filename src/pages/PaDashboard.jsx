import AppShell, { ComingSoon } from '../components/AppShell.jsx'
import AccessProbe from '../components/AccessProbe.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function PaDashboard() {
  const { profile } = useAuth()
  return (
    <AppShell
      title="Visitor notifications"
      subtitle={`Signed in as ${profile?.full_name}`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ComingSoon step={9}>
          Real-time alerts when your executive's visitor arrives
        </ComingSoon>
        <AccessProbe />
      </div>
    </AppShell>
  )
}
