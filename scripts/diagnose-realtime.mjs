/**
 * Reproduces the PA "Send up" -> reception update path headlessly.
 * Run with:  npm run diagnose:realtime
 *
 * Separates the three things that can go wrong and are hard to tell
 * apart in a browser:
 *   1. the PA's update never happened (policy or trigger refused it)
 *   2. the update happened but Realtime never delivered the event
 *   3. the event was delivered but the reception UI ignored it
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const MARKER = 'ZZ REALTIME DIAGNOSTIC'

const mk = () => createClient(url, key, { auth: { persistSession: false } })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function signIn(email, password, label) {
  const client = mk()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`Cannot sign in as ${label}: ${error.message}`)
    process.exit(1)
  }
  return client
}

const admin = await signIn(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD, 'admin')
const desk = await signIn(process.env.TEST_RECEPTION_EMAIL, process.env.TEST_RECEPTION_PASSWORD, 'reception')
const pa = await signIn(process.env.TEST_PA_EMAIL, process.env.TEST_PA_PASSWORD, 'PA')

const { data: deskUser } = await desk.auth.getUser()

// An executive this PA actually covers, otherwise "Send up" is
// correctly refused and the whole test is meaningless.
const { data: assignment } = await pa
  .from('executive_assignments')
  .select('executive_id')
  .limit(1)
  .maybeSingle()

if (!assignment) {
  console.error('This PA covers no executives. Assign one under Admin > PA assignments.')
  process.exit(1)
}

console.log('\n1. RECEPTION SUBSCRIBES TO visitors')
const events = []
let subscribeState = 'pending'

const channel = desk
  .channel('diagnostic:visitors')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'visitors' },
    (payload) => {
      events.push(payload)
      console.log(`   <- received ${payload.eventType} for ${payload.new?.id ?? payload.old?.id}`)
    },
  )
  .subscribe((status, err) => {
    subscribeState = status
    console.log(`   channel status: ${status}${err ? ' — ' + err.message : ''}`)
  })

// Give the socket time to connect and the server to accept the topic.
for (let i = 0; i < 30 && subscribeState !== 'SUBSCRIBED'; i++) await wait(300)

if (subscribeState !== 'SUBSCRIBED') {
  console.error(`\n   FAILED: channel never subscribed (last status: ${subscribeState})`)
  console.error('   Realtime is not reaching this project at all.')
  process.exit(1)
}

console.log('\n2. RECEPTION CHECKS A VISITOR IN')
const { data: visit, error: insertError } = await desk
  .from('visitors')
  .insert({
    full_name: MARKER,
    executive_id: assignment.executive_id,
    created_by: deskUser.user.id,
  })
  .select('id, admitted_at')
  .single()

if (insertError) {
  console.error('   FAILED to create the visit:', insertError.message)
  process.exit(1)
}
console.log(`   created ${visit.id}`)

await wait(2500)
const insertEvents = events.filter((e) => e.eventType === 'INSERT')
console.log(`   INSERT events reception received: ${insertEvents.length}`)

console.log('\n3. PA SENDS THE VISITOR UP')
const before = events.length
const { data: admitted, error: admitError } = await pa
  .from('visitors')
  .update({ admitted_at: new Date().toISOString() })
  .eq('id', visit.id)
  .select('id, admitted_at, admitted_by')
  .maybeSingle()

if (admitError) {
  console.log(`   the update was REFUSED: ${admitError.message}`)
} else if (!admitted) {
  console.log('   the update matched ZERO rows (RLS filtered it, no error raised)')
} else {
  console.log(`   update succeeded, admitted_at = ${admitted.admitted_at}`)
}

// Independent confirmation, read as the admin so RLS cannot hide it.
const { data: truth } = await admin
  .from('visitors')
  .select('admitted_at, admitted_by')
  .eq('id', visit.id)
  .single()
console.log(`   database now says admitted_at = ${truth.admitted_at ?? 'NULL'}`)

await wait(4000)
const updateEvents = events.slice(before).filter((e) => e.eventType === 'UPDATE')
console.log(`   UPDATE events reception received: ${updateEvents.length}`)

console.log('\nRESULT')
if (!truth.admitted_at) {
  console.log('  The admission never reached the database.')
  console.log('  Problem is the PA policy or the guard trigger, not Realtime.')
} else if (updateEvents.length === 0) {
  console.log('  The admission was saved, but reception was never told.')
  console.log('  Problem is Realtime delivery of UPDATE events on visitors.')
  if (insertEvents.length > 0) {
    console.log('  INSERTs do arrive, so the channel and RLS are fine —')
    console.log('  this points at REPLICA IDENTITY on public.visitors.')
  } else {
    console.log('  No INSERTs arrived either: the table may not be in the')
    console.log('  supabase_realtime publication for this project.')
  }
} else {
  console.log('  Working: the admission saved and reception received the UPDATE.')
  console.log('  If the browser still does not refresh, the problem is client-side.')
}

await desk.removeChannel(channel)
await admin.from('visitors').delete().like('full_name', `${MARKER}%`)
console.log('\ncleaned up\n')
process.exit(0)
