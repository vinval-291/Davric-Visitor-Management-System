import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import { useNotifications } from '../lib/useNotifications.js'
import { clockTime, elapsed } from '../lib/time.js'
import { playAlert, systemNotify, unlockAudio, loadSettings } from '../lib/sound.js'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'

/**
 * Arrivals.
 *
 * Shared by PAs and by executives who have no PA covering them. The
 * mechanics are identical -- see the alert, send the visitor up -- so
 * the screen is one component and only the wording changes.
 */
export default function PaDashboard() {
  const { role, user } = useAuth()
  const isExecutive = role === 'executive'

  // An executive account is useless until an administrator links it to
  // an executive record; without that nothing routes to them and the
  // screen would just sit empty with no explanation.
  const [linked, setLinked] = useState(isExecutive ? null : true)
  useEffect(() => {
    if (!isExecutive || !user?.id) return
    let active = true
    supabase
      .from('executives')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => active && setLinked(Boolean(data)))
    return () => {
      active = false
    }
  }, [isExecutive, user?.id])

  // Re-render on a timer so "waiting 4 min" stays honest without a
  // refresh. Cheap: it only touches this component.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(unlockAudio, [])

  const onArrival = useCallback((notification) => {
    playAlert()
    const v = notification?.visitor
    systemNotify({
      title: 'Visitor has arrived',
      url: '/arrivals',
      body: v
        ? `${v.full_name}${v.organization ? ` (${v.organization})` : ''} is here to see ${v.executive_name_snapshot}`
        : notification?.message,
      tag: notification?.id,
    })
  }, [])

  const { items, loading, error, unread, waiting, markRead, admit } =
    useNotifications({ onArrival })

  // Sound again at the chosen interval while anyone is still waiting
  // downstairs. A PA on a call misses the first alert easily, and the
  // visitor has no way of knowing whether anybody was told.
  useEffect(() => {
    const { repeatSeconds } = loadSettings()
    if (!repeatSeconds || waiting === 0) return
    const id = setInterval(() => playAlert(), repeatSeconds * 1000)
    return () => clearInterval(id)
  }, [waiting])

  return (
    <AppShell
      title={isExecutive ? 'Your visitors' : 'Visitor notifications'}
      subtitle={
        isExecutive
          ? 'Anyone arriving to see you appears here the moment reception registers them'
          : 'Alerts appear here the moment a visitor is registered at reception'
      }
    >
      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <Stat label="Waiting in reception" value={waiting} accent={waiting > 0} />
        <Stat label="Unread alerts" value={unread} />
        <Stat label="Total alerts" value={items.length} />
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          {error}
        </p>
      )}

      {linked === false ? (
        <NotLinked />
      ) : loading ? (
        <p className="text-steel-400">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState isExecutive={isExecutive} />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <AlertCard
              key={n.id}
              notification={n}
              onRead={() => markRead(n.id)}
              onAdmit={() => admit(n.visitor_id)}
            />
          ))}
        </ul>
      )}
    </AppShell>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={`rounded-xl px-3 py-3 ring-1 sm:px-5 ${
        accent
          ? 'bg-brand-50 ring-brand-200'
          : 'bg-white ring-steel-200'
      }`}
    >
      <p
        className={`text-2xl font-semibold tabular-nums ${
          accent ? 'text-brand-700' : 'text-ink'
        }`}
      >
        {value}
      </p>
      <p className="text-xs font-medium leading-tight text-steel-500">
        {label}
      </p>
    </div>
  )
}

function AlertCard({ notification, onRead, onAdmit }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const v = notification.visitor

  // The visitor row is hidden by RLS if this PA is not assigned to the
  // executive. Should not happen, but never render a broken card.
  if (!v) return null

  const gone = Boolean(v.check_out_time)
  const admitted = Boolean(v.admitted_at)
  const unread = !notification.is_read

  async function handleAdmit() {
    setBusy(true)
    setFailed(await onAdmit())
    setBusy(false)
    if (unread) onRead()
  }

  return (
    <li
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition ${
        unread ? 'ring-brand-300' : 'ring-steel-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {unread && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            )}
            <h3 className="text-lg font-semibold text-ink">{v.full_name}</h3>
            {v.organization && (
              <span className="text-sm text-steel-500">· {v.organization}</span>
            )}
          </div>

          <p className="mt-1 text-sm text-steel-600">
            Here to see{' '}
            <span className="font-medium text-steel-800">
              {v.executive_name_snapshot}
            </span>
            {v.department_name_snapshot && ` · ${v.department_name_snapshot}`}
          </p>

          {v.purpose && (
            <p className="mt-1 text-sm text-steel-500">{v.purpose}</p>
          )}

          <p className="mt-2 text-sm text-steel-500">
            Arrived {clockTime(v.check_in_time)}
            {!admitted && !gone && (
              <span className="font-medium text-brand-700">
                {' '}
                · waiting {elapsed(v.check_in_time)}
              </span>
            )}
            {admitted && (
              <span>
                {' '}
                · sent up {clockTime(v.admitted_at)} (waited{' '}
                {elapsed(v.check_in_time, v.admitted_at)})
              </span>
            )}
          </p>
        </div>

        <StatusPill gone={gone} admitted={admitted} />
      </div>

      {failed && (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {failed}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!admitted && !gone && (
          <button
            onClick={handleAdmit}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Sending up…' : 'Send up'}
          </button>
        )}
        {unread && (
          <button
            onClick={onRead}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
          >
            Mark as read
          </button>
        )}
      </div>
    </li>
  )
}

function StatusPill({ gone, admitted }) {
  const [bg, ring, dot, text] = gone
    ? ['bg-gone-50', 'ring-gone-500/30', 'bg-gone-500', 'text-gone-700']
    : admitted
      ? ['bg-inside-50', 'ring-inside-500/30', 'bg-inside-500', 'text-inside-700']
      : ['bg-brand-50', 'ring-brand-200', 'bg-brand-500', 'text-brand-700']

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ${bg} ${ring} ${text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {gone ? 'Checked out' : admitted ? 'Sent up' : 'Waiting'}
    </span>
  )
}

function EmptyState({ isExecutive }) {
  return (
    <div className="rounded-2xl border border-dashed border-steel-300 bg-white p-12 text-center">
      <p className="text-sm font-semibold text-steel-700">No visitors yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-steel-400">
        {isExecutive
          ? 'When reception registers someone here to see you, the alert appears immediately — no need to refresh.'
          : 'When reception registers a visitor for an executive you cover, the alert appears here immediately — no need to refresh.'}
      </p>
    </div>
  )
}

function NotLinked() {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-brand-200">
      <p className="font-semibold text-ink">Your account is not linked yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-steel-600">
        You are signed in as an executive, but this account has not been
        connected to your entry in the staff list — so arrivals for you have
        nowhere to go.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-steel-500">
        Ask an administrator to open <strong>Admin → Executives</strong>, find
        your name, and set <strong>Own login</strong> to this account.
      </p>
    </div>
  )
}
