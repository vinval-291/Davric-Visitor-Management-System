/**
 * Explicit service-worker registration.
 *
 * Registration used to be a side effect of the update banner, which
 * lives inside AppShell — so it only ran once a dashboard mounted,
 * and if it failed nothing said so. A device then reported
 * "Service worker: not registered" with no way to find out why.
 *
 * This runs at startup instead, and keeps the outcome so the
 * diagnostics panel can show it.
 */
let status = { state: 'pending', error: null }

export const swStatus = () => status

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    status = { state: 'unsupported', error: null }
    return
  }

  // The service worker is only built for production. In dev there is
  // no /sw.js to register, and a failed fetch would look like a fault.
  if (!import.meta.env.PROD) {
    status = { state: 'skipped in development', error: null }
    return
  }

  // Wait for load: registering during initial parse competes with the
  // app's own resources on a slow connection, which is exactly the
  // situation a reception tablet is usually in.
  const start = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        status = { state: 'registered', error: null }
        return registration.update().catch(() => {})
      })
      .catch((err) => {
        status = { state: 'failed', error: err.message }
        console.error('Service worker registration failed:', err)
      })
  }

  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
