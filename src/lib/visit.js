/**
 * Wording for the two visit questions, in one place.
 *
 * The receptionist asks them, the host reads the answers, History
 * exports them. If each screen phrased them its own way, a PA would
 * read "Walk-in" on one screen and "No appointment" on another and
 * reasonably wonder whether they meant the same thing.
 */

// Hints kept to one short line. The two questions sit side by side
// with their buttons on one row, and a hint that wraps to two or three
// lines makes its button taller than the one beside it.
export const VISIT_TYPES = [
  { value: 'official', label: 'Official', hint: 'Work or business' },
  { value: 'personal', label: 'Personal', hint: 'Family or private' },
]

// Held as 'yes' / 'no' in the form so "not answered yet" is an empty
// string rather than false -- false is a real answer.
export const APPOINTMENT_CHOICES = [
  { value: 'yes', label: 'Yes', hint: 'Expected today' },
  { value: 'no', label: 'No', hint: 'Walk-in' },
]

/** Null for visits recorded before these questions existed. */
export function visitTypeLabel(type) {
  if (type === 'official') return 'Official visit'
  if (type === 'personal') return 'Personal visit'
  return null
}

export function appointmentLabel(hasAppointment) {
  if (hasAppointment === true) return 'Has an appointment'
  if (hasAppointment === false) return 'No appointment'
  return null
}
