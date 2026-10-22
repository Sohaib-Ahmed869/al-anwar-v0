import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from './cn'
import { Spinner } from './Spinner'

/* ---------------------------------------------------------------------------
   Buttons.

   primary    green — the main action on a screen that is not asking for money
   give       gold — the give action, and nothing else (the site's one rule)
   secondary  white with a hairline — everything alongside the main action
   ghost      no ground until hovered — toolbars, rows, icon buttons
   danger     red — irreversible things, and only inside a confirmation
   subtle     green-50 ground — a quiet positive action inside a card

   Every size keeps a 40px+ hit area on touch screens; `sm` grows back to 40
   under the `pointer: coarse` media query rather than being a trap on a phone.
--------------------------------------------------------------------------- */

const VARIANTS = {
  primary:
    'bg-green text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_1px_2px_rgba(8,38,42,.18)] hover:bg-green-600 active:bg-green-600',
  give: 'bg-gold text-ink shadow-gold hover:bg-gold-dark hover:shadow-gold-lg active:bg-gold-dark',
  secondary:
    'bg-paper text-text ring-1 ring-inset ring-line shadow-[0_1px_2px_rgba(8,38,42,.05)] hover:bg-paper-2 hover:ring-[#dccdb2] active:bg-sand',
  ghost: 'text-text-2 hover:bg-ink/[.05] hover:text-text active:bg-ink/[.08]',
  danger: 'bg-red text-white hover:bg-[#8e3017] active:bg-[#8e3017]',
  subtle: 'bg-green-50 text-green hover:bg-green-pale active:bg-green-pale',
} as const

const SIZES = {
  xs: 'h-7 gap-1 rounded-md px-2 text-[12.5px] [&_svg]:size-3.5',
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px] [&_svg]:size-4 pointer-coarse:h-10',
  md: 'h-10 gap-2 rounded-[10px] px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px] [&_svg]:size-[18px]',
} as const

export type ButtonVariant = keyof typeof VARIANTS
export type ButtonSize = keyof typeof SIZES

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'relative inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap',
    'transition-[background-color,box-shadow,color,transform] duration-150 ease-[var(--ease-brand)]',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant, size, loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-[inherit]">
            {icon}
            {children}
            {iconRight}
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        </>
      ) : (
        <>
          {icon}
          {children}
          {iconRight}
        </>
      )}
    </button>
  )
})

export function ButtonLink({
  variant,
  size,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconRight?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

/** A square icon-only button. `label` is required: it is the accessible name
 *  and the tooltip-less description of what it does. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<Props, 'icon' | 'children'> & { label: string; children: ReactNode }>(
  function IconButton({ label, size = 'md', variant = 'ghost', className, children, ...rest }, ref) {
    const sq = { xs: 'w-7 px-0', sm: 'w-8 px-0 pointer-coarse:w-10', md: 'w-10 px-0', lg: 'w-12 px-0' }[size]
    return (
      <Button ref={ref} aria-label={label} title={label} variant={variant} size={size} className={cn(sq, className)} {...rest}>
        {children}
      </Button>
    )
  },
)
