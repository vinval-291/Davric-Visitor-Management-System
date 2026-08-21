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

/** True if this moment falls before midnight today. */
export function isBeforeToday(iso) {
  if (!iso) return false
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  return new Date(iso) < midnight
}

/**
 * Clock time for today, but with a date once it is not today.
 *
 * A visitor still inside from Tuesday must not read as "10:32 AM" and
 * look like this morning. Reception has to be able to spot a stale
 * record at a glance, because a forgotten check-out inflates the
 * "currently inside" figure indefinitely.
 */
export function smartTime(iso) {
  if (!iso) return '—'
  const when = new Date(iso)
  const time = clockTime(iso)

  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  if (when >= midnight) return time

  const yesterday = new Date(midnight)
  yesterday.setDate(yesterday.getDate() - 1)
  if (when >= yesterday) return `Yesterday ${time}`

  return `${when.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  })} ${time}`
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
