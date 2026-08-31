import { useCallback, useEffect, useState } from 'react'
import {
  canNotify,
  requestNotificationPermission,
  systemNotify,
} from '../lib/sound.js'
import {
  getPushState,
  enablePush,
  pushConfigured,
  pushSupported,
} from '../lib/push.js'
import {
  canPrompt,
  promptInstall,
  subscribeToInstall,
  isStandalone,
  isIos,
  isIosSafari,
} from '../lib/installPrompt.js'
import Logo from './Logo.jsx'

/**
 * First-run guide for getting alerts working on a device.
 *
 * Written as four steps because that is genuinely how many there are,
 * and people stall at different ones: an iPhone cannot receive alerts
 * at all until the app is on the Home Screen, an Android phone can but
 * still needs permission, and a desktop needs neither. Each step
 * detects its own state rather than asking the reader to work out
 * where they have got to.
 *
 * The last step is a real test. Telling someone it is set up is not
 * the same as them seeing it work, and a PA who has not seen it work
 * will keep asking reception to phone them.
 */
export default function AlertSetupGuide({ onClose }) {
  const [installed, setInstalled] = useState(isStandalone)
  const [installable, setInstallable] = useState(canPrompt)
  const [permission, setPermission] = useState(
    canNotify() ? Notification.permission : 'unsupported',
  )
  const [push, setPush] = useState('checking')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [tested, setTested] = useState(false)

  const ios = isIos()
  const iosSafari = isIosSafari()

  const refresh = useCallback(() => {
    setInstalled(isStandalone())
    setInstallable(canPrompt())
    if (canNotify()) setPermission(Notification.permission)
    getPushState().then(setPush)
  }, [])

  useEffect(() => {
    refresh()
    return subscribeToInstall(refresh)
  }, [refresh])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleInstall() {
    setBusy('install')
    await promptInstall()
    refresh()
    setBusy(null)
  }

  async function handlePermission() {
    setBusy('permission')
    setPermission(await requestNotificationPermission())
    setBusy(null)
  }

  async function handleEnable() {
    setBusy('push')
    setError(null)
    try {
      setPush(await enablePush())
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  function handleTest() {
    setBusy('test')
    setTested(true)
    setTimeout(async () => {
      await systemNotify({
        title: 'Alerts are working',
        body: 'This is how a visitor arrival will look.',
        tag: 'vms-setup-test',
        force: true,
      })
      setBusy(null)
    }, 4000)
  }

  // On a phone the app must be installed first; on a desktop it is a
  // convenience, so the step is marked optional rather than blocking.
  const installRequired = ios
  const installDone = installed || (!ios && !installable)
  const permissionDone = permission === 'granted'
  const pushDone = push === 'on'
  const allDone = pushDone && tested

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set up visitor alerts"
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-steel-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Logo size="sm" />
              <h2 className="mt-3 text-xl font-semibold text-ink">
                Set up visitor alerts
              </h2>
              <p className="mt-1 text-sm text-steel-500">
                Four steps, once per device. Takes about a minute.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-2xl leading-none text-steel-400 transition hover:bg-steel-100"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="divide-y divide-steel-100">
          {/* 1 — install */}
          <Step
            n={1}
            title="Install the app"
            done={installDone}
            optional={!installRequired}
          >
            {installed ? (
              <p className="text-sm text-steel-500">
                Already installed on this device.
              </p>
            ) : ios ? (
              iosSafari ? (
                <>
                  <p className="text-sm text-steel-600">
                    On iPhone and iPad, alerts only work once the app is on
                    your Home Screen.
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-steel-700">
                    <li>
                      Tap the <strong>Share</strong> button at the bottom of
                      Safari
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>
                    </li>
                    <li>
                      Tap <strong>Add</strong>, then open the app from your
                      Home Screen and sign in again
                    </li>
                  </ol>
                </>
              ) : (
                <p className="text-sm text-brand-700">
                  Open this page in <strong>Safari</strong> to install it.
                  Chrome and other browsers on iPhone cannot add apps to the
                  Home Screen.
                </p>
              )
            ) : installable ? (
              <>
                <p className="text-sm text-steel-600">
                  Runs in its own window and opens instantly.
                </p>
                <Action
                  onClick={handleInstall}
                  busy={busy === 'install'}
                  label="Install app"
                />
              </>
            ) : (
              <p className="text-sm text-steel-500">
                Not needed on this device — alerts work without installing.
              </p>
            )}
          </Step>

          {/* 2 — permission */}
          <Step n={2} title="Allow notifications" done={permissionDone}>
            {permission === 'granted' ? (
              <p className="text-sm text-steel-500">Allowed.</p>
            ) : permission === 'denied' ? (
              <p className="text-sm text-brand-700">
                Notifications are blocked for this site. Allow them in your
                browser or phone settings, then reopen this guide.
              </p>
            ) : permission === 'unsupported' ? (
              <p className="text-sm text-steel-500">
                This browser does not support notifications.
              </p>
            ) : (
              <>
                <p className="text-sm text-steel-600">
                  Your phone will ask you to confirm.
                </p>
                <Action
                  onClick={handlePermission}
                  busy={busy === 'permission'}
                  label="Allow notifications"
                />
              </>
            )}
          </Step>

          {/* 3 — push */}
          <Step n={3} title="Turn on alerts for this device" done={pushDone}>
            {!pushSupported() || !pushConfigured ? (
              <p className="text-sm text-steel-500">
                Not available on this device.
              </p>
            ) : pushDone ? (
              <p className="text-sm text-steel-500">
                On. Alerts reach you even with the app closed.
              </p>
            ) : (
              <>
                <p className="text-sm text-steel-600">
                  Without this, alerts only arrive while the app is open — a
                  phone freezes a backgrounded app within seconds.
                </p>
                <Action
                  onClick={handleEnable}
                  busy={busy === 'push'}
                  label="Turn on alerts"
                  disabled={!permissionDone}
                />
                {!permissionDone && (
                  <p className="mt-1.5 text-xs text-steel-400">
                    Finish step 2 first.
                  </p>
                )}
                {error && (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                    {error}
                  </p>
                )}
              </>
            )}
          </Step>

          {/* 4 — prove it */}
          <Step n={4} title="Check that it works" done={tested}>
            {tested && busy !== 'test' ? (
              <p className="text-sm text-steel-600">
                Sent. If nothing appeared, check Do Not Disturb and your
                phone&rsquo;s notification settings for this app.
              </p>
            ) : (
              <>
                <p className="text-sm text-steel-600">
                  Sends a test alert in 4 seconds. Lock your phone or switch to
                  another app as soon as you tap it.
                </p>
                <Action
                  onClick={handleTest}
                  busy={busy === 'test'}
                  busyLabel="Switch away now…"
                  label="Send a test alert"
                  disabled={!pushDone && !permissionDone}
                />
              </>
            )}
          </Step>
        </div>

        <div className="border-t border-steel-200 p-6">
          {allDone && (
            <p className="mb-3 rounded-lg bg-inside-50 px-4 py-3 text-sm font-medium text-inside-700 ring-1 ring-inside-500/30">
              All set. You will be told the moment a visitor arrives for you.
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {allDone ? 'Done' : 'Close'}
          </button>
          {!allDone && (
            <p className="mt-2 text-center text-xs text-steel-400">
              You can reopen this any time from the 🔔 button.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, done, optional, children }) {
  return (
    <div className="flex gap-4 p-6">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          done
            ? 'bg-inside-500 text-white'
            : 'bg-steel-100 text-steel-600 ring-1 ring-steel-300'
        }`}
        aria-hidden="true"
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {title}
          {optional && !done && (
            <span className="rounded-full bg-steel-100 px-2 py-0.5 text-xs font-medium text-steel-500">
              Optional
            </span>
          )}
        </h3>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}

function Action({ onClick, busy, label, busyLabel, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="mt-2.5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
    >
      {busy ? (busyLabel ?? 'Working…') : label}
    </button>
  )
}
