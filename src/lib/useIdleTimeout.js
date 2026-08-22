import { useEffect, useRef, useState } from 'react'

/**
 * Signs the user out after a period of no interaction.
 *
 * The reception tablet is a shared device sitting on a counter that
 * members of the public stand directly in front of. Left signed in
 * overnight it is an open window onto every visitor record, every
 * phone number and every signature.
 *
 * Set VITE_IDLE_TIMEOUT_MINUTES=0 to disable, if Dav-Ric decides the
 * desk is never unattended.
 */
const MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 30)
const WARN_SECONDS = 60
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart']

export function useIdleTimeout(onTimeout, enabled = true) {
  const [secondsLeft, setSecondsLeft] = useState(null)
  const deadline = useRef(0)
  const fired = useRef(false)

  useEffect(() => {
    if (!enabled || !MINUTES || MINUTES <= 0) return

    const reset = () => {
      deadline.current = Date.now() + MINUTES * 60_000
      fired.current = false
      setSecondsLeft(null)
    }
    reset()

    for (const event of EVENTS) {
      window.addEventListener(event, reset, { passive: true })
    }

    // One timer polling a deadline, rather than a timer reset on every
    // keystroke. A tablet that sleeps also stops firing timers, so the
    // deadline is compared against the clock instead of counted down.
    const tick = setInterval(() => {
      const remaining = Math.ceil((deadline.current - Date.now()) / 1000)

      if (remaining <= 0) {
        if (!fired.current) {
          fired.current = true
          setSecondsLeft(null)
          onTimeout()
        }
        return
      }
      setSecondsLeft(remaining <= WARN_SECONDS ? remaining : null)
    }, 1000)

    return () => {
      clearInterval(tick)
      for (const event of EVENTS) window.removeEventListener(event, reset)
    }
  }, [enabled, onTimeout])

  return { secondsLeft, minutes: MINUTES }
}
