import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { dateTime } from '../../lib/time.js'
import { toCsv, downloadCsv } from '../../lib/csv.js'
import { Panel, ErrorNote, Button, inputClass } from './ui.jsx'

const PAGE = 60

const GROUPS = [
  { key: '', label: 'Everything' },
  { key: 'visitor.', label: 'Visits' },
  { key: 'user.', label: 'User access' },
  { key: 'pa.', label: 'PA routing' },
  { key: 'executive.', label: 'Executives' },
]

const TONE = {
  'visitor.check_in': 'bg-inside-50 text-inside-700 ring-inside-500/30',
  'visitor.admitted': 'bg-inside-50 text-inside-700 ring-inside-500/30',
  'visitor.check_out': 'bg-gone-50 text-gone-700 ring-gone-500/30',
  'visitor.amended': 'bg-brand-50 text-brand-700 ring-brand-200',
  'visitor.deleted': 'bg-brand-50 text-brand-700 ring-brand-200',
  'user.role_changed': 'bg-brand-50 text-brand-700 ring-brand-200',
  'user.deactivated': 'bg-brand-50 text-brand-700 ring-brand-200',
}

export default function AuditLog() {
  const [rows, setRows] = useState([])
  const [actors, setActors] = useState({})
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, details, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (group) query = query.like('action', `${group}%`)

    const { data, error, count } = await query
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setError(null)
    setRows(data ?? [])
    setCount(count ?? 0)

    // Resolve actor names in one extra query rather than a join, so a
    // deleted user does not drop the audit row from the results.
    const ids = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))]
    if (ids.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids)
      setActors(
        Object.fromEntries(
          (people ?? []).map((p) => [p.id, p.full_name || p.email]),
        ),
      )
    }
    setLoading(false)
  }, [group, page])

  useEffect(() => {
    load()
  }, [load])

  function exportCsv() {
    downloadCsv(
      `davric-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          { label: 'When', value: (r) => dateTime(r.created_at) },
          { label: 'Action', value: (r) => r.action },
          { label: 'By', value: (r) => actorName(r, actors) },
          { label: 'Detail', value: (r) => summarise(r) },
        ],
        rows,
      ),
    )
  }

  const pages = Math.ceil(count / PAGE)

  return (
    <Panel
      title="Audit activity"
      description="Every check-in, admission, check-out, role change and PA reassignment. Written by database triggers, so an action cannot happen without appearing here — and the table has no update or delete policy, so entries cannot be edited away."
    >
      <ErrorNote message={error} onDismiss={() => setError(null)} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => {
                setGroup(g.key)
                setPage(0)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                group === g.key
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-steel-600 hover:bg-steel-50'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={exportCsv} disabled={rows.length === 0}>
          Export page
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-steel-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-steel-400">
          Nothing recorded yet. Check a visitor in and it will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-steel-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-medium ring-1 ${
                  TONE[r.action] ?? 'bg-steel-50 text-steel-600 ring-steel-200'
                }`}
              >
                {r.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-steel-800">{summarise(r)}</p>
                <p className="mt-0.5 text-xs text-steel-400">
                  {dateTime(r.created_at)} · {actorName(r, actors)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-steel-200 pt-4 text-sm">
          <span className="text-steel-500">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, count)} of {count}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

function actorName(row, actors) {
  if (!row.actor_id) return 'outside the application'
  return actors[row.actor_id] ?? 'a deleted user'
}

/** Turn the jsonb details into one readable sentence. */
function summarise(row) {
  const d = row.details ?? {}
  const mins = (s) => (s ? `${Math.round(Number(s) / 60)} min` : null)

  switch (row.action) {
    case 'visitor.check_in':
      return `${d.visitor}${d.organization ? ` (${d.organization})` : ''} checked in to see ${d.visiting}${d.signed ? '' : ' — no signature'}`
    case 'visitor.admitted':
      return `${d.visitor} sent up to ${d.visiting}${
        mins(d.waited_seconds) ? ` after waiting ${mins(d.waited_seconds)}` : ''
      }`
    case 'visitor.check_out':
      return `${d.visitor} checked out${
        mins(d.stayed_seconds) ? ` after ${mins(d.stayed_seconds)}` : ''
      }`
    case 'visitor.amended':
      return `Visit record for ${d.after?.full_name ?? 'a visitor'} was edited`
    case 'visitor.deleted':
      return `Visit record for ${d.visitor} was deleted`
    case 'user.role_changed':
      return `${d.user} changed from ${d.from} to ${d.to}`
    case 'user.activated':
      return `${d.user} was activated`
    case 'user.deactivated':
      return `${d.user} was deactivated`
    case 'pa.assigned':
      return `${d.pa} assigned to ${d.executive}${d.primary ? ' as primary' : ''}`
    case 'pa.unassigned':
      return `${d.pa} removed from ${d.executive}`
    case 'pa.primary_changed':
      return `${d.pa} ${d.primary ? 'made primary' : 'no longer primary'} for ${d.executive}`
    case 'executive.created':
      return `${d.name} added${d.position ? ` as ${d.position}` : ''}`
    case 'executive.deleted':
      return `${d.name} deleted`
    case 'executive.activated':
      return `${d.name} activated`
    case 'executive.deactivated':
      return `${d.name} deactivated`
    default:
      return JSON.stringify(d)
  }
}
