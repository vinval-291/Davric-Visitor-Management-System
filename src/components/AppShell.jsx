import { useCallback, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx'
import { useIdleTimeout } from '../lib/useIdleTimeout.js'
import NotificationSettings from './NotificationSettings.jsx'
import { OfflineBar, UpdateBar, InstallButton } from './AppStatusBars.jsx'
import Logo from './Logo.jsx'

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/reception', label: 'Reception' },
    { to: '/history', label: 'History' },
    { to: '/pa', label: 'Notifications' },
  ],
  receptionist: [
    { to: '/reception', label: 'Reception' },
    { to: '/history', label: 'History' },
  ],
  pa: [{ to: '/pa', label: 'Notifications' }],
}

const linkClass = ({ isActive }) =>
  `shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-steel-600 hover:bg-steel-50 hover:text-steel-900'
  }`

export default function AppShell({ title, subtitle, actions, children }) {
  const { profile, role, signOut } = useAuth()
  const nav = NAV_BY_ROLE[role] ?? []

  const handleTimeout = useCallback(() => signOut(), [signOut])
  const { secondsLeft } = useIdleTimeout(handleTimeout)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-full bg-steel-50">
      <div className="h-1.5 w-full bg-brand-500" />
      <OfflineBar />
      <UpdateBar />

      {secondsLeft !== null && (
        <div
          role="alert"
          className="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white"
        >
          Signing out in {secondsLeft}s for security — touch the screen to stay
          signed in
        </div>
      )}

      <header className="border-b border-steel-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Logo size="sm" />

            {/* Wide screens: navigation sits beside the logo. */}
            {nav.length > 1 && (
              <nav className="hidden items-center gap-1 md:flex">
                {nav.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Installing matters most on a phone, so this must not be
                hidden on small screens. */}
            <InstallButton />
            <button
              onClick={() => setSettingsOpen(true)}
              title="Alert settings"
              aria-label="Alert settings"
              className="rounded-lg bg-white px-3 py-2 text-base leading-none text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
            >
              🔔
            </button>
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium leading-tight text-ink">
                {profile?.full_name}
              </p>
              <p className="text-xs leading-tight text-steel-500">
                {ROLE_LABEL[role] ?? 'No role'}
              </p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Phones and portrait tablets: navigation gets its own row.
            It scrolls sideways rather than wrapping, so the header
            keeps a predictable height however many links a role has. */}
        {nav.length > 1 && (
          <nav className="flex gap-1 overflow-x-auto border-t border-steel-100 px-3 py-2 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {(title || actions) && (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {title && (
                <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
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

      {settingsOpen && (
        <NotificationSettings onClose={() => setSettingsOpen(false)} />
      )}
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
