import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { VISITOR_FIELDS } from './useVisitors.js'
import { normalizePhone } from './phone.js'

export const PAGE_SIZE = 50
const EXPORT_CAP = 5000

/**
 * Builds the filtered query once, so the paged view, the summary and
 * the export can never disagree about what "the current result" is.
 */
function build(filters) {
  let query = supabase.from('visitors').select(VISITOR_FIELDS, { count: 'exact' })

  if (filters.from) query = query.gte('check_in_time', filters.from)
  if (filters.to) query = query.lt('check_in_time', filters.to)
  if (filters.executiveId) query = query.eq('executive_id', filters.executiveId)
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId)
  if (filters.status === 'inside') query = query.is('check_out_time', null)
  if (filters.status === 'out') query = query.not('check_out_time', 'is', null)

  const q = filters.query?.trim()
  if (q) {
    // Searching a phone number typed with spaces has to match the bare
    // digits we store, so the term is normalised before it is used.
    const digits = normalizePhone(q)
    const terms = [
      `full_name.ilike.%${q}%`,
      `organization.ilike.%${q}%`,
      `executive_name_snapshot.ilike.%${q}%`,
    ]
    if (digits.length >= 3) terms.push(`phone.ilike.%${digits}%`)
    query = query.or(terms.join(','))
  }

  return query.order('check_in_time', { ascending: false })
}

export function useHistory(filters, page) {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const key = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)

    const from = page * PAGE_SIZE
    const [list, report] = await Promise.all([
      build(filters).range(from, from + PAGE_SIZE - 1),
      supabase.rpc('visitor_report', {
        from_ts: filters.from || null,
        to_ts: filters.to || null,
        exec_id: filters.executiveId || null,
        dept_id: filters.departmentId || null,
      }),
    ])

    if (list.error) setError(list.error.message)
    else {
      setError(null)
      setRows(list.data ?? [])
      setCount(list.count ?? 0)
    }

    // The summary intentionally ignores the text search and status
    // filter: it describes the period, not the current view.
    if (!report.error) setSummary(report.data?.[0] ?? null)

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page])

  useEffect(() => {
    load()
  }, [load])

  /** Every matching row, not just the visible page. */
  const fetchAllForExport = useCallback(async () => {
    const { data, error } = await build(filters).range(0, EXPORT_CAP - 1)
    if (error) {
      setError(error.message)
      return null
    }
    return data ?? []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    rows,
    count,
    summary,
    loading,
    error,
    pages: Math.ceil(count / PAGE_SIZE),
    fetchAllForExport,
    reload: load,
  }
}
