/**
 * Step 2 connection check.
 * Run with:  npm run check:db
 *
 * Confirms the project URL resolves, the anon key is accepted, and the
 * Auth and REST services are both live. Safe to re-run any time.
 */
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('FAIL  .env not loaded. Run via `npm run check:db`.')
  process.exit(1)
}

const mask = (s) => `${s.slice(0, 6)}...${s.slice(-4)}`
console.log(`Project : ${url}`)
console.log(`Anon key: ${mask(key)}\n`)

let failed = false
const check = async (label, path, accept) => {
  try {
    const res = await fetch(`${url}${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    const ok = accept(res.status)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} -> HTTP ${res.status}`)
    if (!ok) {
      failed = true
      console.log(`      ${(await res.text()).slice(0, 200)}`)
    }
  } catch (err) {
    failed = true
    console.log(`FAIL  ${label} -> ${err.name}: ${err.message}`)
  }
}

await check('Auth service', '/auth/v1/health', (s) => s === 200)

// Query a table that does not exist. PostgREST rejects a bad key with 401
// BEFORE it ever looks for the table, so a 404 here proves the anon key was
// accepted. Once Step 3 creates real tables this still passes unchanged.
await check(
  'Database (PostgREST)',
  '/rest/v1/__connection_probe__?select=*',
  (s) => s === 404 || s === 200,
)

console.log(
  failed
    ? '\nSomething is wrong. Check the URL and anon key in .env.'
    : '\nConnection OK. Supabase is reachable and the key is valid.',
)
process.exit(failed ? 1 : 0)
