import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

/**
 * Loads active executives with their department, grouped for a picker.
 *
 * Every signed-in role may read this (policy executives_read), because
 * the receptionist has to choose a host and the PA has to see one.
 */
export function useExecutives() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    supabase
      .from('executives')
      .select('id, full_name, position, department_id, departments(name)')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setError(error.message)
        } else {
          const byDept = new Map()
          for (const ex of data ?? []) {
            const dept = ex.departments?.name ?? 'Other'
            if (!byDept.has(dept)) byDept.set(dept, [])
            byDept.get(dept).push(ex)
          }
          setGroups(
            [...byDept.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([department, executives]) => ({ department, executives })),
          )
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { groups, loading, error }
}
