import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

export const VISITOR_FIELDS = `
  id, full_name, phone, organization, purpose,
  executive_name_snapshot, executive_position_snapshot,
  department_name_snapshot, check_in_time, admitted_at,
  check_out_time, status, signature_path
`

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * The reception desk's working set: everyone who arrived today, plus
 * anyone still inside from an earlier day.
 *
 * That second half matters. A visitor who was never checked out
 * yesterday is still recorded as on the premises, and reception has
 * to be able to see and close that record -- otherwise the "currently
 * inside" figure drifts upward forever and the emergency roll call
 * becomes useless.
 */
export function useVisitors() {
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('visitors')
      .select(VISITOR_FIELDS)
      .or(`check_in_time.gte.${startOfToday()},check_out_time.is.null`)
      .order('check_in_time', { ascending: false })

    if (error) setError(error.message)
    else setVisitors(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keep the desk in step with the PA sending someone up, and with a
  // second reception device checking someone out.
  useEffect(() => {
    const channel = supabase
      .channel('reception:visitors')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitors' },
        () => load(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const checkOut = useCallback(async (id) => {
    // check_out_time is stamped by the server; this value is discarded.
    const { data, error } = await supabase
      .from('visitors')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', id)
      .select(VISITOR_FIELDS)
      .maybeSingle()

    if (error) return error.message
    if (data) {
      setVisitors((prev) => prev.map((v) => (v.id === id ? data : v)))
    }
    return null
  }, [])

  // These sets deliberately overlap, which is why the dashboard labels
  // them carefully rather than inviting the reader to add them up:
  //
  //   waiting is a SUBSET of inside -- someone waiting in the lobby is
  //   on the premises, they simply have not been sent up yet
  //
  //   inside counts everyone still on site from ANY day, while today
  //   counts only today's arrivals. A visitor never checked out
  //   yesterday appears in inside but not in today
  //
  // So inside + out does not equal today, and it should not.
  const today = startOfToday()
  const counts = {
    inside: visitors.filter((v) => !v.check_out_time).length,
    waiting: visitors.filter((v) => !v.admitted_at && !v.check_out_time).length,
    today: visitors.filter((v) => v.check_in_time >= today).length,
    out: visitors.filter(
      (v) => v.check_out_time && v.check_in_time >= today,
    ).length,
    // Still on site from an earlier day: almost always a forgotten
    // check-out, and the reason inside can exceed today's arrivals.
    stale: visitors.filter(
      (v) => !v.check_out_time && v.check_in_time < today,
    ).length,
  }

  return { visitors, loading, error, counts, checkOut, reload: load }
}

/**
 * Signatures live in a private bucket, so they are fetched through a
 * short-lived signed URL rather than a public link. Sixty seconds is
 * plenty to render an image and useless to anyone who copies it.
 */
export async function signatureUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from('signatures')
    .createSignedUrl(path, 60)
  return error ? null : data.signedUrl
}
