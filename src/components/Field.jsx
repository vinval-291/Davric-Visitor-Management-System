/**
 * Form controls sized for a reception touchscreen.
 *
 * Everything interactive is at least 48px tall. A receptionist is
 * often standing, tapping with one hand while talking to the visitor,
 * so small targets cost real time and cause mis-taps.
 */
const baseInput =
  'mt-1.5 w-full rounded-lg border-0 bg-steel-50 px-4 py-3 text-base text-ink ' +
  'ring-1 ring-steel-300 transition placeholder:text-steel-400 ' +
  'focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
  'disabled:opacity-60'

/**
 * `as` must be "div" whenever the field contains anything other than a
 * single input. A <label> forwards any click inside it to the first
 * form control it wraps, so a label around the signature pad sends
 * every mouse-up straight to the "Clear signature" button and wipes
 * the signature the moment the visitor lifts the pen.
 */
export function Field({ label, hint, required, error, as = 'label', children }) {
  const Wrapper = as
  return (
    <Wrapper className="block">
      <span className="text-sm font-medium text-steel-700">
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </span>
      {hint && <span className="block text-xs text-steel-400">{hint}</span>}
      {children}
      {error && (
        <span className="mt-1 block text-sm font-medium text-brand-700">
          {error}
        </span>
      )}
    </Wrapper>
  )
}

export function TextInput({ error, ...props }) {
  return (
    <input
      {...props}
      className={`${baseInput} ${error ? 'ring-brand-500' : ''}`}
    />
  )
}

export function TextArea({ error, ...props }) {
  return (
    <textarea
      {...props}
      className={`${baseInput} min-h-24 resize-y ${error ? 'ring-brand-500' : ''}`}
    />
  )
}

export function Select({ error, children, ...props }) {
  return (
    <select
      {...props}
      className={`${baseInput} appearance-none ${error ? 'ring-brand-500' : ''}`}
    >
      {children}
    </select>
  )
}
