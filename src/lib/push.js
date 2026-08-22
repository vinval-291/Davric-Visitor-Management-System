import { supabase } from './supabase.js'

/**
 * Web Push: alerts that reach a phone with the app closed.
 *
 * Everything else in this app needs the page alive to hold a realtime
 * socket. A phone freezes a backgrounded app within seconds and a
 * closed app has no socket at all, so a PA with the phone in their
 * pocket was never told. Push is delivered to the operating system,
 * which wakes the service worker regardless.
 *
 * The subscription belongs to a device, not a person: subscribing on
 * a phone does not subscribe the desktop, and each has to be enabled
 * separately.
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY)

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

/** The VAPID key travels as base64url; PushManager wants raw bytes. */
function toUint8Array(base64url) {
  const padded = base64url.padEnd(
    base64url.length + ((4 - (base64url.length % 4)) % 4),
    '=',
  )
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function getPushState() {
  if (!pushSupported()) return 'unsupported'
  if (!pushConfigured) return 'not-configured'
  if (Notification.permission === 'denied') return 'blocked'

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return 'no-service-worker'

  const subscription = await registration.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot receive push alerts.')
  if (!pushConfigured) {
    throw new Error('Push is not configured for this deployment.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed.')
  }

  const registration = await navigator.serviceWorker.ready

  // Reuse an existing subscription rather than creating a second one
  // for the same browser, which would deliver every alert twice.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome: no silent pushes
      applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY),
    }))

  const raw = subscription.toJSON()
  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) throw new Error('Sign in before enabling alerts.')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: session.user.id,
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) throw new Error(error.message)
  return 'on'
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return 'off'

  const { endpoint } = subscription.toJSON()
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return 'off'
}

/**
 * Ask the server to push this visitor's alert to its recipients.
 *
 * Deliberately never throws. The notification row is already saved by
 * a database trigger, so a failed push means a less timely alert, not
 * a lost one — and it must not break the check-in the receptionist
 * just completed.
 */
export async function sendPushFor(visitorId) {
  if (!pushConfigured || !visitorId) return
  try {
    await supabase.functions.invoke('send-push', {
      body: { visitor_id: visitorId },
    })
  } catch (err) {
    console.warn('push dispatch failed', err)
  }
}
