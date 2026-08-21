let ctx = null

/**
 * Two-note arrival chime, synthesised rather than loaded from a file.
 *
 * A PA is rarely staring at this screen -- they are on the phone or in
 * a meeting -- so a visitor standing in reception needs to make a
 * sound, not just change a pixel. Kept short and soft enough for an
 * open office.
 */
export function chime() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()

    const start = ctx.currentTime
    for (const [i, freq] of [880, 1174.66].entries()) {
      const at = start + i * 0.13
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.linearRampToValueAtTime(0.14, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.38)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.4)
    }
  } catch {
    // Audio is a nicety. Never let it break the dashboard.
  }
}
