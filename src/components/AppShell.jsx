import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx'
import { useIdleTimeout } from '../lib/useIdleTimeout.js'
import NotificationSettings from './NotificationSettings.jsx'
import AlertSetupGuide from './AlertSetupGuide.jsx'
import AccountDialog from './AccountDialog.jsx'
import { getPushState, pushSupported, pushConfigured } from '../lib/push.js'
import { OfflineBar, UpdateBar, InstallButton } from './AppStatusBars.jsx'
import Logo from './Logo.jsx'

const NAV_BY_ROLE = {
  super_admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/reception', label: 'Reception' },
    { to: '/history', label: 'History' },
    { to: '/arrivals', label: 'Arrivals' },
  ],
  receptionist: [
    { to: '/reception', label: 'Reception' },
    { to: '/history', label: 'History' },
  ],
  pa: [{ to: '/arrivals', label: 'Arrivals' }],
  executive: [{ to: '/arrivals', label: 'Arrivals' }],
}

const SETUP_SEEN = 'vms.setup.seen'
const SETUP_SNOOZED = 'vms.setup.snoozed'

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
  const [guideOpen, setGuideOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [pushState, setPushState] = useState('checking')
  const [dismissed, setDismissed] = useState(
    () => Number(localStorage.getItem(SETUP_SNOOZED) || 0) > Date.now(),
  )

  useEffect(() => {
    if (!pushSupported() || !pushConfigured) return
    getPushState().then((state) => {
      setPushState(state)
      // Open the guide unprompted the first time someone signs in on
      // a device that cannot yet receive alerts. After that it is
      // theirs to reopen: nobody wants a dialog every morning.
      if (state !== 'on' && !localStorage.getItem(SETUP_SEEN)) {
        localStorage.setItem(SETUP_SEEN, '1')
        setGuideOpen(true)
      }
    })
  }, [guideOpen])

  function snooze() {
    // A week: long enough not to nag, short enough that somebody who
    // meant to do it later is reminded before the pilot ends.
    localStorage.setItem(SETUP_SNOOZED, String(Date.now() + 7 * 864e5))
    setDismissed(true)
  }

  const needsSetup =
    pushSupported() &&
    pushConfigured &&
    pushState !== 'on' &&
    pushState !== 'checking'

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
            {/* Name, role, password and sign-out all live behind one
                control. On a phone the header has no room to show
                them, and a password change needs somewhere to live
                that is not the alert settings. */}
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-left ring-1 ring-steel-300 transition hover:bg-steel-50"
            >
              <span className="text-base leading-none" aria-hidden="true">
                &#128100;
              </span>
              <span className="hidden lg:block">
                <span className="block text-sm font-medium leading-tight text-ink">
                  {profile?.full_name}
                </span>
                <span className="block text-xs leading-tight text-steel-500">
                  {ROLE_LABEL[role] ?? 'No role'}
                </span>
              </span>
              <span className="sr-only">Your account</span>
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
        {needsSetup && !dismissed && (
          <div className="mb-6 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200 sm:flex sm:items-center sm:gap-5 sm:p-5">
            <div className="flex gap-3 sm:flex-1">
              <span
                className="text-xl leading-none sm:text-2xl"
                aria-hidden="true"
              >
                &#128276;
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-balance font-medium text-brand-700">
                  Alerts are not switched on for this device
                </p>
                <p className="mt-1 text-sm text-steel-600">
                  You will not be told about a visitor unless the app is
                  open in front of you. Setting it up takes about a minute.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 sm:mt-0 sm:shrink-0">
              <button
                onClick={() => setGuideOpen(true)}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:flex-none"
              >
                Set up alerts
              </button>
              <button
                onClick={snooze}
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50 sm:flex-none"
              >
                Not now
              </button>
            </div>
          </div>
        )}
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
        <NotificationSettings
          onClose={() => setSettingsOpen(false)}
          onOpenGuide={() => {
            setSettingsOpen(false)
            setGuideOpen(true)
          }}
        />
      )}

      {guideOpen && <AlertSetupGuide onClose={() => setGuideOpen(false)} />}

      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
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
