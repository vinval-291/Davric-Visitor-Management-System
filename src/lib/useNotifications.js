import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { useAuth } from './auth.jsx'

const VISITOR_FIELDS = `
  id, full_name, organization, purpose, phone,
  executive_name_snapshot, executive_position_snapshot,
  department_name_snapshot, check_in_time, admitted_at,
  check_out_time, status
`

const SELECT = `id, message, is_read, read_at, created_at, visitor_id,
                visitor:visitors(${VISITOR_FIELDS})`

/**
 * The PA's live inbox.
 *
 * Realtime enforces the same RLS policies as a normal query, so this
 * subscription physically cannot deliver another PA's alerts. The
 * flip side is that a wrong policy shows up as silence rather than an
 * error -- which is why Step 9 is tested with two sessions open.
 */
export function useNotifications({ onArrival } = {}) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const arrivalRef = useRef(onArrival)
  arrivalRef.current = onArrival

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) setError(error.message)
    else setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`inbox:${user.id}`)
      // A new alert. The payload carries only the notification row, so
      // the visitor is fetched separately to fill in the card.
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        async ({ new: row }) => {
          const { data } = await supabase
            .from('notifications')
            .select(SELECT)
            .eq('id', row.id)
            .maybeSingle()

          if (!data) return
          setItems((prev) =>
            prev.some((n) => n.id === data.id) ? prev : [data, ...prev],
          )
          arrivalRef.current?.(data)
        },
      )
      // Keeps cards in step when reception checks someone out, or when
      // the same PA admits from another device.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visitors' },
        ({ new: visitor }) => {
          setItems((prev) =>
            prev.map((n) =>
              n.visitor_id === visitor.id
                ? { ...n, visitor: { ...n.visitor, ...visitor } }
                : n,
            ),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const markRead = useCallback(async (id) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    // read_at is stamped by the guard trigger, not by the client.
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) {
      setError(error.message)
      load()
    }
  }, [load])

  const admit = useCallback(
    async (visitorId) => {
      // admitted_at and admitted_by are both set server-side; the value
      // sent here is only a trigger for the update.
      const { data, error } = await supabase
        .from('visitors')
        .update({ admitted_at: new Date().toISOString() })
        .eq('id', visitorId)
        .select(VISITOR_FIELDS)
        .maybeSingle()

      if (error) {
        setError(error.message)
        return error.message
      }
      if (data) {
        setItems((prev) =>
          prev.map((n) =>
            n.visitor_id === visitorId ? { ...n, visitor: data } : n,
          ),
        )
      }
      return null
    },
    [],
  )

  const unread = items.filter((n) => !n.is_read).length
  const waiting = items.filter(
    (n) => n.visitor && !n.visitor.admitted_at && !n.visitor.check_out_time,
  ).length

  return { items, loading, error, unread, waiting, markRead, admit, reload: load }
}
