import { createClient } from '@supabase/supabase-js'

/**
 * Single shared Supabase client for the whole app.
 *
 * Both values come from .env (git-ignored). The anon key is safe to ship
 * in the browser -- it grants nothing on its own. Row Level Security,
 * which we set up in Step 4, is what actually protects the data.
 * The service_role key must NEVER appear in this project.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Supabase is not configured.\n' +
      'Copy .env.example to .env and fill in VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY from your Supabase dashboard ' +
      '(Project Settings > API), then restart `npm run dev`.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Required for password recovery. The link in a reset email carries
    // its credentials in the URL, and with this off they are ignored --
    // the user lands on the reset page with no way to prove who they
    // are. It was off originally because nothing but password sign-in
    // was in use.
    detectSessionInUrl: true,
  },
})
