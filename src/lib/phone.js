/**
 * Nigerian phone numbers: 11 digits, e.g. 08012345678.
 *
 * Stored as bare digits so that searching by phone always matches,
 * whatever spacing the receptionist happened to type. Formatting is a
 * display concern only.
 */

/** Strip everything that is not a digit. */
export function digitsOnly(value) {
  return (value ?? '').replace(/\D/g, '')
}

/**
 * Reduce any common way of writing the number down to 11 digits.
 * Handles +234 / 234 international prefixes, which visitors reading
 * off a business card will often give.
 */
export function normalizePhone(value) {
  let digits = digitsOnly(value)

  if (digits.startsWith('234') && digits.length > 11) {
    digits = '0' + digits.slice(3)
  }
  return digits.slice(0, 11)
}

/** 08012345678 -> "0801 234 5678", formatted progressively as typed. */
export function formatPhone(value) {
  const d = normalizePhone(value)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
}

/** Blank is allowed; anything present must be exactly 11 digits. */
export function isValidPhone(value) {
  const d = normalizePhone(value)
  return d.length === 0 || d.length === 11
}
