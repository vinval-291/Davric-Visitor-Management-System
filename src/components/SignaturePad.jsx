import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

/**
 * Signature capture for a reception touchscreen.
 *
 * Three details do the heavy lifting here, and all three are things
 * that break a naive canvas on a real tablet:
 *
 *   1. touch-action: none on the canvas. Without it the browser
 *      treats the first drag as a scroll gesture, the page moves
 *      under the visitor's finger and the stroke is lost.
 *   2. Pointer Events rather than mouse or touch events, so a finger,
 *      a stylus and a mouse all take the same code path.
 *   3. devicePixelRatio scaling. A canvas sized only in CSS pixels
 *      renders a soft, aliased line on a high-density screen, which
 *      looks careless on something meant to be a legal record.
 */
const SignaturePad = forwardRef(function SignaturePad(
  { disabled = false, height = 200 },
  ref,
) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPoint = useRef(null)
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(true)

  // Paint the backing store white and rescale for the device.
  // A transparent PNG would go invisible on a dark background if the
  // record is ever printed or exported.
  const prepare = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0a0a0a'
  }, [])

  useEffect(() => {
    prepare()
    const canvas = canvasRef.current
    if (!canvas) return

    // Re-preparing on resize clears the canvas, so only react to a real
    // width change (rotation, window resize), not to scroll-driven
    // viewport jitter on mobile browsers.
    let lastWidth = canvas.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const width = canvas.getBoundingClientRect().width
      if (Math.abs(width - lastWidth) < 1) return
      lastWidth = width
      prepare()
      hasInk.current = false
      setEmpty(true)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [prepare])

  function pointFrom(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDown(e) {
    if (disabled) return
    e.preventDefault()
    canvasRef.current.setPointerCapture(e.pointerId)
    drawing.current = true
    lastPoint.current = pointFrom(e)

    // A single tap should leave a visible dot, not nothing.
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.arc(lastPoint.current.x, lastPoint.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0a0a'
    ctx.fill()

    hasInk.current = true
    setEmpty(false)
  }

  function handleMove(e) {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const point = pointFrom(e)
    const prev = lastPoint.current

    // Curve through the midpoint instead of joining raw samples, which
    // turns the polyline into a smooth stroke at normal writing speed.
    const mid = { x: (prev.x + point.x) / 2, y: (prev.y + point.y) / 2 }
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y)
    ctx.stroke()

    lastPoint.current = point
  }

  function handleUp(e) {
    if (!drawing.current) return
    e.preventDefault()
    drawing.current = false
    lastPoint.current = null
  }

  const clear = useCallback(() => {
    prepare()
    hasInk.current = false
    setEmpty(true)
  }, [prepare])

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => !hasInk.current,
      clear,
      toBlob: () =>
        new Promise((resolve) => {
          if (!hasInk.current || !canvasRef.current) return resolve(null)
          canvasRef.current.toBlob((blob) => resolve(blob), 'image/png')
        }),
    }),
    [clear],
  )

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-white ring-1 ring-steel-300">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: 'none' }}
          className="block w-full cursor-crosshair"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />

        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm text-steel-400">
              Ask the visitor to sign here
            </span>
            <span className="mt-8 h-px w-2/3 bg-steel-200" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-steel-400">
          Finger, stylus or mouse all work.
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={empty || disabled}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-steel-600 transition hover:bg-steel-100 disabled:opacity-40"
        >
          Clear signature
        </button>
      </div>
    </div>
  )
})

export default SignaturePad
