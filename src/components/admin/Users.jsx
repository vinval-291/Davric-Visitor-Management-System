import { useState } from 'react'
import { useTable } from '../../lib/useTable.js'
import { sendResetEmail } from '../../lib/password.js'
import { useAuth, ROLE_LABEL } from '../../lib/auth.jsx'
import { Panel, ErrorNote, Button, Table, ActivePill, inputClass } from './ui.jsx'

const ROLES = ['super_admin', 'receptionist', 'pa', 'executive']

export default function Users() {
  const { user } = useAuth()
  const [sentTo, setSentTo] = useState(null)
  const [sending, setSending] = useState(null)
  const [sendError, setSendError] = useState(null)

  async function sendReset(profile) {
    setSending(profile.id)
    setSendError(null)
    const message = await sendResetEmail(profile.email)
    setSending(null)
    if (message) setSendError(message)
    else setSentTo(profile.id)
  }

  const departments = useTable('departments', { order: 'name' })
  const { items, loading, error, setError, update } = useTable('profiles', {
    select: 'id, full_name, email, phone, role, department_id, is_active, created_at',
    order: 'full_name',
  })

  return (
    <Panel
      title="System users"
      description="Roles and access for everyone who signs in. A user always keeps at least their own record; changing a role takes effect the next time they load the app."
      footer={
        <div className="text-sm text-steel-600">
          <p className="font-medium text-steel-800">To add a new user</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
            <li>
              Supabase dashboard → <strong>Authentication → Users → Add
              user</strong>, ticking <em>Auto Confirm User</em>
            </li>
            <li>They appear in this table within a moment, as a receptionist</li>
            <li>Set their real name and correct role here</li>
          </ol>
          <p className="mt-2 text-steel-500">
            Account creation stays in the Supabase dashboard on purpose: doing
            it from this screen would require a key that can bypass every
            security policy in the system, and that key must never be in a
            browser.
          </p>
        </div>
      }
    >
      <ErrorNote message={error} onDismiss={() => setError(null)} />

      {sendError && (
        <div className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
          <p>{sendError}</p>
          <p className="mt-2 text-steel-600">
            Until email is configured, set a password directly: Supabase
            dashboard → <strong>Authentication → Users</strong> → the account →{' '}
            <strong>Reset password</strong>. No email is involved.
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-steel-400">Loading…</p>
      ) : (
        <Table
          head={['Name', 'Email', 'Role', 'Department', 'Status', '', '']}
          empty={items.length === 0 ? 'No users yet.' : null}
        >
          {items.map((p) => {
            const self = p.id === user?.id
            return (
              <tr key={p.id} className="border-b border-steel-100 last:border-0">
                <td className="px-3 py-2.5">
                  <input
                    defaultValue={p.full_name}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== p.full_name)
                        update(p.id, { full_name: next })
                    }}
                    className={`${inputClass} w-full max-w-44 py-1.5`}
                  />
                  {self && (
                    <span className="ml-2 text-xs text-steel-400">you</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-steel-600">{p.email}</td>
                <td className="px-3 py-2.5">
                  <select
                    value={p.role}
                    disabled={self}
                    title={
                      self ? 'You cannot change your own role' : undefined
                    }
                    onChange={(e) => update(p.id, { role: e.target.value })}
                    className={`${inputClass} py-1.5 disabled:opacity-50`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={p.department_id ?? ''}
                    onChange={(e) =>
                      update(p.id, { department_id: e.target.value || null })
                    }
                    className={`${inputClass} py-1.5`}
                  >
                    <option value="">—</option>
                    {departments.items.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <ActivePill active={p.is_active} />
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    variant="ghost"
                    disabled={sending === p.id || !p.email}
                    onClick={() => sendReset(p)}
                  >
                    {sending === p.id
                      ? 'Sending…'
                      : sentTo === p.id
                        ? 'Link sent'
                        : 'Reset password'}
                  </Button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    variant={p.is_active ? 'danger' : 'ghost'}
                    disabled={self}
                    title={self ? 'You cannot deactivate yourself' : undefined}
                    onClick={() => update(p.id, { is_active: !p.is_active })}
                  >
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            )
          })}
        </Table>
      )}
    </Panel>
  )
}
