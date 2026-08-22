import { useMemo, useState } from 'react'
import AppShell from '../components/AppShell.jsx'
import VisitorDetail from '../components/VisitorDetail.jsx'
import { useHistory, PAGE_SIZE } from '../lib/useHistory.js'
import { useTable } from '../lib/useTable.js'
import { useVisitors } from '../lib/useVisitors.js'
import { toCsv, downloadCsv } from '../lib/csv.js'
import { dateTime, clockTime, elapsed } from '../lib/time.js'
import { formatPhone } from '../lib/phone.js'
import { inputClass, Button } from '../components/admin/ui.jsx'

/** Local midnight, N days back, as an ISO string. */
function daysAgo(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function tomorrow() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

const PRESETS = [
  { key: 'today', label: 'Today', from: () => daysAgo(0) },
  { key: '7', label: 'Last 7 days', from: () => daysAgo(6) },
  { key: '30', label: 'Last 30 days', from: () => daysAgo(29) },
  { key: '90', label: 'Last 90 days', from: () => daysAgo(89) },
  { key: 'all', label: 'All time', from: () => null },
]

const secs = (n) => {
  if (n === null || n === undefined) return '—'
  const mins = Math.round(Number(n) / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

export default function History() {
  const departments = useTable('departments', { order: 'name' })
  const executives = useTable('executives', {
    select: 'id, full_name, is_active',
    order: 'full_name',
  })
  const { checkOut } = useVisitors()

  const [preset, setPreset] = useState('30')
  const [query, setQuery] = useState('')
  const [executiveId, setExecutiveId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)

  const filters = useMemo(
    () => ({
      from: PRESETS.find((p) => p.key === preset)?.from() ?? null,
      to: tomorrow(),
      query,
      executiveId,
      departmentId,
      status,
    }),
    [preset, query, executiveId, departmentId, status],
  )

  const { rows, count, summary, loading, error, pages, fetchAllForExport } =
    useHistory(filters, page)

  const change = (setter) => (value) => {
    setter(value)
    setPage(0)
  }

  async function handleExport() {
    setExporting(true)
    const all = await fetchAllForExport()
    setExporting(false)
    if (!all) return

    const csv = toCsv(
      [
        { label: 'Visitor', value: (v) => v.full_name },
        { label: 'Phone', value: (v) => (v.phone ? formatPhone(v.phone) : '') },
        { label: 'Organisation', value: (v) => v.organization },
        { label: 'Visiting', value: (v) => v.executive_name_snapshot },
        { label: 'Position', value: (v) => v.executive_position_snapshot },
        { label: 'Department', value: (v) => v.department_name_snapshot },
        { label: 'Purpose', value: (v) => v.purpose },
        { label: 'Arrived', value: (v) => dateTime(v.check_in_time) },
        { label: 'Sent up', value: (v) => (v.admitted_at ? dateTime(v.admitted_at) : '') },
        { label: 'Departed', value: (v) => (v.check_out_time ? dateTime(v.check_out_time) : '') },
        {
          label: 'Waited',
          value: (v) => (v.admitted_at ? elapsed(v.check_in_time, v.admitted_at) : ''),
        },
        {
          label: 'Stayed',
          value: (v) => (v.check_out_time ? elapsed(v.check_in_time, v.check_out_time) : ''),
        },
        { label: 'Status', value: (v) => (v.check_out_time ? 'Checked out' : 'Inside') },
      ],
      all,
    )

    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`davric-visitors-${stamp}.csv`, csv)
  }

  const active = selected ? rows.find((v) => v.id === selected) : null

  return (
    <AppShell
      title="Visitor history"
      subtitle="Search and report on every visit on record"
      actions={
        <Button onClick={handleExport} disabled={exporting || count === 0}>
          {exporting ? 'Preparing…' : 'Export CSV'}
        </Button>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Visits in period" value={summary?.total ?? '—'} />
        <Stat label="Still inside" value={summary?.inside ?? '—'} />
        <Stat label="Checked out" value={summary?.checked_out ?? '—'} />
        <Stat label="Average wait" value={secs(summary?.avg_wait_seconds)} small />
        <Stat label="Average visit" value={secs(summary?.avg_stay_seconds)} small />
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-steel-200">
        <div className="space-y-3 border-b border-steel-200 p-4">
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => change(setPreset)(p.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  preset === p.key
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-steel-600 hover:bg-steel-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={query}
              onChange={(e) => change(setQuery)(e.target.value)}
              placeholder="Name, company, host or phone"
              className={inputClass}
            />
            <select
              value={executiveId}
              onChange={(e) => change(setExecutiveId)(e.target.value)}
              className={inputClass}
            >
              <option value="">Any executive</option>
              {executives.items.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.full_name}
                </option>
              ))}
            </select>
            <select
              value={departmentId}
              onChange={(e) => change(setDepartmentId)(e.target.value)}
              className={inputClass}
            >
              <option value="">Any department</option>
              {departments.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => change(setStatus)(e.target.value)}
              className={inputClass}
            >
              <option value="">Any status</option>
              <option value="inside">Still inside</option>
              <option value="out">Checked out</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="m-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="p-10 text-center text-steel-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-sm text-steel-400">
            No visits match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead>
                <tr className="border-b border-steel-200 text-xs uppercase tracking-wider text-steel-500">
                  <th className="px-4 py-3 font-medium">Visitor</th>
                  <th className="px-4 py-3 font-medium">Visiting</th>
                  <th className="px-4 py-3 font-medium">Arrived</th>
                  <th className="px-4 py-3 font-medium">Waited</th>
                  <th className="px-4 py-3 font-medium">Stayed</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelected(v.id)}
                    className="cursor-pointer border-b border-steel-100 transition last:border-0 hover:bg-steel-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{v.full_name}</p>
                      {v.organization && (
                        <p className="text-xs text-steel-500">
                          {v.organization}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-steel-700">
                      {v.executive_name_snapshot}
                      {v.department_name_snapshot && (
                        <p className="text-xs text-steel-400">
                          {v.department_name_snapshot}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-steel-700">
                      {dateTime(v.check_in_time)}
                    </td>
                    <td className="px-4 py-3 text-steel-600">
                      {v.admitted_at
                        ? elapsed(v.check_in_time, v.admitted_at)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-steel-600">
                      {v.check_out_time
                        ? elapsed(v.check_in_time, v.check_out_time)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {v.check_out_time ? (
                        <span className="text-steel-500">
                          {clockTime(v.check_out_time)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-inside-50 px-2.5 py-1 text-xs font-medium text-inside-700 ring-1 ring-inside-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-inside-500" />
                          Inside
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-steel-200 p-4 text-sm">
            <span className="text-steel-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} of{' '}
              {count}
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

function Stat({ label, value, small }) {
  return (
    <div className="rounded-xl bg-white px-5 py-4 ring-1 ring-steel-200">
      <p className={`font-semibold text-ink ${small ? 'text-xl' : 'text-3xl'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-steel-500">{label}</p>
    </div>
  )
}
