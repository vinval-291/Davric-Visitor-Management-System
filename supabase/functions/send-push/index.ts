/**
 * send-push — delivers a visitor alert to a person's devices.
 *
 * Called by the browser that caused the alert, right after the
 * database has created the notification rows. The sender is online by
 * definition, which is why this does not need a database webhook.
 *
 * Note the division of responsibility: the notification ROW is
 * created by a database trigger and is guaranteed. This push is
 * best-effort delivery on top of it. If the push fails, the alert is
 * still waiting in the app when it is next opened — nothing is lost,
 * it is simply less timely.
 *
 * Deploy:
 *   supabase functions deploy send-push
 *
 * Secrets required:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // The caller must be a signed-in user. Without this anyone could
    // make the system send arbitrary push notifications.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'not authenticated' }, 401)

    const asCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: caller } = await asCaller.auth.getUser()
    if (!caller?.user) return json({ error: 'not authenticated' }, 401)

    const { visitor_id } = await req.json()
    if (!visitor_id) return json({ error: 'visitor_id is required' }, 400)

    // Service role from here: the caller must not be able to read
    // other people's device subscriptions, and RLS correctly hides
    // them. This function is the only thing that may see them.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Only unread alerts: a visitor already dealt with should not
    // buzz someone's phone.
    const { data: notifications, error: notifyError } = await admin
      .from('notifications')
      .select('id, recipient_id, message, type')
      .eq('visitor_id', visitor_id)
      .eq('is_read', false)

    if (notifyError) return json({ error: notifyError.message }, 500)
    if (!notifications?.length) return json({ sent: 0, reason: 'nothing to send' })

    const recipients = [...new Set(notifications.map((n) => n.recipient_id))]
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', recipients)

    if (!subscriptions?.length) return json({ sent: 0, reason: 'no devices registered' })

    const titleFor = (type: string) =>
      type === 'visitor_admitted' ? 'Visitor may go up' : 'Visitor has arrived'

    let sent = 0
    const expired: string[] = []

    await Promise.all(
      subscriptions.map(async (sub) => {
        const alert = notifications.find((n) => n.recipient_id === sub.user_id)
        if (!alert) return

        const payload = JSON.stringify({
          title: titleFor(alert.type),
          body: alert.message,
          tag: `visitor-${visitor_id}`,
          url: alert.type === 'visitor_admitted' ? '/reception' : '/arrivals',
        })

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 600, urgency: 'high' },
          )
          sent++
        } catch (err) {
          // 404/410 mean the browser threw the subscription away:
          // the app was uninstalled, or site data was cleared. Keeping
          // these would mean retrying a dead endpoint forever.
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) expired.push(sub.id)
          else console.error('push failed', status, (err as Error).message)
        }
      }),
    )

    if (expired.length) {
      await admin.from('push_subscriptions').delete().in('id', expired)
    }

    return json({ sent, devices: subscriptions.length, pruned: expired.length })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
