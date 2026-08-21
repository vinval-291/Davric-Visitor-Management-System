import { useState } from 'react'
import { useTable } from '../../lib/useTable.js'
import {
  Panel,
  ErrorNote,
  Button,
  Table,
  ActivePill,
  inputClass,
} from './ui.jsx'

const BLANK = { full_name: '', position: '', department_id: '' }

export default function Executives() {
  const departments = useTable('departments', { order: 'name' })
  const { items, loading, error, setError, create, update, remove } = useTable(
    'executives',
    { select: 'id, full_name, position, department_id, is_active', order: 'full_name' },
  )
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)

  const deptName = (id) =>
    departments.items.find((d) => d.id === id)?.name ?? '—'

  async function add(e) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setBusy(true)
    const failed = await create({
      full_name: form.full_name.trim(),
      position: form.position.trim() || null,
      department_id: form.department_id || null,
    })
    setBusy(false)
    if (!failed) setForm(BLANK)
  }

  return (
    <Panel
      title="Executives & management staff"
      description="The people a visitor can ask for. Deactivating someone hides them from the reception picker without touching any past visit record."
      footer={
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-4">
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Full name"
            className={inputClass}
          />
          <input
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            placeholder="Position"
            className={inputClass}
          />
          <select
            value={form.department_id}
            onChange={(e) =>
              setForm({ ...form, department_id: e.target.value })
            }
            className={inputClass}
          >
            <option value="">No department</option>
            {departments.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy || !form.full_name.trim()}>
            Add executive
          </Button>
        </form>
      }
    >
      <ErrorNote message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <p className="py-6 text-center text-steel-400">Loading…</p>
      ) : (
        <Table
          head={['Name', 'Position', 'Department', 'Status', '']}
          empty={items.length === 0 ? 'No executives yet.' : null}
        >
          {items.map((ex) => (
            <tr key={ex.id} className="border-b border-steel-100 last:border-0">
              <td className="px-3 py-2.5 font-medium text-ink">
                {ex.full_name}
              </td>
              <td className="px-3 py-2.5 text-steel-600">
                {ex.position || '—'}
              </td>
              <td className="px-3 py-2.5">
                <select
                  value={ex.department_id ?? ''}
                  onChange={(e) =>
                    update(ex.id, { department_id: e.target.value || null })
                  }
                  className={`${inputClass} py-1.5`}
                >
                  <option value="">No department</option>
                  {departments.items.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2.5">
                <ActivePill active={ex.is_active} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => update(ex.id, { is_active: !ex.is_active })}
                  >
                    {ex.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete ${ex.full_name}? Past visits keep their name on record. Deactivating is usually better.`,
                        )
                      )
                        remove(ex.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  )
}
