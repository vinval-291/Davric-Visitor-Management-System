import { useEffect, useRef, useState } from 'react'
import {
  PRESETS,
  REPEAT_OPTIONS,
  MAX_SOUND_BYTES,
  loadSettings,
  saveSettings,
  saveCustomSound,
  clearCustomSound,
  invalidateCustomSound,
  playAlert,
  canNotify,
  requestNotificationPermission,
  systemNotify,
  notificationDiagnostics,
} from '../lib/sound.js'

export default function NotificationSettings({ onClose }) {
  const [settings, setSettings] = useState(loadSettings)
  const [error, setError] = useState(null)
  const [permission, setPermission] = useState(
    canNotify() ? Notification.permission : 'unsupported',
  )
  const fileInput = useRef(null)
  const anyFileInput = useRef(null)
  const [diag, setDiag] = useState(null)
  const [testState, setTestState] = useState(null)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    notificationDiagnostics().then(setDiag)
  }, [permission])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)

    // Android's document provider often reports a ringtone with an
    // empty or generic MIME type, so the extension is checked too
    // rather than rejecting a perfectly good file.
    const looksAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|mid|midi)$/i.test(file.name)
    if (!looksAudio) {
      return setError('That does not look like an audio file.')
    }
    if (file.size > MAX_SOUND_BYTES) {
      return setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under 2 MB — an alert only needs a second or two.`,
      )
    }

    try {
      await saveCustomSound(file)
      invalidateCustomSound()
      update({ source: 'custom', customName: file.name })
      playAlert({ source: 'custom', volume: settings.volume, enabled: true })
    } catch {
      setError('Could not save that sound on this device.')
    }
  }

  async function removeCustom() {
    await clearCustomSound()
    invalidateCustomSound()
    update({ source: 'chime', customName: null })
  }

  async function askPermission() {
    setPermission(await requestNotificationPermission())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Alert settings</h2>
            <p className="mt-0.5 text-sm text-steel-500">
              Saved on this device only
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

        <label className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-steel-50 px-4 py-3 ring-1 ring-steel-200">
          <span>
            <span className="font-medium text-ink">Play a sound</span>
            <span className="block text-sm text-steel-500">
              When a visitor arrives
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-6 w-6 accent-brand-600"
          />
        </label>

        <fieldset disabled={!settings.enabled} className="mt-5 disabled:opacity-50">
          <legend className="text-xs font-semibold uppercase tracking-wider text-steel-500">
            Sound
          </legend>

          <div className="mt-2 space-y-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 ring-1 transition ${
                  settings.source === key
                    ? 'bg-brand-50 ring-brand-300'
                    : 'bg-white ring-steel-200 hover:bg-steel-50'
                }`}
              >
                <input
                  type="radio"
                  name="sound"
                  checked={settings.source === key}
                  onChange={() => {
                    update({ source: key })
                    playAlert({ source: key, volume: settings.volume, enabled: true })
                  }}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="flex-1">
                  <span className="font-medium text-ink">{preset.label}</span>
                  <span className="block text-sm text-steel-500">
                    {preset.description}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    playAlert({ source: key, volume: settings.volume, enabled: true })
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-steel-600 ring-1 ring-steel-300 transition hover:bg-steel-50"
                >
                  Play
                </button>
              </label>
            ))}

            {/* Custom sound from the device */}
            <div
              className={`rounded-xl px-4 py-3 ring-1 transition ${
                settings.source === 'custom'
                  ? 'bg-brand-50 ring-brand-300'
                  : 'bg-white ring-steel-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sound"
                  checked={settings.source === 'custom'}
                  disabled={!settings.customName}
                  onChange={() => {
                    update({ source: 'custom' })
                    playAlert({ source: 'custom', volume: settings.volume, enabled: true })
                  }}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="flex-1">
                  <span className="font-medium text-ink">My own sound</span>
                  <span className="block truncate text-sm text-steel-500">
                    {settings.customName ?? 'Choose a file from this device'}
                  </span>
                </span>
                {settings.customName && (
                  <button
                    type="button"
                    onClick={() =>
                      playAlert({ source: 'custom', volume: settings.volume, enabled: true })
                    }
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-steel-600 ring-1 ring-steel-300 transition hover:bg-steel-50"
                  >
                    Play
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
                >
                  {settings.customName ? 'Choose another' : 'Choose a sound'}
                </button>
                {settings.customName && (
                  <button
                    type="button"
                    onClick={removeCustom}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => anyFileInput.current?.click()}
                  className="rounded-lg px-2 py-2 text-sm font-medium text-steel-500 underline underline-offset-2 transition hover:text-steel-800"
                >
                  Can't find your ringtones?
                </button>

                <input
                  ref={fileInput}
                  type="file"
                  accept="audio/*"
                  onChange={handleFile}
                  className="hidden"
                />
                {/* No accept filter: Android shows the media library for
                    audio/* and hides the file browser, which is where
                    ringtone files actually live. */}
                <input
                  ref={anyFileInput}
                  type="file"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              <details className="mt-3 text-xs text-steel-500">
                <summary className="cursor-pointer font-medium text-steel-600">
                  Using a ringtone from your phone
                </summary>
                <p className="mt-2">
                  A website cannot open your phone's ringtone list — only
                  installed apps can do that. You can still choose a ringtone
                  file if you can reach it in storage:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4">
                  <li>
                    Tap <strong>Can't find your ringtones?</strong> above
                  </li>
                  <li>
                    In the picker choose <strong>Browse</strong> or{' '}
                    <strong>Files</strong>, not Music or Audio
                  </li>
                  <li>
                    Go to <strong>Internal storage</strong> →{' '}
                    <strong>Ringtones</strong> or{' '}
                    <strong>Notifications</strong>
                  </li>
                </ol>
                <p className="mt-2">
                  Ringtones that came preinstalled with the phone live in
                  protected system storage and cannot be opened this way. Ones
                  you added or downloaded yourself usually can.
                </p>
              </details>

              <p className="mt-2 text-xs text-steel-400">
                Up to 2 MB. Stored on this device only — set it again on each
                device you use.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
              {error}
            </p>
          )}

          <div className="mt-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-steel-500">
              Keep sounding while someone waits
            </span>
            <div className="mt-2 flex flex-wrap gap-1">
              {REPEAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ repeatSeconds: option.value })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    settings.repeatSeconds === option.value
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                      : 'text-steel-600 ring-1 ring-steel-200 hover:bg-steel-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-steel-400">
              Sounds again until the visitor is sent up, so an alert missed
              during a call is not missed for good.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-steel-500">
              Volume
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
                onMouseUp={() => playAlert({ ...settings, enabled: true })}
                onTouchEnd={() => playAlert({ ...settings, enabled: true })}
                className="h-2 flex-1 accent-brand-600"
              />
              <span className="w-10 text-right text-sm tabular-nums text-steel-600">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </label>
        </fieldset>

        {/* System notifications */}
        <div className="mt-6 rounded-xl bg-steel-50 px-4 py-3 ring-1 ring-steel-200">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="font-medium text-ink">
                Show a notification banner
              </span>
              <span className="block text-sm text-steel-500">
                When the app is open but you are looking at something else
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.systemNotifications}
              onChange={(e) => update({ systemNotifications: e.target.checked })}
              className="h-6 w-6 accent-brand-600"
            />
          </label>

          {settings.systemNotifications && permission !== 'granted' && (
            <div className="mt-3">
              {permission === 'denied' ? (
                <p className="text-sm text-brand-700">
                  Notifications are blocked for this site. Allow them in your
                  browser or phone settings, then reopen this panel.
                </p>
              ) : permission === 'unsupported' ? (
                <p className="text-sm text-steel-500">
                  This browser does not support notification banners.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={askPermission}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Allow notifications
                </button>
              )}
            </div>
          )}
        </div>

        {/* Diagnostics: separates "this device cannot show a
            notification" from "the alert never arrived". */}
        <details className="mt-4 rounded-xl bg-steel-50 px-4 py-3 ring-1 ring-steel-200">
          <summary className="cursor-pointer text-sm font-medium text-steel-700">
            Notifications not appearing?
          </summary>

          <button
            type="button"
            onClick={async () => {
              setTestState('Switch to another app now…')
              setTimeout(async () => {
                const result = await systemNotify({
                  title: 'Test notification',
                  body: 'If you can see this, notifications work on this device.',
                  tag: 'vms-test',
                  force: true,
                })
                setTestState(result ?? 'sent')
              }, 5000)
            }}
            className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Send a test notification in 5 seconds
          </button>
          <p className="mt-1.5 text-xs text-steel-500">
            Press this, then switch to another app or lock the phone. The
            notification should appear in your notification shade.
          </p>
          {testState && (
            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-steel-700 ring-1 ring-steel-200">
              {testState}
            </p>
          )}

          {diag && (
            <dl className="mt-3 space-y-1 text-xs">
              <Diag label="Permission" value={diag.permission} good={diag.permission === 'granted'} />
              <Diag label="Secure (HTTPS)" value={String(diag.secureContext)} good={diag.secureContext} />
              <Diag label="Service worker" value={diag.serviceWorker} good={diag.serviceWorker === 'active'} />
              <Diag label="Controlling page" value={String(diag.controlling)} good={diag.controlling} />
              <Diag label="Installed app" value={String(diag.standalone)} good={diag.standalone} />
              <Diag label="Build" value={diag.build} good />
            </dl>
          )}

          <p className="mt-3 text-xs text-steel-500">
            On a phone, a backgrounded app is frozen by the operating system
            after a short time and stops receiving live updates. A test that
            works but a real arrival that does not usually means the app was
            asleep, not that notifications are broken.
          </p>
        </details>

        <p className="mt-4 text-xs text-steel-400">
          Alerts arrive while the app is open or running in the background. If
          the app is fully closed, the visitor still appears the moment it is
          reopened.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function Diag({ label, value, good }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-steel-500">{label}</dt>
      <dd
        className={`font-mono ${good ? 'text-inside-700' : 'text-brand-700'}`}
      >
        {value}
      </dd>
    </div>
  )
}
