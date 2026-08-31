import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { passwordProblem, setPassword, MIN_PASSWORD } from '../lib/password.js'
import Logo from '../components/Logo.jsx'

/**
 * Where a password reset email lands.
 *
 * The link itself is the proof of identity: opening it establishes a
 * session, which is why no current password is asked for here. If the
 * session is missing the link has expired or was already used, and
 * saying so is more useful than an empty form that fails on submit.
 */
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPasswordValue] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => navigate('/', { replace: true }), 2500)
    return () => clearTimeout(id)
  }, [done, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = passwordProblem(password, confirmation)
    if (problem) return setError(problem)

    setBusy(true)
    setError(null)
    const message = await setPassword(password)
    setBusy(false)

    if (message) setError(message)
    else setDone(true)
  }

  return (
    <div className="min-h-full bg-steel-50">
      <div className="h-1.5 w-full bg-brand-500" />

      <div className="flex min-h-[calc(100%-0.375rem)] items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Logo size="lg" className="mx-auto" />
            <p className="mt-4 text-sm font-medium text-steel-500">
              Visitor Management System
            </p>
          </div>

          <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-steel-200">
            {loading ? (
              <p className="text-center text-sm text-steel-400">Checking…</p>
            ) : done ? (
              <>
                <h1 className="text-lg font-semibold text-ink">
                  Password changed
                </h1>
                <p className="mt-2 text-sm text-steel-600">
                  You are signed in with the new password. Taking you to your
                  dashboard…
                </p>
              </>
            ) : !session ? (
              <>
                <h1 className="text-lg font-semibold text-ink">
                  This link has expired
                </h1>
                <p className="mt-2 text-sm text-steel-600">
                  Reset links can only be used once, and stop working after a
                  short time. Request a new one from the sign-in page.
                </p>
                <button
                  onClick={() => navigate('/login', { replace: true })}
                  className="mt-6 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <h1 className="text-lg font-semibold text-ink">
                  Choose a new password
                </h1>
                <p className="mt-1 text-sm text-steel-500">
                  At least {MIN_PASSWORD} characters.
                </p>

                <label className="mt-6 block">
                  <span className="text-sm font-medium text-steel-700">
                    New password
                  </span>
                  <input
                    type="password"
                    required
                    autoFocus
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPasswordValue(e.target.value)
                      setError(null)
                    }}
                    className="mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-sm text-ink ring-1 ring-steel-300 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-medium text-steel-700">
                    Confirm new password
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => {
                      setConfirmation(e.target.value)
                      setError(null)
                    }}
                    className="mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-sm text-ink ring-1 ring-steel-300 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700 ring-1 ring-brand-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-6 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save new password'}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-steel-400">
            Dav-Ric Group of Companies
          </p>
        </div>
      </div>
    </div>
  )
}
