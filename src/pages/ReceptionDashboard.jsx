import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import VisitorDetail from '../components/VisitorDetail.jsx'
import DeskAlerts from '../components/DeskAlerts.jsx'
import { useVisitors } from '../lib/useVisitors.js'
import { smartTime, elapsed, isBeforeToday } from '../lib/time.js'
import { normalizePhone } from '../lib/phone.js'

const FILTERS = [
  { key: 'inside', label: 'Inside now' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'today', label: 'Arrived today' },
  { key: 'out', label: 'Left today' },
]

export default function ReceptionDashboard() {
  const { visitors, loading, error, counts, checkOut } = useVisitors()
  const [filter, setFilter] = useState('inside')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const rows = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    let list = visitors
    if (filter === 'inside') list = list.filter((v) => !v.check_out_time)
    if (filter === 'waiting')
      list = list.filter((v) => !v.admitted_at && !v.check_out_time)
    if (filter === 'today') list = list.filter((v) => v.check_in_time >= todayIso)
    if (filter === 'out')
      list = list.filter((v) => v.check_out_time && v.check_in_time >= todayIso)

    const q = query.trim().toLowerCase()
    if (!q) return list

    const digits = normalizePhone(q)
    return list.filter(
      (v) =>
        v.full_name.toLowerCase().includes(q) ||
        v.organization?.toLowerCase().includes(q) ||
        v.executive_name_snapshot?.toLowerCase().includes(q) ||
        (digits && v.phone?.includes(digits)),
    )
  }, [visitors, filter, query])

  // Keep the open dialog in step with realtime updates.
  const active = selected
    ? (visitors.find((v) => v.id === selected) ?? null)
    : null

  return (
    <AppShell
      title="Reception"
      subtitle="Live view of everyone on the premises"
      actions={
        <Link
          to="/reception/new"
          className="rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:px-6"
        >
          New Visitor
        </Link>
      }
    >
      <DeskAlerts />

      {/* Three cards, not four. "Waiting" used to sit beside "Inside"
          as though they were separate groups, but everyone waiting is
          also inside, so the figures looked like they should add up and
          did not. Waiting is now shown as part of the inside number. */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Inside now"
          value={counts.inside}
          tone={counts.inside > 0 ? 'inside' : 'plain'}
          note={
            counts.waiting > 0
              ? `includes ${counts.waiting} still waiting to go up`
              : 'nobody waiting'
          }
        />
        <Stat label="Arrived today" value={counts.today} />
        <Stat label="Left today" value={counts.out} />
      </div>

      {counts.stale > 0 && (
        <p className="mb-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <strong>
            {counts.stale} {counts.stale === 1 ? 'visitor is' : 'visitors are'}
          </strong>{' '}
          still recorded as inside from an earlier day — almost always a
          forgotten check-out, and the reason “Inside now” can exceed today’s
          arrivals. Find them under <em>Inside now</em>, marked “Not checked
          out”.
        </p>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-steel-200">
        <div className="space-y-3 border-b border-steel-200 p-3 sm:p-4">
          <div className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === f.key
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-steel-600 hover:bg-steel-50'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-xs text-steel-400">
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, host or phone"
            className="w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-base ring-1 ring-steel-300 transition placeholder:text-steel-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm"
          />
        </div>

        {error && (
          <p className="m-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-8 text-center text-steel-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-steel-400">
            {query ? 'No visitor matches that search.' : 'Nobody here right now.'}
          </p>
        ) : (
          <>
            {/* Phones and tablets: cards. A five-column table on a
                390px screen means scrolling sideways to reach the
                Check out button, which is what reception taps most. */}
            <ul className="divide-y divide-steel-100 lg:hidden">
              {rows.map((v) => (
                <VisitorCard
                  key={v.id}
                  visitor={v}
                  onOpen={() => setSelected(v.id)}
                  onCheckOut={checkOut}
                />
              ))}
            </ul>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-steel-200 text-xs uppercase tracking-wider text-steel-500">
                    <th className="px-4 py-3 font-medium">Visitor</th>
                    <th className="px-4 py-3 font-medium">Visiting</th>
                    <th className="px-4 py-3 font-medium">Arrived</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <VisitorRow
                      key={v.id}
                      visitor={v}
                      onOpen={() => setSelected(v.id)}
                      onCheckOut={checkOut}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {active && (
        <VisitorDetail
          visitor={active}
          onClose={() => setSelected(null)}
          onCheckOut={checkOut}
        />
      )}
    </AppShell>
  )
}

function useRowState(v, onCheckOut) {
  const [busy, setBusy] = useState(false)
  const gone = Boolean(v.check_out_time)
  const stale = !gone && isBeforeToday(v.check_in_time)

  async function handleCheckOut(e) {
    e.stopPropagation()
    setBusy(true)
    await onCheckOut(v.id)
    setBusy(false)
  }

  return { busy, gone, stale, handleCheckOut }
}

function VisitorCard({ visitor: v, onOpen, onCheckOut }) {
  const { busy, gone, stale, handleCheckOut } = useRowState(v, onCheckOut)

  return (
    <li
      onClick={onOpen}
      className="cursor-pointer p-4 transition active:bg-steel-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{v.full_name}</p>
          {v.organization && (
            <p className="truncate text-sm text-steel-500">{v.organization}</p>
          )}
        </div>
        <StatusPill gone={gone} admitted={Boolean(v.admitted_at)} />
      </div>

      <p className="mt-2 text-sm text-steel-600">
        Visiting{' '}
        <span className="font-medium text-steel-800">
          {v.executive_name_snapshot}
        </span>
      </p>

      <p className="mt-0.5 text-sm text-steel-500">
        <span className={stale ? 'font-medium text-brand-700' : undefined}>
          {smartTime(v.check_in_time)}
        </span>
        {' · '}
        {gone
          ? `stayed ${elapsed(v.check_in_time, v.check_out_time)}`
          : `${elapsed(v.check_in_time)} ago`}
        {stale && (
          <span className="font-medium text-brand-700"> · not checked out</span>
        )}
      </p>

      {!gone && (
        <button
          onClick={handleCheckOut}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition active:bg-steel-50 disabled:opacity-60"
        >
          {busy ? 'Checking out…' : 'Check out'}
        </button>
      )}
    </li>
  )
}

function VisitorRow({ visitor: v, onOpen, onCheckOut }) {
  const { busy, gone, stale, handleCheckOut } = useRowState(v, onCheckOut)

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-steel-100 transition last:border-0 hover:bg-steel-50"
    >
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{v.full_name}</p>
        {v.organization && (
          <p className="text-xs text-steel-500">{v.organization}</p>
        )}
      </td>
      <td className="px-4 py-3 text-steel-700">
        {v.executive_name_snapshot}
        {v.department_name_snapshot && (
          <p className="text-xs text-steel-400">{v.department_name_snapshot}</p>
        )}
      </td>
      <td className="px-4 py-3 text-steel-700">
        <span className={stale ? 'font-medium text-brand-700' : undefined}>
          {smartTime(v.check_in_time)}
        </span>
        <p className="text-xs text-steel-400">
          {gone
            ? `stayed ${elapsed(v.check_in_time, v.check_out_time)}`
            : `${elapsed(v.check_in_time)} ago`}
        </p>
      </td>
      <td className="px-4 py-3">
        <StatusPill gone={gone} admitted={Boolean(v.admitted_at)} />
        {stale && (
          <span className="mt-1 block text-xs font-medium text-brand-700">
            Not checked out
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {!gone && (
          <button
            onClick={handleCheckOut}
            disabled={busy}
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50 disabled:opacity-60"
          >
            {busy ? '…' : 'Check out'}
          </button>
        )}
      </td>
    </tr>
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${bg} ${ring} ${text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {gone ? 'Checked out' : admitted ? 'Sent up' : 'Waiting'}
    </span>
  )
}

function Stat({ label, value, tone = 'plain', note }) {
  const tones = {
    plain: 'bg-white ring-steel-200 text-ink',
    inside: 'bg-inside-50 ring-inside-500/30 text-inside-700',
  }
  return (
    <div
      className={`flex items-baseline gap-3 rounded-xl px-4 py-3 ring-1 sm:block sm:px-5 sm:py-4 ${tones[tone]}`}
    >
      {/* Side by side on a phone: three stacked cards with a huge
          numeral each pushed the visitor list below the fold. */}
      <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
        {value}
      </p>
      <div className="min-w-0">
        <p className="text-xs font-medium text-steel-500 sm:mt-0.5">
          {label}
        </p>
        {note && <p className="text-xs text-steel-400 sm:mt-1">{note}</p>}
      </div>
    </div>
  )
}
