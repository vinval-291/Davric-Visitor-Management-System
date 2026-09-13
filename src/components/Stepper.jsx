/**
 * Progress through registering a visitor.
 *
 * Completed steps can be tapped to go back and fix something; steps
 * not yet reached cannot be jumped to, because each one validates what
 * it collects before letting the receptionist move on.
 *
 * On a phone four labels do not fit beside four circles, so only the
 * circles show, with the current step named above them.
 */
export default function Stepper({ steps, current, reached, onSelect }) {
  return (
    <nav aria-label="Registration progress">
      <p className="mb-3 text-sm font-medium text-steel-500 sm:hidden">
        Step {current + 1} of {steps.length} ·{' '}
        <span className="text-brand-700">{steps[current]}</span>
      </p>

      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          const canJump = i <= reached && !active
          const last = i === steps.length - 1

          return (
            <li
              key={label}
              className={`flex items-center ${last ? '' : 'flex-1'}`}
            >
              <button
                type="button"
                onClick={() => canJump && onSelect(i)}
                disabled={!canJump}
                aria-current={active ? 'step' : undefined}
                className="group flex shrink-0 items-center gap-2.5 rounded-lg py-1 pr-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-default"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition ${
                    active
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                      : done
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-steel-500 ring-1 ring-steel-300'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span
                  className={`hidden whitespace-nowrap text-sm sm:inline ${
                    active
                      ? 'font-semibold text-brand-700'
                      : done
                        ? 'font-medium text-steel-700 group-hover:text-brand-700'
                        : 'text-steel-500'
                  }`}
                >
                  {label}
                </span>
              </button>

              {!last && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-px min-w-3 flex-1 sm:mx-3 ${
                    done ? 'bg-brand-500' : 'bg-steel-200'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
