import { useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import Assignments from '../components/admin/Assignments.jsx'
import Executives from '../components/admin/Executives.jsx'
import Departments from '../components/admin/Departments.jsx'
import Users from '../components/admin/Users.jsx'
import AuditLog from '../components/admin/AuditLog.jsx'
import AccessProbe from '../components/AccessProbe.jsx'

const TABS = [
  { key: 'assignments', label: 'PA assignments', render: () => <Assignments /> },
  { key: 'executives', label: 'Executives', render: () => <Executives /> },
  { key: 'departments', label: 'Departments', render: () => <Departments /> },
  { key: 'users', label: 'Users', render: () => <Users /> },
  { key: 'audit', label: 'Audit activity', render: () => <AuditLog /> },
  // Development aid only. It exposes row counts per table, which is
  // useful while building policies and noise in production.
  ...(import.meta.env.DEV
    ? [{ key: 'access', label: 'Access check', render: () => <AccessProbe /> }]
    : []),
]

export default function AdminDashboard() {
  const [tab, setTab] = useState('assignments')
  const current = TABS.find((t) => t.key === tab)

  return (
    <AppShell
      title="Administration"
      subtitle="Departments, executives, PA routing and user access"
    >
      <div className="mb-6 flex flex-wrap gap-1 border-b border-steel-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-steel-500 hover:text-steel-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current?.render()}
    </AppShell>
  )
}
