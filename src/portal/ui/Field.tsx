import {
  forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
  createContext, useContext,
} from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Switch as RSwitch, Checkbox as RCheckbox } from 'radix-ui'
import { cn } from './cn'

/* ---------------------------------------------------------------------------
   Form controls.

   <Field label error help> wraps any control and wires the label, the help
   line and the error line to it by id, so a screen reader announces all
   three. The error line takes the help line's place rather than adding a
   second line, so the form does not jump as a person types.

   Controls are 40px tall (44 on touch), 16px type on phones so iOS does not
   zoom into the field, and show the gold focus ring the site uses everywhere.
--------------------------------------------------------------------------- */

const FieldCtx = createContext<{ id?: string; describedBy?: string; invalid?: boolean }>({})

export function Field({
  label,
  error,
  help,
  optional,
  children,
  className,
  action,
}: {
  label?: ReactNode
  error?: string
  help?: ReactNode
  optional?: boolean
  children: ReactNode
  className?: string
  /** a small link or button on the label's line, right-aligned */
  action?: ReactNode
}) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <FieldCtx.Provider value={{ id, describedBy: error || help ? msgId : undefined, invalid: Boolean(error) }}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        {(label || action) && (
          <div className="flex items-baseline justify-between gap-3">
            {label && (
              <label htmlFor={id} className="text-[13px] font-medium text-text">
                {label}
                {optional && <span className="ml-1.5 font-normal text-text-3">optional</span>}
              </label>
            )}
            {action}
          </div>
        )}
        {children}
        {(error || help) && (
          <p id={msgId} className={cn('text-[12.5px] leading-snug', error ? 'text-red' : 'text-text-3')} role={error ? 'alert' : undefined}>
            {error || help}
          </p>
        )}
      </div>
    </FieldCtx.Provider>
  )
}

export const controlClass = (invalid?: boolean, className?: string) =>
  cn(
    'w-full min-w-0 rounded-[10px] bg-paper text-[16px] text-text sm:text-sm',
    'ring-1 ring-inset ring-line shadow-[0_1px_2px_rgba(20,26,24,.04)] placeholder:text-text-3',
    'transition-[box-shadow,background-color] duration-150 hover:ring-[#cdcdc6]',
    'focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-green/70',
    'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:text-text-3',
    /* :read-only also matches every <select>, so it is scoped to text fields */
    '[&:is(input,textarea):read-only]:bg-paper-2',
    invalid && 'ring-red/60 hover:ring-red/70 focus:ring-red/70',
    className,
  )

type InputProps = InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; trailing?: ReactNode; invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, invalid, id, ...rest },
  ref,
) {
  const ctx = useContext(FieldCtx)
  const bad = invalid ?? ctx.invalid
  return (
    <div className="relative flex items-center">
      {leading && <span className="pointer-events-none absolute left-3 flex items-center text-text-3 [&_svg]:size-4">{leading}</span>}
      <input
        ref={ref}
        id={id ?? ctx.id}
        aria-invalid={bad || undefined}
        aria-describedby={ctx.describedBy}
        className={controlClass(bad, cn('h-10 px-3 pointer-coarse:h-11', leading && 'pl-9', trailing && 'pr-10', className))}
        {...rest}
      />
      {trailing && <span className="absolute right-2 flex items-center text-text-3">{trailing}</span>}
    </div>
  )
})

/** Dollars in, dollars shown. The parent converts to cents with parseMoney. */
export const MoneyInput = forwardRef<HTMLInputElement, InputProps>(function MoneyInput({ className, ...rest }, ref) {
  return (
    <Input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      leading={<span className="text-[15px] font-medium text-text-2">$</span>}
      className={cn('nums', className)}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, id, rows = 4, ...rest }, ref) {
    const ctx = useContext(FieldCtx)
    return (
      <textarea
        ref={ref}
        id={id ?? ctx.id}
        rows={rows}
        aria-invalid={(invalid ?? ctx.invalid) || undefined}
        aria-describedby={ctx.describedBy}
        className={controlClass(invalid ?? ctx.invalid, cn('resize-y px-3 py-2.5 leading-relaxed', className))}
        {...rest}
      />
    )
  },
)

/** A native select, styled. Native on purpose: on a phone it opens the OS
 *  picker, which beats any custom list for a thumb. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string }>(
  function Select({ className, invalid, id, children, placeholder, ...rest }, ref) {
    const ctx = useContext(FieldCtx)
    return (
      <div className="relative">
        <select
          ref={ref}
          id={id ?? ctx.id}
          aria-invalid={(invalid ?? ctx.invalid) || undefined}
          aria-describedby={ctx.describedBy}
          className={controlClass(invalid ?? ctx.invalid, cn('h-10 appearance-none pr-9 pl-3 pointer-coarse:h-11', className))}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-3" />
      </div>
    )
  },
)

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        leading={<Search />}
        autoFocus={autoFocus}
        className="[&::-webkit-search-cancel-button]:hidden"
        trailing={
          value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="grid size-6 place-items-center rounded-md text-text-3 hover:bg-ink/5 hover:text-text"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null
        }
      />
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
}) {
  const auto = useId()
  const sid = id ?? auto
  const control = (
    <RSwitch.Root
      id={sid}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200',
        'data-[state=checked]:bg-green data-[state=unchecked]:bg-[#d6d6cf] disabled:opacity-50',
      )}
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform duration-200 ease-[var(--ease-brand)] data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  )
  if (!label) return control
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={sid} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-text">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-text-2">{description}</span>}
      </label>
      {control}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean | 'indeterminate'
  onChange: (v: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const id = useId()
  const box = (
    <RCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-paper ring-1 ring-inset ring-[#c9c9c2] transition-colors',
        'hover:ring-green/60 data-[state=checked]:bg-green data-[state=checked]:ring-green',
        'data-[state=indeterminate]:bg-green data-[state=indeterminate]:ring-green disabled:opacity-50',
        className,
      )}
    >
      <RCheckbox.Indicator className="text-white">
        {checked === 'indeterminate' ? <span className="block h-0.5 w-2 rounded bg-white" /> : <Check className="size-3.5" strokeWidth={3} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  )
  if (!label) return box
  return (
    <div className="flex items-start gap-2.5">
      <div className="pt-0.5">{box}</div>
      <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
        <span className="font-medium text-text">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-text-2">{description}</span>}
      </label>
    </div>
  )
}

/** Two to five mutually exclusive options as one pill: filters, frequencies. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex max-w-full overflow-x-auto rounded-[10px] bg-ink/[.05] p-0.5 scrollbar-none', className)}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-9 px-3 text-[13px] pointer-coarse:h-10',
              on ? 'bg-paper text-text shadow-[0_1px_2px_rgba(20,26,24,.1),0_0_0_1px_rgba(20,26,24,.04)]' : 'text-text-2 hover:text-text',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn('nums rounded-full px-1.5 text-[11px]', on ? 'bg-green-pale text-green' : 'bg-ink/[.06] text-text-2')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Large tappable choices — a frequency, a designation — each a card. */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 3,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; hint?: ReactNode; disabled?: boolean }[]
  columns?: 2 | 3 | 4
}) {
  return (
    <div role="radiogroup" className={cn('grid gap-2', { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns])}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-h-12 flex-col items-start justify-center rounded-xl px-3.5 py-2.5 text-left transition-all duration-150',
              'ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-45',
              on ? 'bg-green-50 ring-2 ring-green' : 'bg-paper ring-line hover:ring-[#c9c9c2]',
            )}
          >
            <span className={cn('text-sm font-medium', on ? 'text-green' : 'text-text')}>{o.label}</span>
            {o.hint && <span className="mt-0.5 text-[12px] leading-snug text-text-2">{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-[10px] bg-red-pale px-3.5 py-2.5 text-[13.5px] text-red">
      {message}
    </div>
  )
}
