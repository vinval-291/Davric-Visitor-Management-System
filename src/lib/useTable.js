import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

/**
 * Small CRUD hook for the admin screens.
 *
 * Every mutation reloads rather than patching local state. These
 * tables are tiny -- tens of rows, edited rarely -- so correctness is
 * worth more than saving a round trip, and it means a rejected write
 * can never leave the screen showing something the database refused.
 */
export function useTable(table, { select = '*', order = 'created_at', ascending = true } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order, { ascending })

    if (error) setError(error.message)
    else {
      setError(null)
      setItems(data ?? [])
    }
    setLoading(false)
  }, [table, select, order, ascending])

  useEffect(() => {
    load()
  }, [load])

  const run = useCallback(
    async (query) => {
      const { error } = await query
      if (error) {
        setError(error.message)
        return error.message
      }
      setError(null)
      await load()
      return null
    },
    [load],
  )

  const create = useCallback(
    (row) => run(supabase.from(table).insert(row)),
    [run, table],
  )

  const update = useCallback(
    (id, patch) => run(supabase.from(table).update(patch).eq('id', id)),
    [run, table],
  )

  const remove = useCallback(
    (id) => run(supabase.from(table).delete().eq('id', id)),
    [run, table],
  )

  return { items, loading, error, setError, create, update, remove, reload: load }
}
