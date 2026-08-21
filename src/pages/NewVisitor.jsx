import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import { Field, TextInput, TextArea, Select } from '../components/Field.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import { useExecutives } from '../lib/useExecutives.js'
import { formatPhone, normalizePhone, isValidPhone } from '../lib/phone.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'

const EMPTY = {
  full_name: '',
  phone: '',
  organization: '',
  executive_id: '',
  purpose: '',
}

export default function NewVisitor() {
  const { user } = useAuth()
  const { groups, loading, error: loadError } = useExecutives()
  const signature = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [checkedIn, setCheckedIn] = useState(null)
  const [notified, setNotified] = useState(null)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  function validate() {
    const next = {}
    if (!form.full_name.trim()) {
      next.full_name = "Enter the visitor's name"
    } else if (form.full_name.trim().length < 2) {
      next.full_name = 'That name looks too short'
    }
    if (!form.executive_id) next.executive_id = 'Select who they are visiting'
    if (!isValidPhone(form.phone)) {
      next.phone = 'Phone number must be 11 digits'
    }
    // Remove this check to make signing optional.
    if (signature.current?.isEmpty()) {
      next.signature = 'Ask the visitor to sign before checking in'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setBusy(true)

    // The signature is uploaded BEFORE the visit row is created, so the
    // row is complete and correct from the moment it exists. Writing the
    // row first and patching the path in afterwards would need a second
    // update, which the immutability guard from Step 4 rightly refuses.
    let signaturePath = null
    const blob = await signature.current?.toBlob()

    if (blob) {
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.png`
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(path, blob, { contentType: 'image/png', upsert: false })

      if (uploadError) {
        setBusy(false)
        setSubmitError(`Could not save the signature: ${uploadError.message}`)
        return
      }
      signaturePath = path
    }

    // The database fills in check_in_time, status, and the executive
    // and department snapshots. It also creates the PA notification,
    // in this same transaction.
    const { data, error } = await supabase
      .from('visitors')
      .insert({
        full_name: form.full_name.trim(),
        phone: normalizePhone(form.phone) || null,
        organization: form.organization.trim() || null,
        purpose: form.purpose.trim() || null,
        executive_id: form.executive_id,
        signature_path: signaturePath,
        created_by: user.id,
      })
      .select(
        'id, full_name, organization, check_in_time, executive_name_snapshot, department_name_snapshot',
      )
      .single()

    setBusy(false)
    if (error) {
      // Do not leave an orphaned signature behind if the row failed.
      if (signaturePath) {
        await supabase.storage.from('signatures').remove([signaturePath])
      }
      setSubmitError(error.message)
      return
    }
    setCheckedIn(data)

    // Who actually received the alert. Returns the PA(s) assigned to
    // the executive, or the super admins when none is assigned.
    const { data: names } = await supabase.rpc('visit_notified_names', {
      visit_id: data.id,
    })
    setNotified(names ?? [])
  }

  function reset() {
    setForm(EMPTY)
    setErrors({})
    setSubmitError(null)
    setCheckedIn(null)
    setNotified(null)
    signature.current?.clear()
  }

  if (checkedIn) {
    return (
      <AppShell title="Checked in">
        <CheckedInCard visitor={checkedIn} notified={notified} onAnother={reset} />
      </AppShell>
    )
  }

  return (
    <AppShell
      title="New visitor"
      subtitle="Register an arrival at reception"
      actions={
        <Link
          to="/reception"
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
        >
          Cancel
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-steel-200 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Full name" required error={errors.full_name}>
              <TextInput
                value={form.full_name}
                onChange={set('full_name')}
                error={errors.full_name}
                placeholder="John Doe"
                autoFocus
                autoComplete="off"
              />
            </Field>
          </div>

          <Field label="Phone number" hint="11 digits" error={errors.phone}>
            <TextInput
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))
                setErrors((x) => ({ ...x, phone: undefined }))
              }}
              error={errors.phone}
              placeholder="0801 234 5678"
              inputMode="numeric"
              maxLength={13}
              autoComplete="off"
            />
          </Field>

          <Field label="Company / organisation">
            <TextInput
              value={form.organization}
              onChange={set('organization')}
              placeholder="Acme Limited"
              autoComplete="off"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Who are you visiting?"
              required
              error={errors.executive_id}
              hint="Their assigned PA is notified the moment you check the visitor in"
            >
              <Select
                value={form.executive_id}
                onChange={set('executive_id')}
                error={errors.executive_id}
                disabled={loading || groups.length === 0}
              >
                <option value="">
                  {loading ? 'Loading…' : 'Select a person'}
                </option>
                {groups.map(({ department, executives }) => (
                  <optgroup key={department} label={department}>
                    {executives.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.full_name}
                        {ex.position ? ` — ${ex.position}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            {!loading && groups.length === 0 && (
              <p className="mt-2 text-sm text-brand-700">
                No executives have been set up yet. An administrator must add
                them before visitors can be registered.
              </p>
            )}
            {loadError && (
              <p className="mt-2 text-sm text-brand-700">{loadError}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Field label="Purpose of visit">
              <TextArea
                value={form.purpose}
                onChange={set('purpose')}
                placeholder="Scheduled meeting, delivery, interview…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              as="div"
              label="Visitor signature"
              required
              error={errors.signature}
              hint="Hand the device to the visitor to sign"
            >
              <div className="mt-1.5">
                <SignaturePad ref={signature} disabled={busy} />
              </div>
            </Field>
          </div>
        </div>

        {submitError && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200"
          >
            {submitError}
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || loading}
            className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? 'Checking in…' : 'Check in'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
          >
            Clear
          </button>
        </div>

      </form>
    </AppShell>
  )
}

function CheckedInCard({ visitor, notified, onAnother }) {
  const time = new Date(visitor.check_in_time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-steel-200">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-inside-50 text-inside-700 ring-1 ring-inside-500/30">
          ✓
        </span>
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {visitor.full_name} is checked in
          </h2>
          <p className="mt-1 text-steel-600">
            Visiting{' '}
            <span className="font-medium text-steel-800">
              {visitor.executive_name_snapshot}
            </span>
            {visitor.department_name_snapshot &&
              ` · ${visitor.department_name_snapshot}`}
          </p>
          <p className="mt-0.5 text-steel-600">Check-in time: {time}</p>
          {notified === null ? (
            <p className="mt-3 text-sm text-steel-400">Notifying…</p>
          ) : notified.length > 0 ? (
            <p className="mt-3 text-sm text-steel-600">
              Notified:{' '}
              <span className="font-medium text-steel-800">
                {notified.join(', ')}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-brand-700">
              Nobody was notified for this visit. Tell an administrator.
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          onClick={onAnother}
          className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          Check in another visitor
        </button>
        <Link
          to="/reception"
          className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
        >
          Back to reception
        </Link>
      </div>
    </div>
  )
}
