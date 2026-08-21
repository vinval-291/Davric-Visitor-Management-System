import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx'

const TABLES = [
  'departments',
  'executives',
  'executive_assignments',
  'profiles',
  'visitors',
  'notifications',
  'audit_logs',
]

/**
 * Development aid: shows exactly what the signed-in role can read,
 * straight from the database.
 *
 * Sign in as each role and compare. If a receptionist can count
 * audit_logs, or a PA can see visitors for an executive they are not
 * assigned to, the policies are wrong -- and you find out here rather
 * than during the pilot. Remove this panel before production.
 */
export default function AccessProbe() {
  const { role } = useAuth()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
        return { table, count: count ?? 0, error: error?.message ?? null }
      }),
    ).then((result) => active && setRows(result))
    return () => {
      active = false
    }
  }, [role])

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-steel-200">
      <h2 className="text-sm font-semibold text-ink">
        What this role can read
      </h2>
      <p className="mt-1 text-sm text-steel-500">
        Live query as{' '}
        <span className="font-medium text-steel-700">
          {ROLE_LABEL[role] ?? 'unknown'}
        </span>
        . These numbers come from the database, enforced by Row Level
        Security — not from anything the interface decides.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-md text-sm">
          <thead>
            <tr className="border-b border-steel-200 text-left">
              <th className="pb-2 font-medium text-steel-500">Table</th>
              <th className="pb-2 text-right font-medium text-steel-500">
                Rows visible
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={2} className="py-4 text-steel-400">
                  Checking…
                </td>
              </tr>
            )}
            {rows?.map(({ table, count, error }) => (
              <tr key={table} className="border-b border-steel-100 last:border-0">
                <td className="py-2 font-mono text-xs text-steel-700">
                  {table}
                </td>
                <td className="py-2 text-right">
                  {error ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      denied
                    </span>
                  ) : count === 0 ? (
                    <span className="text-steel-400">0</span>
                  ) : (
                    <span className="font-semibold text-ink">{count}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
