import { supabase } from './supabase.js'

/**
 * Password rules, in one place so the login page, the reset page and
 * the change-password dialog cannot drift apart.
 *
 * Eight characters rather than Supabase's default six. These accounts
 * reach every visitor record the company holds, and reception's device
 * sits in a public area.
 */
export const MIN_PASSWORD = 8

export function passwordProblem(password, confirmation) {
  if (!password) return 'Enter a new password.'
  if (password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`
  }
  if (confirmation !== undefined && password !== confirmation) {
    return 'The two passwords do not match.'
  }
  return null
}

/**
 * Sends the reset email. Where the link lands is set here.
 *
 * Returns null on success, or a message worth showing someone who is
 * standing at a desk unable to get in.
 *
 * The failure worth handling is the mail server, not the address.
 * Supabase answers a non-existent address with success on purpose --
 * saying otherwise would confirm who has an account here -- so an
 * error back from this call means the project could not send at all.
 * Left raw it reads "Error sending recovery email", which tells the
 * person locked out nothing they can act on.
 */
export async function sendResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })

  if (!error) return null

  const status = error.status ?? 0
  if (status >= 500 || /sending|smtp|mail/i.test(error.message)) {
    return (
      'The reset email could not be sent. This is a problem with the mail ' +
      'service, not your account. Ask a system administrator to reset your ' +
      'password for you.'
    )
  }
  if (status === 429) {
    return 'Too many attempts. Wait a few minutes and try again.'
  }
  return error.message
}

/** Used on the reset page, where the recovery link is the proof. */
export async function setPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  return error?.message ?? null
}

/**
 * Changing a password while signed in re-checks the current one first.
 *
 * Supabase does not require it -- a valid session is enough -- but a
 * reception tablet is left unattended on a counter, and without this
 * anyone passing could lock the receptionist out of their own account
 * in three taps.
 */
export async function changePassword(email, currentPassword, newPassword) {
  const { error: wrong } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (wrong) return 'That is not your current password.'

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return error?.message ?? null
}
