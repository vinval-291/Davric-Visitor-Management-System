/** Shared pieces for the admin sections. */

export function Panel({ title, description, children, footer }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-steel-200">
      <div className="border-b border-steel-200 p-5">
        <h2 className="font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-steel-500">
            {description}
          </p>
        )}
      </div>
      <div className="p-5">{children}</div>
      {footer && (
        <div className="border-t border-steel-200 bg-steel-50 p-5">{footer}</div>
      )}
    </section>
  )
}

export function ErrorNote({ message, onDismiss }) {
  if (!message) return null
  return (
    <p className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700 ring-1 ring-brand-200">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 font-bold">
          ×
        </button>
      )}
    </p>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:opacity-60',
    ghost:
      'bg-white text-steel-700 ring-1 ring-steel-300 hover:bg-steel-50 disabled:opacity-60',
    danger:
      'bg-white text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-60',
  }
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`}
    />
  )
}

export const inputClass =
  'rounded-lg border-0 bg-steel-50 px-3 py-2 text-sm text-ink ring-1 ' +
  'ring-steel-300 transition placeholder:text-steel-400 focus:bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500'

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-steel-200 text-xs uppercase tracking-wider text-steel-500">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && (
        <p className="py-8 text-center text-sm text-steel-400">{empty}</p>
      )}
    </div>
  )
}

export function ActivePill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        active
          ? 'bg-inside-50 text-inside-700 ring-inside-500/30'
          : 'bg-gone-50 text-gone-700 ring-gone-500/30'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-inside-500' : 'bg-gone-500'
        }`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}
