import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, HOME_FOR_ROLE } from '../lib/auth.jsx'
import Logo from '../components/Logo.jsx'
import { Splash } from '../components/ProtectedRoute.jsx'
import { sendResetEmail } from '../lib/password.js'

export default function Login() {
  const { session, role, loading, signIn } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // 'signin' | 'forgot' | 'sent'
  const [mode, setMode] = useState('signin')

  // The branded splash, not a blank page: this render happens on every
  // load while the session and profile are being resolved.
  if (loading) return <Splash />

  if (session) {
    const from = location.state?.from
    const target =
      (from && from !== '/login' ? from : null) ?? HOME_FOR_ROLE[role] ?? '/'
    return <Navigate to={target} replace />
  }

  async function handleReset(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const message = await sendResetEmail(email)
    setBusy(false)
    // Shown whether or not the address exists. Confirming which
    // addresses have accounts would tell an attacker who works here.
    if (message) setError(message)
    else setMode('sent')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const message = await signIn(email, password)
    if (message) {
      // Never reveal whether the email exists -- that is an account
      // enumeration leak. One message covers both cases.
      setError(
        message.toLowerCase().includes('invalid')
          ? 'Incorrect email or password.'
          : message,
      )
      setBusy(false)
    }
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

          <form
            onSubmit={mode === 'signin' ? handleSubmit : handleReset}
            className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-steel-200"
          >
            <h1 className="text-lg font-semibold text-ink">
              {mode === 'signin' ? 'Sign in' : 'Reset your password'}
            </h1>
            <p className="mt-1 text-sm text-steel-500">
              {mode === 'signin'
                ? 'Authorised staff only.'
                : 'We will email you a link to choose a new one.'}
            </p>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-steel-700">
                Email address
              </span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-sm text-ink ring-1 ring-steel-300 transition placeholder:text-steel-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="you@davric.com"
              />
            </label>

            {mode === 'signin' && (
              <label className="mt-4 block">
                <span className="text-sm font-medium text-steel-700">
                  Password
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-3.5 py-2.5 text-sm text-ink ring-1 ring-steel-300 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="••••••••"
                />
              </label>
            )}

            {mode === 'sent' && (
              <p className="mt-4 rounded-lg bg-inside-50 px-3.5 py-2.5 text-sm text-inside-700 ring-1 ring-inside-500/30">
                If an account exists for that address, a reset link is on its
                way. It expires shortly, so use it soon — and check your spam
                folder.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700 ring-1 ring-brand-200"
              >
                {error}
              </p>
            )}

            {mode !== 'sent' && (
              <button
                type="submit"
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {busy
                  ? mode === 'signin'
                    ? 'Signing in…'
                    : 'Sending…'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Email me a reset link'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'forgot' : 'signin')
                setError(null)
              }}
              className="mt-4 w-full text-center text-sm font-medium text-steel-500 underline underline-offset-2 transition hover:text-steel-800"
            >
              {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-steel-400">
            Dav-Ric Group of Companies
          </p>
        </div>
      </div>
    </div>
  )
}
