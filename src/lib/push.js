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

/**
 * Bounds a promise that can otherwise hang forever.
 *
 * navigator.serviceWorker.ready never rejects -- if registration is
 * stuck it simply never settles. pushManager.subscribe() behaves the
 * same way when the device cannot reach its push service. Without a
 * timeout the interface sits on "Working..." with nothing to report,
 * which tells the user less than an error would.
 */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ])
}

/** A registration that exists but is still installing is not usable. */
async function activeRegistration() {
  const registration = await withTimeout(
    navigator.serviceWorker.getRegistration(),
    5000,
    'Could not read the service worker. Reload the page and try again.',
  )

  // Nothing registered yet: register now rather than telling the user
  // to reload and hope. This is the difference between a dead end and
  // a button that works the first time it is pressed.
  if (!registration) {
    const fresh = await withTimeout(
      navigator.serviceWorker.register('/sw.js', { scope: '/' }),
      15000,
      'The app could not start its background service. Reload the page and try again.',
    ).catch((err) => {
      throw new Error(`Could not start the background service: ${err.message}`)
    })

    return withTimeout(
      navigator.serviceWorker.ready.then(() => fresh),
      15000,
      'The background service was installed but did not start. Close the app completely, reopen it, and try again.',
    )
  }

  if (registration.active) return registration

  return withTimeout(
    navigator.serviceWorker.ready,
    10000,
    'The app is still starting up in the background. Close it completely, reopen it, and try again.',
  )
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

/** Human-readable reason, used when enabling fails. */
export async function pushDebug() {
  const parts = []
  parts.push(`permission=${canNotify() ? Notification.permission : 'n/a'}`)
  parts.push(`configured=${pushConfigured}`)
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    parts.push(
      `sw=${reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'waiting') : 'none'}`,
    )
    parts.push(`controller=${Boolean(navigator.serviceWorker.controller)}`)
  } catch {
    parts.push('sw=error')
  }
  return parts.join(' · ')
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot receive push alerts.')
  if (!pushConfigured) {
    throw new Error('Push is not configured for this deployment.')
  }

  const permission = await withTimeout(
    Notification.requestPermission(),
    60000,
    'No answer to the notification request.',
  )
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your phone or browser settings, then try again.'
        : 'Notifications were not allowed.',
    )
  }

  const registration = await activeRegistration()

  // Reuse an existing subscription rather than creating a second one
  // for the same browser, which would deliver every alert twice.
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    let key
    try {
      key = toUint8Array(VAPID_PUBLIC_KEY)
    } catch {
      throw new Error('The push key for this deployment is malformed.')
    }
    if (key.length !== 65) {
      throw new Error(
        `The push key for this deployment is the wrong length (${key.length}, expected 65). Check VITE_VAPID_PUBLIC_KEY in Vercel.`,
      )
    }

    subscription = await withTimeout(
      registration.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome: no silent pushes
        applicationServerKey: key,
      }),
      25000,
      'The phone could not reach its push service. Check the connection and try again.',
    )
  }

  const raw = subscription.toJSON()
  const { data: session } = await supabase.auth.getUser()
  if (!session?.user) throw new Error('Sign in before enabling alerts.')

  const { error } = await withTimeout(
    supabase.from('push_subscriptions').upsert(
      {
        user_id: session.user.id,
        endpoint: raw.endpoint,
        p256dh: raw.keys.p256dh,
        auth: raw.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    ),
    15000,
    'Saving this device timed out. Check the connection and try again.',
  )

  if (error) throw new Error(error.message)
  return 'on'
}

export async function disablePush() {
  const registration = await withTimeout(
    navigator.serviceWorker.getRegistration(),
    5000,
    'Could not read the service worker.',
  )
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
