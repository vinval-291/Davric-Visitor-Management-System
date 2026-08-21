import { useState } from 'react'
import { useTable } from '../../lib/useTable.js'
import { Panel, ErrorNote, Button, Table, inputClass } from './ui.jsx'

export default function Departments() {
  const { items, loading, error, setError, create, update, remove } = useTable(
    'departments',
    { order: 'name' },
  )
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const failed = await create({ name: name.trim() })
    setBusy(false)
    if (!failed) setName('')
  }

  async function save(id) {
    if (draft.trim()) await update(id, { name: draft.trim() })
    setEditing(null)
  }

  return (
    <Panel
      title="Departments"
      description="Used to group executives and to label each visit. Renaming one updates it everywhere it is shown; past visit records keep the name they were captured with."
      footer={
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New department name"
            className={`${inputClass} flex-1 min-w-48`}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            Add department
          </Button>
        </form>
      }
    >
      <ErrorNote message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <p className="py-6 text-center text-steel-400">Loading…</p>
      ) : (
        <Table
          head={['Department', '']}
          empty={items.length === 0 ? 'No departments yet.' : null}
        >
          {items.map((d) => (
            <tr key={d.id} className="border-b border-steel-100 last:border-0">
              <td className="px-3 py-2.5">
                {editing === d.id ? (
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(d.id)
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    autoFocus
                    className={`${inputClass} w-full max-w-xs`}
                  />
                ) : (
                  <span className="font-medium text-ink">{d.name}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex justify-end gap-2">
                  {editing === d.id ? (
                    <>
                      <Button variant="ghost" onClick={() => save(d.id)}>
                        Save
                      </Button>
                      <Button variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(d.id)
                          setDraft(d.name)
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${d.name}"? Executives in it keep their records but lose their department.`,
                            )
                          )
                            remove(d.id)
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  )
}
