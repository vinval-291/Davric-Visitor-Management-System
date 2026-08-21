import { useState } from 'react'
import { useTable } from '../../lib/useTable.js'
import { Panel, ErrorNote, Button, inputClass } from './ui.jsx'

/**
 * The executive -> PA mapping. Everything else in the system is
 * administration; this is the part the notifications actually run on.
 * An executive with nobody assigned is not broken -- their alerts fall
 * back to the super admins -- but it is worth surfacing loudly.
 */
export default function Assignments() {
  const executives = useTable('executives', {
    select: 'id, full_name, position, is_active, departments(name)',
    order: 'full_name',
  })
  const profiles = useTable('profiles', {
    select: 'id, full_name, email, role, is_active',
    order: 'full_name',
  })
  const assignments = useTable('executive_assignments', {
    select: 'id, executive_id, pa_user_id, is_primary',
    order: 'created_at',
  })

  const [adding, setAdding] = useState({})

  const pas = profiles.items.filter((p) => p.role === 'pa' && p.is_active)
  const paName = (id) => {
    const p = profiles.items.find((x) => x.id === id)
    return p ? p.full_name || p.email : 'Unknown user'
  }

  const forExecutive = (execId) =>
    assignments.items.filter((a) => a.executive_id === execId)

  async function assign(execId) {
    const paId = adding[execId]
    if (!paId) return
    const existing = forExecutive(execId)
    await assignments.create({
      executive_id: execId,
      pa_user_id: paId,
      // First PA on an executive becomes the primary automatically.
      is_primary: existing.length === 0,
    })
    setAdding((s) => ({ ...s, [execId]: '' }))
  }

  async function makePrimary(execId, assignmentId) {
    // Only one primary per executive is allowed by a unique index, so
    // demote the current one before promoting the new.
    const current = forExecutive(execId).find((a) => a.is_primary)
    if (current && current.id !== assignmentId) {
      await assignments.update(current.id, { is_primary: false })
    }
    await assignments.update(assignmentId, { is_primary: true })
  }

  const loading =
    executives.loading || profiles.loading || assignments.loading
  const error = executives.error || profiles.error || assignments.error

  const unassigned = executives.items.filter(
    (e) => e.is_active && forExecutive(e.id).length === 0,
  ).length

  return (
    <Panel
      title="PA assignments"
      description="Who is notified when a visitor arrives for each executive. A PA can cover several executives, and an executive can have a stand-in as well as a primary."
    >
      <ErrorNote message={error} onDismiss={() => assignments.setError(null)} />

      {pas.length === 0 && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          No active users have the Personal Assistant role yet. Set someone's
          role to PA under <strong>Users</strong> first.
        </p>
      )}

      {unassigned > 0 && (
        <p className="mb-4 rounded-lg bg-steel-50 px-4 py-3 text-sm text-steel-600 ring-1 ring-steel-200">
          {unassigned} active {unassigned === 1 ? 'executive has' : 'executives have'}{' '}
          no PA. Their visitor alerts go to the super admins instead, so
          nothing is lost — but somebody at the desk is chasing them.
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-steel-400">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {executives.items
            .filter((e) => e.is_active)
            .map((ex) => {
              const rows = forExecutive(ex.id)
              const taken = new Set(rows.map((r) => r.pa_user_id))
              const available = pas.filter((p) => !taken.has(p.id))

              return (
                <li
                  key={ex.id}
                  className="rounded-xl bg-steel-50 p-4 ring-1 ring-steel-200"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-ink">
                      {ex.full_name}
                      {ex.position && (
                        <span className="ml-2 text-sm font-normal text-steel-500">
                          {ex.position}
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-steel-400">
                      {ex.departments?.name ?? 'No department'}
                    </span>
                  </div>

                  {rows.length === 0 ? (
                    <p className="mt-2 text-sm text-brand-700">
                      No PA assigned — alerts fall back to super admins
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {rows.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-steel-200"
                        >
                          <span className="font-medium text-steel-800">
                            {paName(a.pa_user_id)}
                          </span>
                          {a.is_primary ? (
                            <span className="rounded-full bg-inside-50 px-2 py-0.5 text-xs font-medium text-inside-700 ring-1 ring-inside-500/30">
                              Primary
                            </span>
                          ) : (
                            <button
                              onClick={() => makePrimary(ex.id, a.id)}
                              className="rounded-full px-2 py-0.5 text-xs font-medium text-steel-500 ring-1 ring-steel-300 transition hover:bg-steel-50"
                            >
                              Make primary
                            </button>
                          )}
                          <button
                            onClick={() => assignments.remove(a.id)}
                            className="ml-auto text-sm font-medium text-brand-700 transition hover:underline"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {available.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        value={adding[ex.id] ?? ''}
                        onChange={(e) =>
                          setAdding((s) => ({ ...s, [ex.id]: e.target.value }))
                        }
                        className={`${inputClass} py-1.5`}
                      >
                        <option value="">Assign a PA…</option>
                        {available.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        disabled={!adding[ex.id]}
                        onClick={() => assign(ex.id)}
                      >
                        Assign
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
        </ul>
      )}
    </Panel>
  )
}
