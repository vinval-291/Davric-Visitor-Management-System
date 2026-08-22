/**
 * Arrival alert sound.
 *
 * Two kinds of tone are supported:
 *   - built-in presets, synthesised with Web Audio so there is no
 *     asset to download and nothing to go missing
 *   - a file the user picks from their own device, held in IndexedDB
 *
 * The chosen file lives in IndexedDB rather than localStorage because
 * localStorage stores strings: a sound would have to be base64'd,
 * inflating it by a third and competing for a ~5MB quota shared with
 * everything else. IndexedDB stores the Blob as-is.
 *
 * Preferences are per device, deliberately. A PA's phone and the
 * reception tablet want different volumes, and one person changing
 * the alert should not change it for everyone.
 */

const SETTINGS_KEY = 'vms.sound.settings'
const DB_NAME = 'davric-vms'
const STORE = 'sounds'
const CUSTOM_KEY = 'custom-alert'

export const MAX_SOUND_BYTES = 2 * 1024 * 1024 // 2 MB

export const PRESETS = {
  chime: { label: 'Chime', description: 'Two soft notes' },
  bell: { label: 'Bell', description: 'Brighter, carries further' },
  ping: { label: 'Ping', description: 'Single short note' },
  alert: { label: 'Alert', description: 'Three notes, hard to miss' },
  ring: { label: 'Ring', description: 'Like a phone ringing' },
  doorbell: { label: 'Doorbell', description: 'Two-tone, ding-dong' },
}

/** How often to sound again while someone is still waiting downstairs. */
export const REPEAT_OPTIONS = [
  { value: 0, label: 'Once' },
  { value: 20, label: 'Every 20 seconds' },
  { value: 45, label: 'Every 45 seconds' },
  { value: 90, label: 'Every 90 seconds' },
]

export const DEFAULT_SETTINGS = {
  enabled: true,
  source: 'chime', // a PRESETS key, or 'custom'
  volume: 0.7,
  customName: null,
  systemNotifications: true,
  repeatSeconds: 0,
}

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ---------- IndexedDB ---------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore(mode, work) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = work(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export const saveCustomSound = (blob) =>
  withStore('readwrite', (store) => store.put(blob, CUSTOM_KEY))

export const getCustomSound = () =>
  withStore('readonly', (store) => store.get(CUSTOM_KEY))

export const clearCustomSound = () =>
  withStore('readwrite', (store) => store.delete(CUSTOM_KEY))

// ---------- playback ----------------------------------------------

let ctx = null
let cachedUrl = null

function audioContext() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/**
 * Browsers refuse to play audio until the user has interacted with the
 * page. Signing in counts, so by the time an alert can arrive the
 * context is unlocked -- but an app restored from a background tab may
 * need nudging, which is what this does.
 */
export function unlockAudio() {
  try {
    audioContext()
  } catch {
    /* no audio support; alerts stay visual */
  }
}

const TONES = {
  chime: [
    [880, 0, 0.38],
    [1174.66, 0.13, 0.38],
  ],
  bell: [
    [1318.51, 0, 0.7],
    [1975.53, 0.02, 0.5],
  ],
  ping: [[1046.5, 0, 0.3]],
  alert: [
    [987.77, 0, 0.22],
    [987.77, 0.22, 0.22],
    [1318.51, 0.44, 0.5],
  ],
  // Two alternating tones over two cycles: the cadence a phone uses,
  // which is what the ear actually recognises as "ringing".
  ring: [
    [800, 0, 0.34],
    [1000, 0.4, 0.34],
    [800, 0.95, 0.34],
    [1000, 1.35, 0.34],
  ],
  doorbell: [
    [659.25, 0, 0.65],
    [523.25, 0.45, 1.0],
  ],
}

function playPreset(name, volume) {
  const context = audioContext()
  const start = context.currentTime

  for (const [freq, delay, length] of TONES[name] ?? TONES.chime) {
    const at = start + delay
    const osc = context.createOscillator()
    const gain = context.createGain()

    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, volume * 0.22), at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)

    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

async function playCustom(volume) {
  const blob = await getCustomSound()
  if (!blob) return false

  cachedUrl ||= URL.createObjectURL(blob)
  const audio = new Audio(cachedUrl)
  audio.volume = Math.min(1, Math.max(0, volume))
  await audio.play()
  return true
}

/** Called when a visitor alert arrives, and by the preview buttons. */
export async function playAlert(override) {
  const settings = { ...loadSettings(), ...override }
  if (!settings.enabled) return

  try {
    if (settings.source === 'custom') {
      const played = await playCustom(settings.volume)
      // Fall back to a preset rather than staying silent if the file
      // has been cleared or the format turns out to be unplayable.
      if (played) return
    }
    playPreset(settings.source, settings.volume)
  } catch {
    /* Audio is a nicety. Never let it break the dashboard. */
  }
}

/** Discard the cached object URL after the stored file changes. */
export function invalidateCustomSound() {
  if (cachedUrl) URL.revokeObjectURL(cachedUrl)
  cachedUrl = null
}

// ---------- system notifications ----------------------------------

export function canNotify() {
  return typeof Notification !== 'undefined'
}

export async function requestNotificationPermission() {
  if (!canNotify()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/**
 * Shows an operating-system notification, but only while the tab is
 * hidden -- if the PA is already looking at the dashboard the card
 * itself is the notification.
 *
 * Android refuses `new Notification()` outright: mobile Chrome throws
 * "Illegal constructor" and requires the service worker to raise it
 * instead. That is also what puts the alert in the phone's
 * notification tray, where a PA who is not holding the phone will
 * actually see it. Desktop browsers accept either, so the service
 * worker is tried first and the constructor is only a fallback.
 *
 * This still requires the app to be open or backgrounded. Reaching a
 * fully closed app needs Web Push. See README.
 */
export async function systemNotify({ title, body, tag, url = '/', force = false }) {
  const settings = loadSettings()
  if (!force && !settings.systemNotifications) return
  if (!canNotify() || Notification.permission !== 'granted') {
    return 'permission not granted'
  }
  // A test needs to fire while the tester is looking at the screen.
  if (!force && typeof document !== 'undefined' && !document.hidden) return

  const options = {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    renotify: Boolean(tag),
    requireInteraction: true, // a waiting visitor should not vanish
    vibrate: [200, 100, 200], // service-worker notifications only
    data: { url },
  }

  try {
    const registration = await navigator.serviceWorker?.ready
    if (registration?.showNotification) {
      await registration.showNotification(title, options)
      return 'shown via service worker'
    }
  } catch (err) {
    if (force) console.warn('service worker notification failed', err)
  }

  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    return 'shown via Notification constructor'
  } catch (err) {
    return `failed: ${err.message}`
  }
}

/** Everything a phone can tell us about why an alert did not appear. */
export async function notificationDiagnostics() {
  const out = {
    permission: canNotify() ? Notification.permission : 'unsupported',
    secureContext: window.isSecureContext,
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
    serviceWorker: 'unsupported',
    controlling: false,
    build: typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'unknown',
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      out.serviceWorker = registration
        ? registration.active
          ? 'active'
          : 'registered, not active'
        : 'not registered'
      out.controlling = Boolean(navigator.serviceWorker.controller)
    } catch {
      out.serviceWorker = 'error'
    }
  }
  return out
}
