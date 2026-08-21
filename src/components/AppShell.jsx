import { NavLink } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx'
import Logo from './Logo.jsx'

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/reception', label: 'Reception' },
    { to: '/pa', label: 'Notifications' },
  ],
  receptionist: [{ to: '/reception', label: 'Reception' }],
  pa: [{ to: '/pa', label: 'Notifications' }],
}

export default function AppShell({ title, subtitle, actions, children }) {
  const { profile, role, signOut } = useAuth()
  const nav = NAV_BY_ROLE[role] ?? []

  return (
    <div className="min-h-full bg-steel-50">
      <div className="h-1.5 w-full bg-brand-500" />

      <header className="border-b border-steel-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo size="sm" />
            {nav.length > 1 && (
              <nav className="hidden items-center gap-1 sm:flex">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-steel-600 hover:bg-steel-50 hover:text-steel-900'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink">
                {profile?.full_name}
              </p>
              <p className="text-xs leading-tight text-steel-500">
                {ROLE_LABEL[role] ?? 'No role'}
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {(title || actions) && (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-steel-500">{subtitle}</p>
              )}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

/** Placeholder used by the dashboards we have not built yet. */
export function ComingSoon({ step, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-steel-300 bg-white p-10 text-center">
      <p className="text-sm font-semibold text-steel-700">{children}</p>
      <p className="mt-1 text-sm text-steel-400">Arrives in Step {step}.</p>
    </div>
  )
}
