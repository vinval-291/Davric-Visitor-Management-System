import { useEffect, useState } from 'react'
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx'
import {
  changePassword,
  passwordProblem,
  MIN_PASSWORD,
} from '../lib/password.js'

/** Your account: who you are signed in as, and changing your password. */
export default function AccountDialog({ onClose }) {
  const { profile, user, role, signOut } = useAuth()

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = passwordProblem(next, confirmation)
    if (problem) return setError(problem)
    if (!current) return setError('Enter your current password.')

    setBusy(true)
    setError(null)
    const message = await changePassword(user.email, current, next)
    setBusy(false)

    if (message) return setError(message)

    setDone(true)
    setCurrent('')
    setNext('')
    setConfirmation('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Your account"
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-ink">Your account</h2>
            <p className="mt-0.5 truncate text-sm text-steel-500">
              {user?.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-steel-400 transition hover:bg-steel-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <dl className="mt-5 space-y-2 rounded-xl bg-steel-50 px-4 py-3 text-sm ring-1 ring-steel-200">
          <div className="flex gap-4">
            <dt className="w-20 shrink-0 text-steel-500">Name</dt>
            <dd className="min-w-0 flex-1 font-medium text-ink">
              {profile?.full_name ?? '—'}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-20 shrink-0 text-steel-500">Role</dt>
            <dd className="min-w-0 flex-1 font-medium text-ink">
              {ROLE_LABEL[role] ?? 'No role'}
            </dd>
          </div>
        </dl>

        {done ? (
          <div className="mt-5 rounded-xl bg-inside-50 px-4 py-3 text-sm text-inside-700 ring-1 ring-inside-500/30">
            <p className="font-medium">Password changed.</p>
            <p className="mt-0.5">
              Use the new one next time you sign in on any device.
            </p>
          </div>
        ) : open ? (
          <form onSubmit={handleSubmit} className="mt-5">
            <h3 className="font-semibold text-ink">Change your password</h3>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-steel-700">
                Current password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value)
                  setError(null)
                }}
                className={inputClass}
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-steel-700">
                New password
              </span>
              <span className="block text-xs text-steel-400">
                At least {MIN_PASSWORD} characters
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => {
                  setNext(e.target.value)
                  setError(null)
                }}
                className={inputClass}
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-steel-700">
                Confirm new password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value)
                  setError(null)
                }}
                className={inputClass}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700 ring-1 ring-brand-200"
              >
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save new password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="mt-5 w-full rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
          >
            Change your password
          </button>
        )}

        <button
          onClick={signOut}
          className="mt-3 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

const inputClass =
  'mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-sm ' +
  'text-ink ring-1 ring-steel-300 transition focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500'
