/**
 * Anonymous-access security check.
 * Run with:  npm run check:schema
 *
 * Hits every table with the public anon key, exactly as an
 * unauthenticated browser would. The ONLY acceptable outcome is that
 * no table returns data.
 *
 *   200 + rows  -> LEAKING. Real visitor data is public. Stop everything.
 *   200 + empty -> blocked by RLS (table exists, no policy grants anon)
 *   401 / 403   -> blocked by grants (anon has no privilege at all)
 *   404         -> invisible to anon (table missing, or hidden from the
 *                  PostgREST schema cache once anon's grants are revoked)
 *
 * After migration 0002 the expected result is 401 or 404 across the
 * board. To confirm the tables genuinely EXIST, run
 * supabase/verify/0002_verify_rls.sql in the Supabase SQL Editor --
 * that reads the catalog directly and cannot be fooled.
 */
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('FAIL  .env not loaded. Run via `npm run check:schema`.')
  process.exit(1)
}

const TABLES = [
  'departments',
  'profiles',
  'executives',
  'executive_assignments',
  'visitors',
  'notifications',
  'audit_logs',
]

let leaking = 0
let unexpected = 0

for (const table of TABLES) {
  const pad = table.padEnd(23)
  let res
  try {
    res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
  } catch (err) {
    unexpected++
    console.log(`ERROR    ${pad} ${err.name}: ${err.message}`)
    continue
  }

  if (res.status === 200) {
    const rows = await res.json().catch(() => [])
    if (Array.isArray(rows) && rows.length > 0) {
      leaking++
      console.log(`LEAKING  ${pad} readable without login!`)
    } else {
      console.log(`BLOCKED  ${pad} RLS returns no rows to anon`)
    }
  } else if (res.status === 401 || res.status === 403) {
    console.log(`BLOCKED  ${pad} anon has no grant (HTTP ${res.status})`)
  } else if (res.status === 404) {
    console.log(`BLOCKED  ${pad} not exposed to anon (HTTP 404)`)
  } else {
    unexpected++
    console.log(`ERROR    ${pad} unexpected HTTP ${res.status}`)
  }
}

console.log('')
if (leaking) {
  console.log(`${leaking} table(s) exposed to the public. Do not proceed.`)
  process.exit(1)
} else if (unexpected) {
  console.log(`${unexpected} table(s) returned an unexpected response.`)
  process.exit(1)
} else {
  console.log('No table leaks data to an anonymous visitor.')
  console.log('Confirm the tables exist with supabase/verify/0002_verify_rls.sql.')
}
