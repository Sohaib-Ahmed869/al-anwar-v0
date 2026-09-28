import { useId, useRef, useState } from 'react'
import { Popover } from 'radix-ui'

/* ---------------------------------------------------------------------------
   A small (i) beside a label that explains it in a sentence or two. Added
   28 September 2026 for the zakat calculator, where a reader who has never
   worked out zakat needs to know what counts under each heading.

   WHY A POPOVER AND NOT A TOOLTIP
   Radix's Tooltip only opens on hover and keyboard focus, and a phone has
   neither, so a tap would do nothing. This is a Popover driven by hand: a
   mouse opens it on hover and closes it on leaving, a tap or click toggles
   it, and keyboard focus opens it. Escape and a tap outside close it, which
   Radix gives us. The panel carries role="tooltip" and is tied to the button
   with aria-describedby, so a screen reader reads the explanation with the
   button's name.

   The button is teal, not gold: gold is only for the give action. It keeps a
   44px touch target through padding while the drawn circle stays small.
--------------------------------------------------------------------------- */

export default function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  /* Radix's trigger toggles on click, but focus has usually opened the panel a
     moment before the click lands (a tap focuses first), so its toggle would
     shut it again. The button toggles by hand from what the state was when the
     press began; a mouse click always leaves it open, since hover opened it. */
  const wasOpen = useRef(false)
  const byMouse = useRef(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          aria-expanded={open}
          aria-describedby={open ? tipId : undefined}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
          onPointerDown={(e) => {
            wasOpen.current = open
            byMouse.current = e.pointerType === 'mouse'
          }}
          onKeyDown={() => {
            wasOpen.current = open
            byMouse.current = false
          }}
          onFocus={() => setOpen(true)}
          onClick={(e) => {
            e.preventDefault()
            setOpen(byMouse.current ? true : !wasOpen.current)
            byMouse.current = false
          }}
          className="-m-2.5 inline-grid shrink-0 place-items-center rounded-full p-2.5 align-middle text-teal/70 transition-colors duration-200 ease-brand hover:text-teal focus-visible:text-teal"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-[15px] w-[15px]" fill="none">
            <circle cx="8" cy="8" r="6.9" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          id={tipId}
          role="tooltip"
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
          className="z-[60] max-w-[min(300px,calc(100vw-32px))] rounded-[10px] bg-ink px-3.5 py-3 text-[13px] leading-[1.5] font-normal text-paper shadow-card"
        >
          {text}
          <Popover.Arrow className="fill-ink" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
