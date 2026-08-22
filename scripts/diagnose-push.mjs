/**
 * End-to-end check of the push pipeline, minus the phone.
 * Run with:  npm run diagnose:push
 *
 * Answers, in order, the questions that "it still doesn't work"
 * cannot distinguish between:
 *
 *   1. has any device registered for push at all?
 *   2. is the send-push function deployed and reachable?
 *   3. are its VAPID secrets set correctly?
 *   4. does it find the alert and the device, and accept the send?
 *
 * If all four pass, the failure is on the phone itself and not in
 * anything this project controls.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const MARKER = 'ZZ PUSH DIAGNOSTIC'

const mk = () => createClient(url, key, { auth: { persistSession: false } })

async function signIn(email, password, label) {
  const client = mk()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`Cannot sign in as ${label}: ${error.message}`)
    process.exit(1)
  }
  return { client, id: data.user.id, email }
}

console.log('\n1. THE PUBLIC KEY THIS MACHINE BUILDS WITH')
const vapid = process.env.VITE_VAPID_PUBLIC_KEY
if (!vapid) {
  console.log('   MISSING from .env')
} else {
  const bytes = Buffer.from(vapid, 'base64url')
  console.log(`   ${vapid.length} chars, ${bytes.length} bytes, first byte 0x${bytes[0]?.toString(16)}`)
  console.log(
    bytes.length === 65 && bytes[0] === 4
      ? '   valid P-256 public key'
      : '   INVALID — expected 65 bytes starting 0x04',
  )
  console.log(`   starts ${vapid.slice(0, 12)}…  (compare with Vercel and with VAPID_PUBLIC_KEY in Supabase)`)
}

const admin = await signIn(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, 'admin')
const desk = await signIn(process.env.TEST_RECEPTION_EMAIL, process.env.TEST_RECEPTION_PASSWORD, 'reception')
const pa = await signIn(process.env.TEST_PA_EMAIL, process.env.TEST_PA_PASSWORD, 'PA')

console.log('\n2. DEVICES REGISTERED FOR PUSH')
console.log('   (each account can only see its own, by design)')
let anyDevice = 0
for (const who of [admin, desk, pa]) {
  const { data, error } = await who.client
    .from('push_subscriptions')
    .select('endpoint, user_agent, created_at')
  if (error) {
    console.log(`   ${who.email.padEnd(38)} ERROR ${error.message}`)
    continue
  }
  anyDevice += data.length
  console.log(`   ${who.email.padEnd(38)} ${data.length} device(s)`)
  for (const d of data) {
    const host = new URL(d.endpoint).host
    console.log(`      via ${host} — ${(d.user_agent ?? '').slice(0, 60)}`)
  }
}

if (anyDevice === 0) {
  console.log('\n   No device has registered. If you enabled it on your phone,')
  console.log('   either it failed silently or the phone is signed in as a')
  console.log('   different account than the three tested here.')
}

console.log('\n3. CREATE AN ALERT AND ASK THE FUNCTION TO SEND IT')
const { data: assignment } = await pa
  .client.from('executive_assignments')
  .select('executive_id')
  .limit(1)
  .maybeSingle()

if (!assignment) {
  console.log('   No PA assignment exists; cannot generate an alert.')
  process.exit(1)
}

const { data: visit, error: visitError } = await desk.client
  .from('visitors')
  .insert({
    full_name: MARKER,
    executive_id: assignment.executive_id,
    created_by: desk.id,
  })
  .select('id')
  .single()

if (visitError) {
  console.log(`   could not create a test visit: ${visitError.message}`)
  process.exit(1)
}
console.log(`   created visit ${visit.id}`)

const { data: result, error: fnError } = await desk.client.functions.invoke(
  'send-push',
  { body: { visitor_id: visit.id } },
)

if (fnError) {
  console.log(`   FUNCTION ERROR: ${fnError.message}`)
  let body = ''
  try {
    body = await fnError.context?.text?.()
  } catch {
    /* ignore */
  }
  if (body) console.log(`   response body: ${body}`)
  console.log('\n   Common causes:')
  console.log('     - the function is not deployed  -> npm run push:deploy')
  console.log('     - VAPID secrets missing/wrong   -> npx supabase secrets list')
  console.log('     - see the real error            -> npm run push:logs')
} else {
  console.log(`   function replied: ${JSON.stringify(result)}`)
  if (result?.sent > 0) {
    console.log('\n   The push was accepted by the push service.')
    console.log('   If the phone showed nothing, the problem is on the device:')
    console.log('   notification permission, battery optimisation, or Do Not Disturb.')
  } else if (result?.reason === 'no devices registered') {
    console.log('\n   The function works, but nobody has a device registered.')
  } else if (result?.reason === 'nothing to send') {
    console.log('\n   No unread alert was found for that visitor.')
  }
}

await admin.client.from('visitors').delete().like('full_name', `${MARKER}%`)
console.log('\ncleaned up\n')
process.exit(0)
