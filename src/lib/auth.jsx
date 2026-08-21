import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

/**
 * Authentication and role state for the whole app.
 *
 * Two separate things are tracked:
 *   session - who Supabase Auth says you are (identity)
 *   profile - what this application says you may do (role, active flag)
 *
 * A valid session with no profile row, or with is_active false, is NOT
 * access. The database enforces that too, but the UI should say so
 * clearly instead of showing an empty dashboard.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      setProfileError(error.message)
      setProfile(null)
    } else {
      setProfileError(null)
      setProfile(data)
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      if (active) setLoading(false)
    })

    // Fires on sign-in, sign-out and token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return
      setSession(next)
      await loadProfile(next?.user?.id)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.is_active ? profile.role : null,
    loading,
    profileError,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where each role belongs after signing in. */
export const HOME_FOR_ROLE = {
  super_admin: '/admin',
  receptionist: '/reception',
  pa: '/pa',
}

export const ROLE_LABEL = {
  super_admin: 'Super Admin',
  receptionist: 'Receptionist',
  pa: 'Personal Assistant',
}
