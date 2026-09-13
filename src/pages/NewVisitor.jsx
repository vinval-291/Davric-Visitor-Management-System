import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import {
  Field,
  TextInput,
  Select,
  ChoiceGroup,
} from '../components/Field.jsx'
import Stepper from '../components/Stepper.jsx'
import SignaturePad from '../components/SignaturePad.jsx'
import {
  VISIT_TYPES,
  APPOINTMENT_CHOICES,
  visitTypeLabel,
  appointmentLabel,
} from '../lib/visit.js'
import { useExecutives } from '../lib/useExecutives.js'
import { useVisitors } from '../lib/useVisitors.js'
import { formatPhone, normalizePhone, isValidPhone } from '../lib/phone.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { sendPushFor } from '../lib/push.js'

const FORM_ID = 'new-visitor-form'

const STEPS = ['Visitor details', 'Host & visit type', 'Purpose & signature', 'Review & check in']

// The purpose box and the signature pad share this height, so the two
// sit side by side as a matched pair on the same step.
const SIGNATURE_HEIGHT = 220

// Tapping one fills the purpose field; it stays free text, because the
// purpose is also the line a PA reads on a locked phone and a fixed
// list would flatten "Contract review with legal" into "Meeting".
const PURPOSE_SUGGESTIONS = ['Meeting', 'Interview', 'Delivery', 'Collection', 'Consultation']

const EMPTY = {
  full_name: '',
  phone: '',
  organization: '',
  executive_id: '',
  visit_type: '',
  has_appointment: '',
  purpose: '',
}

// Which step owns each field, so a check-in that fails validation
// returns the receptionist to the screen where the problem actually is.
const FIELD_STEP = {
  full_name: 0,
  phone: 0,
  executive_id: 1,
  visit_type: 1,
  has_appointment: 1,
  signature: 2,
}

/**
 * Registering a visitor, in four steps.
 *
 * Split into steps because the device physically changes hands in the
 * middle: the receptionist types, the visitor signs, the receptionist
 * takes it back. A screen per stage keeps the visitor away from the
 * form and the receptionist away from the pad.
 *
 * The review step matters more than it looks. A visit record cannot
 * be edited once it is checked in, so this is the last chance to catch
 * a misspelt name or the wrong executive.
 */
export default function NewVisitor() {
  const { user } = useAuth()
  const { groups, loading, error: loadError } = useExecutives()
  const { counts } = useVisitors()
  const signature = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [checkedIn, setCheckedIn] = useState(null)
  const [notified, setNotified] = useState(null)
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [hasInk, setHasInk] = useState(false)
  const [preview, setPreview] = useState(null)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const choose = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  // Back to the top of the form on every step change. On a phone the
  // Next button sits below the fold, and the next step's first field
  // would otherwise be off-screen above it.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // The review step shows the signature as it will be stored.
  useEffect(() => {
    if (step !== 3) return
    let url = null
    let active = true
    signature.current?.toBlob().then((blob) => {
      if (!active || !blob) return
      url = URL.createObjectURL(blob)
      setPreview(url)
    })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [step])

  useEffect(() => {
    if (hasInk) setErrors((x) => ({ ...x, signature: undefined }))
  }, [hasInk])

  function problemsFor(index) {
    const next = {}
    if (index === 0) {
      if (!form.full_name.trim()) {
        next.full_name = "Enter the visitor's name"
      } else if (form.full_name.trim().length < 2) {
        next.full_name = 'That name looks too short'
      }
      if (!isValidPhone(form.phone)) {
        next.phone = 'Phone number must be 11 digits'
      }
    }
    if (index === 1) {
      if (!form.executive_id) next.executive_id = 'Select who they are visiting'
      if (!form.visit_type) next.visit_type = 'Ask whether it is official or personal'
      if (!form.has_appointment) {
        next.has_appointment = 'Ask whether they have an appointment'
      }
    }
    // Remove this check to make signing optional.
    if (index === 2 && signature.current?.isEmpty()) {
      next.signature = 'Ask the visitor to sign before continuing'
    }
    return next
  }

  function goTo(index) {
    setStep(index)
    setReached((r) => Math.max(r, index))
  }

  async function handlePrimary(e) {
    e.preventDefault()
    setSubmitError(null)

    if (step < STEPS.length - 1) {
      const problems = problemsFor(step)
      setErrors(problems)
      if (Object.keys(problems).length === 0) goTo(step + 1)
      return
    }

    const problems = { ...problemsFor(0), ...problemsFor(1), ...problemsFor(2) }
    if (Object.keys(problems).length) {
      setErrors(problems)
      setStep(Math.min(...Object.keys(problems).map((k) => FIELD_STEP[k])))
      return
    }

    await submit()
  }

  async function submit() {
    setBusy(true)

    // The signature is uploaded BEFORE the visit row is created, so the
    // row is complete and correct from the moment it exists. Writing the
    // row first and patching the path in afterwards would need a second
    // update, which the immutability guard rightly refuses.
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
    // and department snapshots. It also creates the host's alert, in
    // this same transaction.
    const { data, error } = await supabase
      .from('visitors')
      .insert({
        full_name: form.full_name.trim(),
        phone: normalizePhone(form.phone) || null,
        organization: form.organization.trim() || null,
        purpose: form.purpose.trim() || null,
        visit_type: form.visit_type,
        has_appointment: form.has_appointment === 'yes',
        executive_id: form.executive_id,
        signature_path: signaturePath,
        created_by: user.id,
      })
      .select(
        'id, full_name, organization, check_in_time, executive_name_snapshot, department_name_snapshot, visit_type, has_appointment',
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

    // Wake the recipients' devices. Never throws: the alert row is
    // already saved, so a failed push is untimely, not lost.
    sendPushFor(data.id)

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
    setStep(0)
    setReached(0)
    signature.current?.clear()
  }

  if (checkedIn) {
    return (
      <AppShell title="Checked in">
        <CheckedInCard visitor={checkedIn} notified={notified} onAnother={reset} />
      </AppShell>
    )
  }

  const executive = groups
    .flatMap((g) => g.executives.map((ex) => ({ ...ex, department: g.department })))
    .find((ex) => ex.id === form.executive_id)

  const last = step === STEPS.length - 1
  const actions = (
    <>
      <Link
        to="/reception"
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50"
      >
        Cancel
      </Link>
      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-steel-700 ring-1 ring-steel-300 transition hover:bg-steel-50 disabled:opacity-60"
        >
          Back
        </button>
      )}
      <button
        type="submit"
        form={FORM_ID}
        disabled={busy || loading}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {last ? (busy ? 'Checking in…' : 'Check in') : 'Next →'}
      </button>
    </>
  )

  return (
    <AppShell
      title="New Visitor"
      subtitle="Register a visitor and capture their details"
      actions={<div className="hidden items-center gap-2 md:flex">{actions}</div>}
    >
      <form id={FORM_ID} onSubmit={handlePrimary} noValidate>
        <QuickStats counts={counts} />

        <div className="rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-steel-200 sm:px-6 sm:py-4">
          <Stepper steps={STEPS} current={step} reached={reached} onSelect={goTo} />
        </div>

        {/* Equal columns on every step, never a width that changes as
            the steps change. The signature pad clears itself when its
            width changes, so a column that grew or shrank between steps
            would wipe a signature the visitor had already given.

            Equal heights too: no items-start, so both cards stretch to
            whichever is taller on the current step and the pair reads as
            one panel rather than two boxes ending at different points.
            Stretching changes only height, never width, so the pad is
            left alone. */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* ---- left: the current step ---------------------------- */}
          <section
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-steel-200 sm:p-6"
          >
            {step === 0 && (
              <>
                <CardHeading
                  title="Visitor information"
                  text="Who has arrived at reception."
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Full name" required error={errors.full_name}>
                      <TextInput
                        value={form.full_name}
                        onChange={set('full_name')}
                        error={errors.full_name}
                        placeholder="Enter visitor's full name"
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

                  {/* The hint is here for alignment as much as help: the
                      phone field beside it has one, and without a matching
                      line the two inputs sit at different heights. */}
                  <Field
                    label="Company / organisation"
                    hint="Optional — the business they represent"
                  >
                    <TextInput
                      value={form.organization}
                      onChange={set('organization')}
                      placeholder="e.g. Tech Solutions Ltd"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <CardHeading
                  title="Host & visit type"
                  text="Who they are here to see. The host sees these answers in their alert."
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      label="Who are you visiting?"
                      required
                      error={errors.executive_id}
                      hint="Their PA — or the executive, if nobody covers them — is alerted the moment you check in"
                    >
                      <Select
                        value={form.executive_id}
                        onChange={set('executive_id')}
                        error={errors.executive_id}
                        disabled={loading || groups.length === 0}
                      >
                        <option value="">
                          {loading ? 'Loading…' : 'Select executive / department'}
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
                        No executives have been set up yet. An administrator must
                        add them before visitors can be registered.
                      </p>
                    )}
                    {loadError && (
                      <p className="mt-2 text-sm text-brand-700">{loadError}</p>
                    )}
                  </div>

                  <Field as="div" label="Type of visit" required error={errors.visit_type}>
                    <ChoiceGroup
                      value={form.visit_type}
                      onChange={choose('visit_type')}
                      options={VISIT_TYPES}
                      error={errors.visit_type}
                    />
                  </Field>

                  <Field
                    as="div"
                    label="Do they have an appointment?"
                    required
                    error={errors.has_appointment}
                  >
                    <ChoiceGroup
                      value={form.has_appointment}
                      onChange={choose('has_appointment')}
                      options={APPOINTMENT_CHOICES}
                      error={errors.has_appointment}
                    />
                  </Field>

                </div>
              </>
            )}

            {step === 2 && (
              <>
                <CardHeading
                  title="Purpose of visit"
                  text="Why they have come. The host reads this in their alert."
                />
                {/* A plain textarea rather than the shared TextArea, so it
                    matches the signature pad exactly: same height, same
                    border, no resize handle to pull the pair out of line. */}
                <div className="mt-4">
                  <textarea
                    value={form.purpose}
                    onChange={set('purpose')}
                    aria-label="Purpose of visit"
                    placeholder="e.g. Contract review with the legal team"
                    style={{ height: SIGNATURE_HEIGHT }}
                    className="block w-full resize-none rounded-lg border-0 bg-white px-4 py-3 text-base text-ink ring-1 ring-steel-300 transition placeholder:text-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-steel-400">Quick fill:</span>
                  {PURPOSE_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, purpose: suggestion }))}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                        form.purpose === suggestion
                          ? 'bg-brand-50 text-brand-700 ring-brand-300'
                          : 'bg-white text-steel-600 ring-steel-300 hover:bg-steel-50'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <CardHeading
                  title="Review before checking in"
                  text="A visit record cannot be changed once it is checked in. Check the details below."
                />

                <div className="mt-5 divide-y divide-steel-100 rounded-xl ring-1 ring-steel-200">
                  <ReviewGroup title="Visitor" onEdit={() => setStep(0)}>
                    <ReviewRow label="Name">{form.full_name.trim()}</ReviewRow>
                    <ReviewRow label="Phone">
                      {form.phone ? formatPhone(form.phone) : '—'}
                    </ReviewRow>
                    <ReviewRow label="Company">{form.organization.trim() || '—'}</ReviewRow>
                  </ReviewGroup>

                  <ReviewGroup title="Host & visit type" onEdit={() => setStep(1)}>
                    <ReviewRow label="Visiting">
                      {executive
                        ? `${executive.full_name}${executive.position ? ` — ${executive.position}` : ''}`
                        : '—'}
                      {executive?.department && (
                        <span className="block text-sm text-steel-500">
                          {executive.department}
                        </span>
                      )}
                    </ReviewRow>
                    <ReviewRow label="Visit">{visitTypeLabel(form.visit_type)}</ReviewRow>
                    <ReviewRow label="Appointment">
                      {appointmentLabel(form.has_appointment === 'yes')}
                    </ReviewRow>
                  </ReviewGroup>

                  <ReviewGroup title="Purpose & signature" onEdit={() => setStep(2)}>
                    <ReviewRow label="Purpose">{form.purpose.trim() || '—'}</ReviewRow>
                    <div className="px-4 pb-3">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Visitor signature"
                          className="h-24 w-full rounded-lg bg-white object-contain ring-1 ring-steel-200"
                        />
                      ) : (
                        <p className="text-sm text-steel-400">Loading…</p>
                      )}
                    </div>
                  </ReviewGroup>
                </div>

                {submitError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200"
                  >
                    {submitError}
                  </p>
                )}
              </>
            )}
          </section>

          {/* ---- right: the signature ------------------------------
              Always mounted, so a signature given on step 3 is still
              there on step 4. Beside the form on a tablet in landscape;
              on narrower screens it only appears on its own step. */}
          <section
            className={`rounded-2xl bg-white p-5 shadow-sm sm:p-6 ${
              step === 2 ? 'ring-2 ring-brand-500' : 'ring-1 ring-steel-200'
            } ${step === 2 ? '' : 'hidden lg:block'}`}
          >
            <CardHeading
              title="Visitor signature"
              text="Please ask the visitor to sign on the screen below."
            />
            <div className="mt-4">
              <SignaturePad
                ref={signature}
                disabled={busy}
                height={SIGNATURE_HEIGHT}
                onInkChange={setHasInk}
              />
            </div>
            {hasInk ? (
              <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-inside-50 px-3 py-2.5 text-sm font-medium text-inside-700 ring-1 ring-inside-500/30">
                <span aria-hidden="true">✓</span> Signature captured
              </p>
            ) : errors.signature ? (
              <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2.5 text-center text-sm font-medium text-brand-700 ring-1 ring-brand-200">
                {errors.signature}
              </p>
            ) : null}
          </section>
        </div>

        {/* Phones: the actions follow the thumb instead of sitting in
            the page header, where they would scroll out of reach. */}
        <div className="sticky bottom-0 -mx-4 mt-6 flex justify-end gap-2 border-t border-steel-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          {actions}
        </div>
      </form>
    </AppShell>
  )
}

function CardHeading({ title, text }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {text && <p className="mt-0.5 text-sm text-steel-500">{text}</p>}
    </div>
  )
}

function ReviewGroup({ title, onEdit, children }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function ReviewRow({ label, children }) {
  return (
    <div className="flex gap-4 px-4 py-1.5 text-sm">
      <dt className="w-24 shrink-0 text-steel-500">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-steel-800">{children}</dd>
    </div>
  )
}

/**
 * The desk at a glance while registering. Real figures only: the
 * mockup's "vs yesterday" comparisons would need yesterday's counts,
 * which this screen does not load, and a made-up trend is worse than
 * none.
 */
function QuickStats({ counts }) {
  const stats = [
    { label: 'Arrived today', value: counts.today, icon: ICONS.arrived },
    { label: 'Inside now', value: counts.inside, icon: ICONS.inside },
    { label: 'Waiting to go up', value: counts.waiting, icon: ICONS.waiting },
    { label: 'Left today', value: counts.out, icon: ICONS.left },
  ]

  return (
    <section className="mb-5">
      <h2 className="text-sm font-semibold text-ink">Today at reception</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-steel-200 sm:p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {s.icon}
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xl font-semibold leading-tight text-ink tabular-nums">
                {s.value}
              </p>
              <p className="truncate text-xs text-steel-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const ICONS = {
  arrived: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </>
  ),
  inside: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  waiting: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  left: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
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
          {(visitor.visit_type || visitor.has_appointment != null) && (
            <p className="mt-0.5 text-steel-600">
              {[
                visitTypeLabel(visitor.visit_type),
                appointmentLabel(visitor.has_appointment),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
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
