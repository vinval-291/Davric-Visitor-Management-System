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

/** Sends the reset email. Where the link lands is set here. */
export async function sendResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  return error?.message ?? null
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
