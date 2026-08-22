/**
 * Automated security test suite.
 * Run with:  npm run test:security
 *
 * Signs in as each role against the real database and attempts things
 * that role must not be able to do. Everything runs through the public
 * anon key over the normal API, exactly as a browser would -- so this
 * tests the policies themselves, not the user interface in front of
 * them. A passing UI proves nothing if the API is open underneath.
 *
 * Covers section 16 "Security Testing" of the project document.
 *
 * Needs these in .env (the accounts created in Step 5):
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD
 *   TEST_RECEPTION_EMAIL / TEST_RECEPTION_PASSWORD
 *   TEST_PA_EMAIL / TEST_PA_PASSWORD
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

const MARKER = 'ZZ SECURITY TEST'
let passed = 0
let failed = 0

const pad = (s) => String(s).padEnd(58)

function record(good, label, detail) {
  if (good) {
    passed++
    console.log(`  PASS  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${pad(label)} ${detail ?? ''}`)
  }
}

/** The write must be refused. */
async function mustFail(label, promise) {
  const { error } = await promise
  record(Boolean(error), label, error ? '' : 'the write was ALLOWED')
}

/** The write must succeed. */
async function mustPass(label, promise) {
  const { error } = await promise
  record(!error, label, error?.message)
}

/**
 * The write must have no effect.
 *
 * A denied INSERT raises an error, but a denied UPDATE or DELETE
 * simply matches zero rows and reports success. Both are correct
 * refusals, so the honest assertion is "nothing changed" rather than
 * "an error was raised" -- .select() makes PostgREST return the rows
 * it actually wrote, which is the only reliable signal.
 */
async function mustHaveNoEffect(label, query) {
  const { data, error } = await query.select('id')
  const written = (data ?? []).length
  record(
    Boolean(error) || written === 0,
    label,
    `${written} row(s) were written`,
  )
}

/** The read must return exactly this many rows. */
async function mustSee(label, query, expected) {
  const { count, error } = await query
  if (error) return record(false, label, error.message)
  record(count === expected, label, `saw ${count}, expected ${expected}`)
}

async function signIn(email, password) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error(`\nCannot sign in as ${email}\n  ${error.message}\n`)
    if (/invalid login/i.test(error.message)) {
      console.error(
        'The password in .env does not match this account. Either:\n' +
          '  - Supabase dashboard > Authentication > Users > select the user\n' +
          '    > "..." menu > Reset password, and set it to match .env, or\n' +
          '  - correct the value in .env to the password you originally set.\n' +
          '\nIf the account was never confirmed, tick "Auto Confirm User"\n' +
          'when creating it, or confirm it from the same menu.\n',
      )
    }
    process.exit(1)
  }
  return { client, userId: data.user.id }
}

// ---------------------------------------------------------------

const need = [
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD',
  'TEST_RECEPTION_EMAIL', 'TEST_RECEPTION_PASSWORD',
  'TEST_PA_EMAIL', 'TEST_PA_PASSWORD',
]
const missing = need.filter((k) => !process.env[k])
if (missing.length) {
  console.error('Missing from .env:\n  ' + missing.join('\n  '))
  process.exit(1)
}

const anon = createClient(url, key, { auth: { persistSession: false } })
const admin = await signIn(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD)
const desk = await signIn(process.env.TEST_RECEPTION_EMAIL, process.env.TEST_RECEPTION_PASSWORD)
const pa = await signIn(process.env.TEST_PA_EMAIL, process.env.TEST_PA_PASSWORD)

// Two executives: one the PA covers, one they do not.
const { data: assigned } = await pa.client
  .from('executive_assignments')
  .select('executive_id')
  .limit(1)
  .maybeSingle()

const { data: allExecs } = await admin.client
  .from('executives')
  .select('id, full_name')
  .eq('is_active', true)

const coveredId = assigned?.executive_id
const uncoveredId = allExecs?.find((e) => e.id !== coveredId)?.id

if (!coveredId || !uncoveredId) {
  console.error(
    'Need at least two active executives, with a PA assigned to one.\n' +
      'Assign one under Admin > PA assignments, then re-run.',
  )
  process.exit(1)
}

// ---------------------------------------------------------------

console.log('\nUNAUTHENTICATED')
for (const table of ['visitors', 'profiles', 'notifications', 'audit_logs']) {
  const { data, error } = await anon.from(table).select('*').limit(1)
  record(
    Boolean(error) || (data ?? []).length === 0,
    `anon cannot read ${table}`,
    'rows were returned',
  )
}
await mustFail(
  'anon cannot create a visitor',
  anon.from('visitors').insert({
    full_name: MARKER,
    executive_id: coveredId,
    executive_name_snapshot: 'forged',
  }),
)

// ---------------------------------------------------------------

console.log('\nRECEPTIONIST')
await mustPass(
  'can register a visitor',
  desk.client.from('visitors').insert({
    full_name: `${MARKER} desk`,
    executive_id: coveredId,
    created_by: desk.userId,
  }),
)
await mustFail(
  'cannot file a visit under another user',
  desk.client.from('visitors').insert({
    full_name: `${MARKER} forged`,
    executive_id: coveredId,
    created_by: admin.userId,
  }),
)
await mustSee(
  'sees only their own profile',
  desk.client.from('profiles').select('*', { count: 'exact', head: true }),
  1,
)
await mustSee(
  'cannot read the audit log',
  desk.client.from('audit_logs').select('*', { count: 'exact', head: true }),
  0,
)
await mustSee(
  'cannot read PA assignments',
  desk.client
    .from('executive_assignments')
    .select('*', { count: 'exact', head: true }),
  0,
)
await mustFail(
  'cannot promote themselves to super admin',
  desk.client
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', desk.userId),
)
await mustFail(
  'cannot create a department',
  desk.client.from('departments').insert({ name: `${MARKER} dept` }),
)
await mustFail(
  'cannot create an executive',
  desk.client.from('executives').insert({ full_name: `${MARKER} exec` }),
)

const { data: deskVisit } = await desk.client
  .from('visitors')
  .select('id')
  .eq('full_name', `${MARKER} desk`)
  .maybeSingle()

await mustFail(
  'cannot alter a visit record after check-in',
  desk.client
    .from('visitors')
    .update({ full_name: 'changed name' })
    .eq('id', deskVisit.id),
)
await mustFail(
  'cannot backdate an arrival time',
  desk.client
    .from('visitors')
    .update({ check_in_time: '2020-01-01T09:00:00Z' })
    .eq('id', deskVisit.id),
)
await mustHaveNoEffect(
  'cannot delete a visit record',
  desk.client.from('visitors').delete().eq('id', deskVisit.id),
)
await mustPass(
  'can check a visitor out',
  desk.client
    .from('visitors')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', deskVisit.id),
)
await mustFail(
  'cannot check the same visitor out twice',
  desk.client
    .from('visitors')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', deskVisit.id),
)

// ---------------------------------------------------------------

console.log('\nPERSONAL ASSISTANT')

// A visit for an executive this PA does NOT cover.
const { data: hidden } = await admin.client
  .from('visitors')
  .insert({
    full_name: `${MARKER} hidden`,
    executive_id: uncoveredId,
    created_by: admin.userId,
  })
  .select('id')
  .single()

const { count: paCanSee } = await pa.client
  .from('visitors')
  .select('*', { count: 'exact', head: true })
  .eq('id', hidden.id)
record(
  paCanSee === 0,
  'cannot see visits for executives they do not cover',
  `saw ${paCanSee}`,
)

await mustFail(
  'cannot register a visitor',
  pa.client.from('visitors').insert({
    full_name: `${MARKER} by pa`,
    executive_id: coveredId,
    created_by: pa.userId,
  }),
)
await mustFail(
  'cannot forge a visitor notification',
  pa.client.from('notifications').insert({
    visitor_id: hidden.id,
    recipient_id: pa.userId,
    message: 'forged alert',
  }),
)
await mustSee(
  'cannot read the audit log',
  pa.client.from('audit_logs').select('*', { count: 'exact', head: true }),
  0,
)
await mustFail(
  'cannot change their own role',
  pa.client.from('profiles').update({ role: 'super_admin' }).eq('id', pa.userId),
)

const { error: uploadError } = await pa.client.storage
  .from('signatures')
  .upload(`test/${crypto.randomUUID()}.png`, new Blob([1]), {
    contentType: 'image/png',
  })
record(Boolean(uploadError), 'cannot upload to the signature store')

// ---------------------------------------------------------------

console.log('\nSUPER ADMIN')
await mustHaveNoEffect(
  'cannot delete an audit entry',
  admin.client.from('audit_logs').delete().neq('id', 0),
)
await mustHaveNoEffect(
  'cannot edit an audit entry',
  admin.client.from('audit_logs').update({ action: 'tampered' }).neq('id', 0),
)

// The visit deleted above must genuinely still be there.
const { count: survived } = await admin.client
  .from('visitors')
  .select('*', { count: 'exact', head: true })
  .eq('id', deskVisit.id)
record(survived === 1, 'the visit the receptionist tried to delete survived')
const { count: adminProfiles } = await admin.client
  .from('profiles')
  .select('*', { count: 'exact', head: true })
record(adminProfiles >= 3, 'can see every user profile', `saw ${adminProfiles}`)

// ---------------------------------------------------------------

console.log('\nCLEANUP')
const { error: cleanupError } = await admin.client
  .from('visitors')
  .delete()
  .like('full_name', `${MARKER}%`)
record(!cleanupError, 'test records removed', cleanupError?.message)

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed ? 1 : 0)
