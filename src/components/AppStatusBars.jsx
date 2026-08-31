import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  canPrompt,
  promptInstall,
  subscribeToInstall,
  isStandalone,
  isIos,
} from '../lib/installPrompt.js'

/**
 * The three things a reception device needs to be told about:
 * a lost connection, an available install, and a pending update.
 */

/** Offline is the failure mode this app cannot work around. */
export function OfflineBar() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="alert"
      className="bg-ink px-4 py-2 text-center text-sm font-medium text-white"
    >
      No internet connection — visitors cannot be checked in. Use the paper
      logbook until this clears.
    </div>
  )
}

/**
 * Update prompt rather than a silent reload: replacing the running app
 * mid-form would discard a half-registered visitor.
 */
export function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white">
      <span>A new version is ready.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-brand-700"
      >
        Update now
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-sm underline underline-offset-2"
      >
        Later
      </button>
    </div>
  )
}

/**
 * Install button.
 *
 * Chrome, Edge and Android fire beforeinstallprompt and let us show a
 * real install dialog. Safari on iOS never has and still does not, so
 * the only option there is to explain where the Share menu is.
 */
export function InstallButton({ className = '' }) {
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [, force] = useState(0)

  // The prompt event is captured once in lib/installPrompt.js. Two
  // components listening separately meant whichever mounted second
  // never saw it, and it can only be used once.
  useEffect(() => subscribeToInstall(() => force((n) => n + 1)), [])

  if (isStandalone()) return null

  const ios = isIos()
  if (!canPrompt() && !ios) return null

  async function install() {
    if (ios) return setShowIosHelp(true)
    await promptInstall()
  }

  return (
    <>
      <button
        onClick={install}
        className={`rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50 ${className}`}
      >
        {/* "Install app" costs the header a third of its width on a
            narrow phone, where it sits beside two other controls. */}
        <span className="sm:hidden">Install</span>
        <span className="hidden sm:inline">Install app</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          onClick={() => setShowIosHelp(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-ink">
              Add to your Home Screen
            </h2>
            <p className="mt-1 text-sm text-steel-500">
              iPhone and iPad install apps from the Safari Share menu.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-steel-700">
              <li>
                Open this page in <strong>Safari</strong> — Chrome on iPhone
                cannot install it
              </li>
              <li>
                Tap the <strong>Share</strong> button at the bottom of the
                screen
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>
              </li>
              <li>
                Tap <strong>Add</strong>
              </li>
            </ol>
            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-6 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
