import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'

/**
 * The executives the signed-in user receives visitors for: the ones a
 * PA covers, plus an executive's own record.
 *
 * Used to narrow the History filter for a host. Row Level Security
 * already limits which visits they can read, so this is not what keeps
 * their history private -- it stops the filter offering names whose
 * visits would always come back empty, which reads as a fault.
 */
export function useMyExecutives(enabled = true) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled || !user?.id) {
      setLoading(false)
      return
    }
    let active = true

    ;(async () => {
      // Their own record, if they are an executive with a login, and
      // the assignments covering them, which RLS limits to this user.
      const [own, assigned] = await Promise.all([
        supabase.from('executives').select('id, full_name').eq('user_id', user.id),
        supabase.from('executive_assignments').select('executive_id'),
      ])

      const ids = [...new Set((assigned.data ?? []).map((a) => a.executive_id))]
      let covered = []
      if (ids.length) {
        const { data } = await supabase
          .from('executives')
          .select('id, full_name')
          .in('id', ids)
        covered = data ?? []
      }

      if (!active) return
      const byId = new Map()
      for (const ex of [...(own.data ?? []), ...covered]) byId.set(ex.id, ex)
      setItems(
        [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      )
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [enabled, user?.id])

  return { items, loading }
}
