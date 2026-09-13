import { visitTypeLabel, appointmentLabel } from '../lib/visit.js'

/**
 * The two answers as chips, for the host.
 *
 * "No appointment" is the one given colour. It is the answer that most
 * often changes what a PA does -- check with the executive first,
 * rather than sending someone straight up -- so it should not look the
 * same as the routine case. Visits recorded before these questions
 * existed simply show nothing.
 */
export default function VisitTags({ visitor, className = '' }) {
  const type = visitTypeLabel(visitor.visit_type)
  const appointment = appointmentLabel(visitor.has_appointment)
  if (!type && !appointment) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {type && (
        <span className="rounded-full bg-steel-100 px-2.5 py-0.5 text-xs font-medium text-steel-700 ring-1 ring-steel-200">
          {type}
        </span>
      )}
      {appointment && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            visitor.has_appointment
              ? 'bg-inside-50 text-inside-700 ring-inside-500/30'
              : 'bg-brand-50 text-brand-700 ring-brand-200'
          }`}
        >
          {appointment}
        </span>
      )}
    </div>
  )
}
