import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Dialog as RDialog } from 'radix-ui'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'
import { cn } from './cn'
import { useIsMobile } from './hooks'

/* ---------------------------------------------------------------------------
   Overlays.

   <Dialog> is a centred modal on a wide screen and a bottom sheet you can
   drag down to dismiss on a phone — the same component, so every form in the
   portals is thumb-friendly without anyone thinking about it.

   <Sheet> is the detail panel: slides in from the right on a wide screen,
   up from the bottom on a phone. Lists open their records in one so the
   person never loses their place in the list.

   useConfirm() returns an async confirm(): `if (await confirm({...}))`.
--------------------------------------------------------------------------- */

type DialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** keep the sheet from being dragged away mid-form */
  dismissible?: boolean
}

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', dismissible = true }: DialogProps) {
  const mobile = useIsMobile()
  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={dismissible} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[20px] bg-paper outline-none">
            <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-ink/15" aria-hidden />
            <div className="px-5 pt-3 pb-2">
              <Drawer.Title className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-[13.5px] leading-relaxed text-text-2">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Drawer.Description>
              )}
            </div>
            {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-4">{children}</div>}
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line-2 px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] [&>*]:w-full">
                {footer}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <RDialog.Content
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(88vh,860px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl bg-paper shadow-pop outline-none data-[state=open]:animate-[dialog-in_220ms_var(--ease-reveal)]',
            { sm: 'max-w-[420px]', md: 'max-w-[540px]', lg: 'max-w-[720px]', xl: 'max-w-[960px]' }[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0">
              <RDialog.Title className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-[13.5px] leading-relaxed text-text-2">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-text-3 transition-colors hover:bg-ink/5 hover:text-text" aria-label="Close">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-1 pb-5">{children}</div>}
          {footer && <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-line-2 bg-paper-2/60 px-6 py-3.5">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 520,
  headerExtra,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  headerExtra?: ReactNode
}) {
  const mobile = useIsMobile()
  if (mobile) return <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} footer={footer}>{children}</Dialog>
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/25 data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <RDialog.Content
          style={{ width: `min(${width}px, calc(100vw - 24px))` }}
          className="fixed inset-y-2 right-2 z-50 flex flex-col rounded-2xl bg-paper shadow-pop outline-none data-[state=open]:animate-[sheet-in_280ms_var(--ease-reveal)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-line-2 px-6 pt-5 pb-4">
            <div className="min-w-0 flex-1">
              <RDialog.Title className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-[13.5px] text-text-2">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">Details</RDialog.Description>
              )}
              {headerExtra}
            </div>
            <RDialog.Close className="-mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-text-3 transition-colors hover:bg-ink/5 hover:text-text" aria-label="Close">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line-2 px-6 py-3.5">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ---------- confirm ---------- */
type ConfirmOpts = {
  title: ReactNode
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: ButtonVariant
  /** make the person type this before the button enables — for merges and deletions */
  typeToConfirm?: string
}

const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<(v: boolean) => void>(() => {})
  const confirm = useCallback((o: ConfirmOpts) => {
    setTyped('')
    setOpts(o)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])
  const close = (v: boolean) => {
    resolver.current(v)
    setOpts(null)
  }
  const blocked = Boolean(opts?.typeToConfirm && typed.trim() !== opts.typeToConfirm)
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(opts)}
        onOpenChange={(v) => !v && close(false)}
        title={opts?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {opts?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={opts?.tone ?? 'primary'} disabled={blocked} onClick={() => close(true)} autoFocus={!opts?.typeToConfirm}>
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {(opts?.body || opts?.typeToConfirm) && (
          <div className="space-y-4 text-[14px] leading-relaxed text-text-2">
            {opts?.body}
            {opts?.typeToConfirm && (
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-text">
                  Type <strong className="font-semibold">{opts.typeToConfirm}</strong> to confirm
                </span>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="h-10 w-full rounded-[10px] bg-paper px-3 text-[16px] ring-1 ring-line ring-inset focus:ring-2 focus:ring-green/70 focus:outline-none sm:text-sm"
                />
              </label>
            )}
          </div>
        )}
      </Dialog>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
