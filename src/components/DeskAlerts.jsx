import { useCallback, useEffect } from 'react'
import { useNotifications } from '../lib/useNotifications.js'
import { playAlert, systemNotify, unlockAudio } from '../lib/sound.js'
import { clockTime } from '../lib/time.js'
import { isExperienceCenter, EXPERIENCE_CENTER } from '../lib/visit.js'

/**
 * Alerts for the reception desk.
 *
 * At present this is one message: the PA has sent for a visitor who is
 * standing at the desk. It is deliberately loud — a banner across the
 * top plus a sound — because the receptionist is usually looking at
 * the visitor, not at the screen, and the whole point is to be able to
 * say "you can go up now" without being asked.
 */
export default function DeskAlerts() {
  useEffect(unlockAudio, [])

  const onArrival = useCallback((notification) => {
    if (notification?.type !== 'visitor_admitted') return
    playAlert()
    systemNotify({
      title: isExperienceCenter(notification.visitor)
        ? `Visitor to the ${EXPERIENCE_CENTER}`
        : 'Visitor may go up',
      body: notification.message,
      tag: notification.id,
    })
  }, [])

  const { items, markRead } = useNotifications({ onArrival })

  const pending = items.filter(
    (n) => !n.is_read && n.type === 'visitor_admitted',
  )

  if (pending.length === 0) return null

  return (
    <ul className="mb-6 space-y-2">
      {pending.map((n) => {
        // The host can send a visitor upstairs to them, or to the
        // Experience Center instead. Reception reads this out, so the
        // wording has to say which.
        const toCenter = isExperienceCenter(n.visitor)
        const host = n.visitor?.executive_name_snapshot

        return (
          <li
            key={n.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-inside-50 px-5 py-4 ring-1 ring-inside-500/40"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inside-500 text-white">
              {toCenter ? '→' : '↑'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-inside-700">
                {n.visitor?.full_name ?? 'A visitor'}{' '}
                {toCenter ? `should go to the ${EXPERIENCE_CENTER}` : 'may go up'}
              </p>
              <p className="text-sm text-steel-600">
                {!host
                  ? n.message
                  : toCenter
                    ? `${host} has sent them there`
                    : `${host} has sent for them`}
                {n.visitor?.admitted_at &&
                  ` · ${clockTime(n.visitor.admitted_at)}`}
              </p>
            </div>
            <button
              onClick={() => markRead(n.id)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
            >
              Told them
            </button>
          </li>
        )
      })}
    </ul>
  )
}
