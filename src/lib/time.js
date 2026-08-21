/** Short clock time, e.g. "10:32 AM". */
export function clockTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "4 min", "1 hr 12 min" — how long between two moments. */
export function elapsed(fromIso, toIso = null) {
  if (!fromIso) return null
  const from = new Date(fromIso).getTime()
  const to = toIso ? new Date(toIso).getTime() : Date.now()
  const mins = Math.max(0, Math.floor((to - from) / 60000))

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hrs} hr ${rest} min` : `${hrs} hr`
}

/** Full date and time for records and reports. */
export function dateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
