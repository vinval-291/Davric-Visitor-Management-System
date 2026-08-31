/**
 * The browser's install prompt, captured once and shared.
 *
 * Chrome fires beforeinstallprompt once, early, and the event can only
 * be used once. Two components listening separately means whichever
 * loads second never sees it, and calling prompt() twice on the same
 * event throws. So it is captured here at module load -- imported from
 * main.jsx so the listener exists before the event can fire -- and
 * everything else subscribes.
 */
let deferred = null
const listeners = new Set()

const emit = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export const canPrompt = () => Boolean(deferred)

export function subscribeToInstall(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  emit()
  return outcome
}

/** Running as an installed app rather than in a browser tab. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/** iPhone and iPad, which install only through Safari's Share menu. */
export function isIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; touch points are the giveaway.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Safari is the only iOS browser that can install a web app. */
export function isIosSafari() {
  return isIos() && !/crios|fxios|edgios|opt\//i.test(navigator.userAgent)
}
