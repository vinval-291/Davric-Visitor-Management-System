import { useEffect, useState } from 'react'
import { signatureUrl } from '../lib/useVisitors.js'
import { formatPhone } from '../lib/phone.js'
import { clockTime, dateTime, elapsed } from '../lib/time.js'

export default function VisitorDetail({ visitor, onClose, onCheckOut }) {
  const [signature, setSignature] = useState(undefined) // undefined = loading
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setSignature(undefined)
    signatureUrl(visitor.signature_path).then((url) => {
      if (active) setSignature(url)
    })
    return () => {
      active = false
    }
  }, [visitor.signature_path])

  // Escape closes, as any dialog should.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleCheckOut() {
    setBusy(true)
    const message = await onCheckOut(visitor.id)
    setBusy(false)
    if (message) setError(message)
    else onClose()
  }

  const gone = Boolean(visitor.check_out_time)

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
            <h2 className="text-xl font-semibold text-ink">
              {visitor.full_name}
            </h2>
            {visitor.organization && (
              <p className="text-sm text-steel-500">{visitor.organization}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-steel-400 transition hover:bg-steel-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Visiting">
            {visitor.executive_name_snapshot}
            {visitor.executive_position_snapshot &&
              ` — ${visitor.executive_position_snapshot}`}
          </Row>
          <Row label="Department">
            {visitor.department_name_snapshot || '—'}
          </Row>
          <Row label="Phone">
            {visitor.phone ? formatPhone(visitor.phone) : '—'}
          </Row>
          <Row label="Purpose">{visitor.purpose || '—'}</Row>
          <Row label="Arrived">{dateTime(visitor.check_in_time)}</Row>
          <Row label="Sent up">
            {visitor.admitted_at
              ? `${clockTime(visitor.admitted_at)} · waited ${elapsed(
                  visitor.check_in_time,
                  visitor.admitted_at,
                )}`
              : 'Not yet'}
          </Row>
          <Row label="Checked out">
            {gone
              ? `${dateTime(visitor.check_out_time)} · stayed ${elapsed(
                  visitor.check_in_time,
                  visitor.check_out_time,
                )}`
              : `Still inside · ${elapsed(visitor.check_in_time)}`}
          </Row>
        </dl>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel-500">
            Signature
          </p>
          <div className="mt-2 overflow-hidden rounded-lg bg-white ring-1 ring-steel-200">
            {signature === undefined ? (
              <p className="p-6 text-center text-sm text-steel-400">Loading…</p>
            ) : signature ? (
              <img
                src={signature}
                alt={`Signature of ${visitor.full_name}`}
                className="block w-full"
              />
            ) : (
              <p className="p-6 text-center text-sm text-steel-400">
                No signature on this record
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!gone && (
            <button
              onClick={handleCheckOut}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? 'Checking out…' : 'Check out'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 text-steel-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-steel-800">{children}</dd>
    </div>
  )
}
