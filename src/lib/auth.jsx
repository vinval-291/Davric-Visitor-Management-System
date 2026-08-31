import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
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
 *
 * `undefined` and `null` mean different things here, and the
 * difference is the whole point:
 *
 *   undefined - not looked up yet
 *   null      - looked up, and there is nothing
 *
 * Collapsing the two is what caused a blank screen and a flash of
 * "account not activated" on every sign-in. The auth listener set the
 * new session and re-rendered before the profile had been fetched, so
 * for one render the app saw a signed-in user with no role: the route
 * guard read that as a deactivated account, and the login page bounced
 * to "/" while the home route bounced back to "/login". Treating
 * "not yet known" as its own state means the app waits instead of
 * acting on an answer it does not have.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [profileError, setProfileError] = useState(null)

  // Whose profile the current state describes. Used to drop a reply
  // that arrives after the user has already changed -- a slow request
  // for the previous account must not overwrite the new one.
  const loadedFor = useRef(null)

  const loadProfile = useCallback(async (userId) => {
    loadedFor.current = userId ?? null

    if (!userId) {
      setProfileError(null)
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (loadedFor.current !== userId) return

    if (error) {
      setProfileError(error.message)
      setProfile(null)
    } else {
      setProfileError(null)
      setProfile(data ?? null)
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      loadProfile(data.session?.user?.id)
    })

    // Fires on sign-in, sign-out and token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      const nextUserId = next?.user?.id ?? null
      setSession(next ?? null)

      // Only re-fetch when the person actually changes. A token
      // refresh fires this listener every hour, and blanking the
      // profile for it would drop the user back to a loading screen
      // mid-task for no reason.
      if (nextUserId !== loadedFor.current) {
        setProfile(undefined)
        loadProfile(nextUserId)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Not ready until BOTH answers are in. Anything that reads `role`
  // before this is false is reading a question that has no answer yet.
  const loading =
    session === undefined || (Boolean(session) && profile === undefined)

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = {
    session: session ?? null,
    user: session?.user ?? null,
    profile: profile ?? null,
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
  pa: '/arrivals',
  executive: '/arrivals',
}

export const ROLE_LABEL = {
  super_admin: 'Super Admin',
  receptionist: 'Receptionist',
  pa: 'Personal Assistant',
  executive: 'Executive',
}
