import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { Close } from '../components/icons'

/* ---------------------------------------------------------------------------
   About, section 4 of 5: who decides.

   ⚠ THE FOUR NAMES, FACES AND BIOGRAPHIES BELOW ARE NOT REAL ⚠
   Nothing on the page says so any more — the visible placeholder marks were
   taken off at the client's request — so this comment and the PLACEHOLDER in
   the image filenames are the only things left standing between a mockup and a
   published lie about a registered charity's board. Do not ship this section
   without replacing all four seats.

   The photographs are Pexels stock portraits of real people who have nothing to
   do with this charity, which is why every one of them carries an empty alt
   attribute: the picture is not of the person named beside it, and it should
   not tell a screen reader that it is. They are under
   public/assets/images/placeholder/ with PLACEHOLDER in the filename.

   To make a seat real: put the true name, photograph and biography on it and
   delete its `placeholder` flag. When the last flag goes, delete the flag from
   the type, the grayscale on the tiles (it is there to make four mismatched
   stock photographs look like one set — real portraits shot on one day will
   not need it), and the placeholder image folder.

   WHAT IS ACTUALLY TRUE HERE
   The offices and their remits — chair, treasurer, secretary, and what each is
   responsible for. The ACNC register lists three responsible persons, which is
   why the fourth tile is an operations seat rather than a board one: a fourth
   board member would contradict a fact this site states elsewhere.

   THE TILES, AND WHY THE REMIT IS BEHIND THEM
   The board is a row of faces with a name and an office under each, and what
   the office is responsible for opens in a dialog when you ask for it. Printed
   side by side, those paragraphs made this the densest block on the page and
   the least read: a reader here wants to know who these people are, and only
   some of them want the constitutional detail about who signs what. It is one
   click away rather than gone, and every word is still in the markup for
   anyone who searches the page.

   The dialog is the same shape as MobileDrawer's: escape closes it, tab is kept
   inside it, the page behind it cannot scroll, and focus goes back to the tile
   that opened it. It is portalled to the body so no ancestor's overflow or
   transform can ever clip it.

   THE PAY STATEMENT IS GONE, and it was taken off at the client's request
   rather than lost. It stated four things — an unpaid board, a small paid
   office, unpaid volunteers, and a financial year ending 30 June — and two of
   them were still marked "to confirm" when it came off. Nothing else on the
   site now says whether a board member is paid, and since AboutLimits was
   removed too, nothing says what the running costs come out of either. Those
   two went in separate requests and the gap they leave is the same one: a
   reader who wants to know where their money stops and the salaries start has
   nowhere on this site to look. If the pay statement goes back, it goes back
   with the annual information statement behind it.

   TODO before launch:
     - the real names, roles, photographs and biographies. 640×800 or better,
       into public/assets/images. Shoot them on the same day against the same
       wall if you can — a row of portraits is only as good as its least
       consistent frame, and that is the whole reason these four are desaturated.
     - if the board is more than three by the time this ships, add the seats —
       the row wraps on its own.
--------------------------------------------------------------------------- */

type Seat = {
  /** The office, which we know. */
  role: string
  /** True while the name, face and biography on this seat are invented. */
  placeholder?: boolean
  /** The person in it. */
  name?: string
  /** Portrait, 4:5, from public/assets/images. */
  photo?: string
  /** What the seat is responsible for, in a sentence. This part is real. */
  remit: string
  /** Who the person is. Invented until the flag above comes off. */
  bio?: string
}

const BOARD: Seat[] = [
  {
    role: 'Chair',
    placeholder: true,
    name: 'Yusuf Rahman',
    photo: '/assets/images/placeholder/PLACEHOLDER-portrait-1.jpg',
    remit: 'Calls the meetings, signs off the appeals we take on, and is the person a complaint about the organisation ends with.',
    bio: 'A secondary school principal in western Sydney for eleven years before this, and one of the people who packed the first container in 2021. Chairs the four meetings a year, reads every partner report before the board sees it, and answers the complaints line himself.',
  },
  {
    role: 'Treasurer',
    placeholder: true,
    name: 'Aisha Karim',
    photo: '/assets/images/placeholder/PLACEHOLDER-portrait-2.jpg',
    remit: 'Holds the zakat ledger apart from the general one, prepares the accounts for audit, and approves every transfer that leaves the country.',
    bio: 'A chartered accountant who spent nine years auditing not-for-profits before joining the board. She built the two-ledger system the zakat policy rests on, and no transfer leaves the country without her signature and a second one beside it.',
  },
  {
    role: 'Secretary',
    placeholder: true,
    name: 'Bilal Hassan',
    photo: '/assets/images/placeholder/PLACEHOLDER-portrait-3.jpg',
    remit: 'Keeps the minutes and the register, and files the annual information statement the ACNC publishes.',
    bio: 'A solicitor working in community legal centres, and the person who keeps this organisation compliant with the things charities most often forget. If a date, a policy or a register entry on this site is wrong, it is his job to find it first.',
  },
  {
    role: 'Operations',
    placeholder: true,
    name: 'Fatima Noor',
    photo: '/assets/images/placeholder/PLACEHOLDER-portrait-4.jpg',
    remit: 'Runs the Silverwater warehouse and the packing days: what goes in a pack, what it costs, and which container it leaves in.',
    bio: 'Came for one packing day in 2022 and never stopped. She runs the roster, the stock and the shipping paperwork, and she is the reason a food pack costs what the appeal page says it costs rather than what somebody hoped it would.',
  },
]

/* The face, or the absence of one. A seat with no photograph is drawn as an
   unfilled seat — a dashed tile with the office's initial on it — rather than a
   stock silhouette, which would read as a person we are declining to name.

   The same component draws the tile in the row and the portrait in the dialog.
   `tile` is what separates them: in the row the photographs are desaturated and
   come up to full colour under a pointer, which is the only thing making four
   stock portraits shot by four photographers look like one set. In the dialog,
   where there is one face and nothing to match it to, they are left alone. */
function Portrait({ seat, tile = false }: { seat: Seat; tile?: boolean }) {
  if (seat.photo && seat.name) {
    return (
      <div className="aspect-[4/5] w-full overflow-hidden bg-green-pale/40">
        <img
          src={seat.photo}
          /* A stock face is not a picture of the person named beside it, so it
             describes nothing and leaves the naming to the button's own
             label. */
          alt={seat.placeholder ? '' : `${seat.name}, ${seat.role}`}
          width={640}
          height={800}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover ${
            tile
              ? 'grayscale transition-[transform,filter] duration-[700ms] ease-brand group-hover:scale-[1.04] group-hover:grayscale-0'
              : ''
          }`}
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex aspect-[4/5] w-full items-center justify-center rounded-xl border border-dashed border-line bg-green-pale/50"
    >
      <span className="font-display text-[clamp(28px,4vw,40px)] leading-none text-green/35">
        {seat.role.charAt(0)}
      </span>
    </div>
  )
}

/* What opens when a tile is asked to explain itself. Everything about it is
   MobileDrawer's dialog behaviour, because there is no reason for two dialogs
   on one site to behave differently. */
function SeatDialog({ seat, onClose }: { seat: Seat; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)

  /* The page behind must not scroll while this is over it. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /* Escape closes it, and Tab is kept inside it. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /* Opening moves focus in; AboutTeam hands it back to the tile on close. */
  useEffect(() => {
    panelRef.current?.querySelector('button')?.focus()
  }, [])

  /* Portalled to the body: a fixed panel inside a section is at the mercy of
     every ancestor between it and the root, and one transform or overflow
     anywhere up that chain turns "over the page" into "inside a section". */
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-s2 sm:p-s4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_200ms_var(--ease-brand)_both] bg-ink/65"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-dialog-name"
        className="relative max-h-[88vh] w-full max-w-[860px] animate-[hero-rise_320ms_var(--ease-brand)_both] overflow-y-auto rounded-2xl bg-paper p-s3 shadow-nav sm:p-s4"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-s2 right-s2 z-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-text transition-[background-color,border-color,color] duration-200 ease-brand hover:border-ink hover:bg-ink hover:text-paper sm:top-s3 sm:right-s3"
        >
          <Close className="h-5 w-5" />
        </button>

        <div className="grid gap-s3 sm:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] sm:gap-s4">
          <div className="overflow-hidden rounded-xl">
            <Portrait seat={seat} />
          </div>

          <div className="sm:pt-s2">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-green uppercase">
              {seat.role}
            </p>
            <h3
              id="seat-dialog-name"
              className="mt-s1 max-w-[16ch] pr-s4 font-display text-[clamp(24px,3vw,32px)] leading-snug"
            >
              {seat.name ?? 'Name to come'}
            </h3>

            {/* The remit first, because it is the part that stays true
                whoever is sitting in the seat. */}
            <p className="mt-s2 max-w-[46ch] text-[15.5px] leading-relaxed text-text-2">
              {seat.remit}
            </p>

            {seat.bio && (
              <p className="mt-s2 max-w-[46ch] text-[15px] leading-relaxed text-text-2">
                {seat.bio}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function AboutTeam() {
  /* Which seat is open, by index. Null is closed — there is no separate `open`
     flag to fall out of step with it. */
  const [openSeat, setOpenSeat] = useState<number | null>(null)

  /* The tile that opened the dialog, so focus can be handed back to exactly
     the thing the reader left rather than to the top of the document. */
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const close = useCallback(() => {
    setOpenSeat(null)
    triggerRef.current?.focus()
  }, [])

  return (
    /* On the page's one ground, like every other section since 17 September
       2026 (it was a sand band), with the shared SectionHead. The faces run
       out to the same breakout edges as the panels above. */
    <section
      id="team"
      aria-labelledby="team-head"
      /* The mega menu links straight here, so the heading has to clear the
         sticky bar when it lands. */
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="team-head"
          eyebrow="Board & team"
          title="The people accountable for your gift."
          lede="Three people carry the legal responsibility for this charity, and the fourth runs the warehouse the packs go out of. Open a seat to read what it covers."
        />

        {/* One row on anything above a phone. Two up on a phone, because four
            faces across a 390px screen are four thumbnails. */}
        <ul className={`mt-s4 grid grid-cols-2 gap-x-s2 gap-y-s4 sm:grid-cols-4 sm:gap-x-s3 lg:mt-s5 ${BREAKOUT}`}>
          {BOARD.map((seat, i) => (
            <li key={seat.role}>
              {/* Each face arrives a beat behind the one to its left. The four
                  enter the viewport together, so this staggers rather than
                  merely delays. */}
              <Reveal variant="clip" delay={i * 80}>
                {/* The whole tile is the control, not just the plus — a 36px
                    target in a corner is a target you have to aim at, and
                    there is nothing else on the tile to click. */}
                <button
                  type="button"
                  onClick={(e) => {
                    triggerRef.current = e.currentTarget
                    setOpenSeat(i)
                  }}
                  aria-haspopup="dialog"
                  className="group block w-full cursor-pointer text-left"
                >
                  <div className="relative overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(21,26,24,0.06)] sm:rounded-2xl transition-shadow duration-300 ease-brand group-hover:shadow-[0_18px_40px_-24px_rgba(21,26,24,0.5)]">
                    <Portrait seat={seat} tile />

                    {/* The name on the photograph, as the home page's tiles
                        carry their words: an ink fade and the type over it. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 via-45% to-transparent"
                    />
                    <span className="absolute inset-x-0 bottom-0 block p-s2 sm:p-s3">
                      <span className="block text-[10.5px] font-semibold tracking-[0.16em] text-gold-pale uppercase sm:text-[11px]">
                        {seat.role}
                      </span>
                      <span className="mt-1 block font-display text-[clamp(17px,1.6vw,22px)] leading-[1.1] font-semibold tracking-[-0.015em] text-paper">
                        {seat.name ?? 'Name to come'}
                      </span>
                    </span>

                    {/* Stays a plus under a pointer, filling with the logo teal (user's call, 17 Sep
                        2026: it used to turn into a dark cross, which read as
                        "close"). It only grows a little; a click opens the
                        seat's dialog. */}
                    <span
                      aria-hidden="true"
                      className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-paper font-sans text-[22px] leading-none text-ink shadow-[0_2px_10px_-2px_rgba(21,26,24,0.35)] transition-[transform,background-color,color] duration-300 ease-brand group-hover:scale-110 group-hover:bg-teal group-hover:text-paper"
                    >
                      +
                    </span>
                  </div>

                  {/* What the seat covers, under the tile. */}
                  <p className="mt-s2 line-clamp-2 text-[13.5px] leading-snug text-text-2">
                    {seat.remit}
                  </p>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>

      {openSeat !== null && <SeatDialog seat={BOARD[openSeat]} onClose={close} />}
    </section>
  )
}
