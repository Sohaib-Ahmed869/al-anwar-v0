import { useId, useState } from 'react'

import { ChevronDown } from './icons'

/* ---------------------------------------------------------------------------
   An accordion of ruled rows: a hairline, the question, a chevron. Used by the
   Zakat page's questions and the Give page's, so the two behave identically.

   Open as many as you like — somebody comparing two answers should not lose the
   first by opening the second. The answer opens by animating a grid row from
   0fr to 1fr, the one CSS-only way to animate to an unknown height; the closed
   panel stays in the DOM, `inert`, so it is out of the tab order but there for
   the animation to reveal.
--------------------------------------------------------------------------- */

export default function FaqList({
  items,
  /** which rows start open; the first, by default */
  initiallyOpen = [0],
}: {
  items: { q: string; a: string }[]
  initiallyOpen?: number[]
}) {
  const uid = useId()
  const [open, setOpen] = useState<Set<number>>(() => new Set(initiallyOpen))

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <ul className="border-b border-line">
      {items.map((item, i) => {
        const isOpen = open.has(i)
        return (
          <li key={item.q} className="border-t border-line">
            <h3>
              <button
                type="button"
                id={`${uid}-q${i}`}
                aria-expanded={isOpen}
                aria-controls={`${uid}-a${i}`}
                onClick={() => toggle(i)}
                className="group flex w-full items-center justify-between gap-s2 py-[18px] text-left"
              >
                <span
                  className={`text-[16.5px] leading-snug font-semibold tracking-[-0.01em] text-text transition-colors duration-200 ease-brand ${
                    isOpen ? '' : 'group-hover:text-green'
                  }`}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[transform,border-color,background-color] duration-300 ease-brand ${
                    isOpen
                      ? 'rotate-180 border-green bg-green text-paper'
                      : 'border-line text-text-2 group-hover:border-green group-hover:text-green'
                  }`}
                >
                  <ChevronDown className="h-3 w-3" />
                </span>
              </button>
            </h3>
            <div
              id={`${uid}-a${i}`}
              role="region"
              aria-labelledby={`${uid}-q${i}`}
              inert={!isOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-brand ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p className="max-w-[60ch] pr-s5 pb-s3 text-[15px] leading-relaxed text-text-2">{item.a}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
