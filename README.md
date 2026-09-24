# Al-Anwaar — website and donation platform

React + Vite + Tailwind v4 + TypeScript on the front; Node + Express 5 + MongoDB
(Mongoose) behind it — the MERN stack the proposal names.

## Run it

```
npm install
npm run dev        # the site on http://localhost:5190 and the API on :4600, together
npm run typecheck  # client and server
npm run build      # type-check both, then build the site to dist/
npm start          # the API (NODE_ENV=production also serves dist/)
```

Nothing has to be installed or configured for development. With no `.env`:

- **the database** is an embedded MongoDB whose files live in `.data/mongo`, and it
  seeds itself with two years of invented giving the first time (`SEED_RESET=1` wipes
  and re-seeds). Set `MONGODB_URI` for Atlas.
- **email** is not sent. Every message — receipts, sign-in codes, reminders — is kept
  in Admin → Email log, rendered exactly as it would arrive. Set `SMTP_*` (Amazon SES)
  to send for real.
- **payments** are simulated: a card gift goes straight through, and a regular gift on
  a card ending 0002 is declined, so the retry and fix-your-card path can be walked.
  Every screen says "simulated" while this is on. Set `STRIPE_SECRET_KEY` and the
  PayPal keys for the real thing.

`.env.example` lists every setting and what happens when it is empty.

### Signing in, in development

| Portal | Where | Who |
| --- | --- | --- |
| Donor | `/account` | `amina.rahman@example.com` — the six-digit code is shown on screen |
| Admin | `/admin` | `yusuf@` owner · `maryam@` admin · `omar@` finance · `fatima@` fundraising · `bilal@` volunteer — all `@alanwaar.group`, password `alanwaar-demo` |
| Compliance | `/compliance` | `khalid@alanwaar.group` (or any admin/owner), same password |

`node scripts/shot.mjs admin/donors --mobile` screenshots any page, signed in as
anyone (`--as`, `--donor`), into `.data/shots/`.

## The platform

```
shared/            the vocabulary both sides compile: designations, methods, plan and
                   gift statuses, roles and permissions, the ACNC register definitions,
                   the API's types, money formatting. Money is integer CENTS everywhere.
server/
  index.ts         boot: database, seed, HTTP, background jobs
  app.ts           the API under /api — see the map at the top of the file
  models/          Mongoose: Donor, Gift, Plan, Appeal, Fundraiser, Enquiry, Campaign,
                   EmailMessage, BankImport, Staff, AuditEvent, RegisterEntry,
                   Obligation, LibraryDocument, Settings
  lib/             giving.ts (the one road a gift takes in), plans.ts (charging a
                   regular gift, and what a decline does), payments.ts, email.ts,
                   auth.ts, audit.ts, storage.ts (S3 or disk), matching.ts (bank lines)
  emails/          every email the platform sends, one function each
  routes/          auth, public (the website), donor (/api/me), admin, compliance
  jobs/            regular gifts, pre-payment notices, campaign batches, reminders
  seed/            the invented development data
src/
  portal/          the three portals' shared kit: ui/, charts/, shell/, api.ts, session.tsx
  account/         the donor portal       /account
  admin/           the admin portal       /admin
  compliance/      the compliance portal  /compliance
```

**Three audiences, two cookies.** Donors sign in with an emailed code (or Google /
Facebook when their keys are set) and get an `aa_donor` session; staff sign in with a
password and get `aa_staff`. No route accepts both, and every `/api/me` query is scoped
to the signed-in donor — none of them takes a donor id from the request.

**Permissions are one table** (`shared/access.ts`). The server checks it on every
route and the portals read the same table to decide what to draw, so a volunteer
entering cash gifts is never shown an export button and cannot call one either.

**Every change is logged** with the person and the time (`lib/audit.ts`), append-only,
and the compliance portal exports it.

**One road for a gift.** Website checkout, the monthly scheduler, a confirmed bank
line and a cash gift at an event all go through `recordGift()`, which is what makes
one donor record and one receipt trail true.

**The portals are separate chunks**, lazy-loaded from `App.tsx` outside the public
`Layout`; a visitor reading an appeal never downloads them.

### Deploying

One process serves the API and, with `NODE_ENV=production`, the built site from
`dist/`: `npm run build && NODE_ENV=production npm start` on AWS (EC2, ECS or App
Runner) with `MONGODB_URI`, `JWT_SECRET`, `APP_URL`, SES SMTP, Stripe, PayPal and
`S3_BUCKET` set. The Stripe webhook is `POST /api/webhooks/stripe`
(`checkout.session.completed`). The Vercel handlers in `api/` predate the server and
are superseded by it.

## Where things are

```
src/
  main.tsx          entry
  App.tsx           every route, in one file
  index.css         the whole design system (see below)
  components/
    Layout.tsx      Header + <Outlet/> + Footer
    Header.tsx      the navbar: strips, dropdown panels, scroll behaviour
    MobileDrawer.tsx  the same menu, as a full-screen drawer
    nav-data.ts     the menu as data — edit links here, not in the markup
    org-data.ts     legal name, ABN, address — the facts the legal pages must state exactly
    contact-data.ts every word on the contact page, so the four sections hold none
    icons.tsx       the header's inline SVGs
    Footer.tsx
    Letter.tsx      the sign-up, rendered by Footer as its first block (see below)
    letter-data.ts  every word in it, including two promises to keep
    GiveModule.tsx  the amount ladder, frequency toggle, fee ask and gold button
    Reveal.tsx      fade-up as a section arrives, once, IntersectionObserver
  services/
    contact.ts      the contact payload, its rules, and where it posts.
                    Imported by BOTH the form and api/contact.ts — the rules
                    have to be the same in the browser and on the server.
    letter.ts       the same shape for the letter: one field, one rule, imported
                    by BOTH the footer block and api/letter.ts. It borrows
                    contact.ts's `looksLikeEmail` rather than keeping a
                    second opinion about what an address is.
  pages/            one file per page, flat
  sections/         one file per section of a page, named <Page><Section>.tsx
api/
  contact.ts        POST handler for the contact form. NOT WIRED UP — this repo
                    builds to a static bundle and has no host. See the note at
                    the top of the file.
  letter.ts         POST handler for the sign-up. NOT WIRED UP either, and its
                    header lists the three things — double opt-in, an
                    unsubscribe link, the privacy policy — that are law rather
                    than taste before it goes live.
public/
  assets/
    images/         logos, field photographs, ACNC badge
    videos/         the field video
```

## The navbar

`nav-data.ts` is the single source of truth: the desktop panels and the mobile drawer
both read `NAV`, so a link is only ever added in one place. A section's `layout` picks
its panel — `mega` (four columns, spans the page), `two`, or `single` — and `match`
lists the paths that light it up as the current section.

What it does, and why:

- **Opens on hover with intent.** The first panel waits 90ms so the pointer can cross
  the bar without flashing menus open; once one is showing the rest swap instantly.
  Closing waits 220ms, and an invisible bridge spans the gap between button and panel
  so the pointer can travel down without the menu deciding it has been left.
- **Works from the keyboard.** Tab to a button and its panel opens, arrows walk the
  links, Escape closes and returns focus to the button. Closed panels carry `inert`,
  so Tab never lands on a link nobody can see.
- **Sits inside the hero where there is one.** `OVERLAY_ROUTES` at the top of `Header.tsx`
  lists the routes that open on a full-bleed photograph — the home page and the two legal
  pages — and on those the bar starts transparent with light type and takes its paper back
  the moment it has something to cover. Anything added to that list has to pull itself up
  behind the bar by `--header-h`, the way `HomeHero` and `LegalHero` do.
- **Shrinks on scroll** past 80px: 76px tall becomes 60px, and the logo shrinks with
  it. It only grows back under 40px — two thresholds, not one. The header is in normal
  flow, so shrinking it makes the document 16px shorter; at the foot of a short page
  the browser clamps the scroll position, which under a single threshold could land
  you back below it and start the whole thing over. The gap between 40 and 80 is wider
  than the clamp, so the loop cannot close. The handler is throttled through
  `requestAnimationFrame` and sets one boolean, so scrolling costs a re-render only
  when the header actually changes size.
- **The emergency strip dismisses for seven days**, stored in `localStorage` under
  `alanwaar:emergency-dismissed`.
- **Gold stays the give action.** The Donate button is the only gold in the header;
  everything else that reacts goes green. See `DESIGN-NOTES.md`.

Below 1024px the bar collapses into the drawer: focus is trapped inside it, Escape
closes it, the page behind stops scrolling, and closing hands focus back to the burger.

`public/assets/` is the **only** copy of the media — the prototypes one folder up load
from it too. Anything in `public/` is served at the site root, so
`public/assets/images/logo.png` is `/assets/images/logo.png` in an `<img src>`.

`dist/` is generated by `npm run build` and is not edited by hand. It is wiped and
rebuilt every time, and it is gitignored:

```
dist/
  index.html
  assets/           a verbatim copy of public/assets/ — the media that ships with the site
  build/            the hashed JS and CSS bundles
```

Vite's default would put the bundles in `dist/assets/` as well, mixed in with the
media. `build.assetsDir` in `vite.config.ts` moves them to `dist/build/` so the two
stay legible.

## The letter

`components/Letter.tsx` is the first block inside the footer, on every page: a
monthly letter about where the last delivery went, and one field to ask for it.
It is rendered by `Footer.tsx` rather than by `Layout`, and it carries no ground
of its own — the footer's ink runs straight through it. One dark region with two
rooms in it: the ask, a hairline, then the directory.

- **It is not a band, and it was one.** A `paper-2` strip between the last
  section and the footer made the foot of every page three grounds deep and put
  the loudest change of colour on the screen immediately before the small print.
  Sharing the footer's ink costs it nothing — it is still the quietest thing on
  the page — and buys the page one ending instead of two.
- **What holds it apart from the columns below** is three things, none of them a
  box: the hairline the footer already draws above its small print, repeated
  here; 64px of air on either side of it; and one soft green wash falling from
  the corner the heading starts in, the same move the hadith strip on the About
  page makes, so the ink reads as a ground rather than a slab.
- **Nothing in it is brand green, and that is not a preference.** `#2F6B5A` on
  `#151A18` is 2.8:1. The site settled this on the contact page's dark panel:
  the accent on ink is `green-pale`, a complaint is `alert-pale`, an eyebrow is
  `paper/75`.
- **Nothing in it is filled either.** Subscribe was a green slab at the end of
  the field, and it read as a second Donate — the give action is gold and it is
  at the top of every page, and nothing down here should compete for the same
  glance. It is set as type instead, in the label's own uppercase, standing on
  the end of the field's rule, with the paper plane the contact form's Send
  button uses. It keeps a 46px box, so the tap target survived the change.
- **The focus ring moved into the rule.** The design system draws 2px of gold
  around anything focused, which is right for a button and wrong for a field
  with three sides missing — it put a rectangle around a line. Gold is not lost:
  the rule under the field is gold and 6.9:1 on ink, so the field is still never
  focused without something showing. The field also refuses Chrome's autofill
  wash, which would otherwise paint a white slab with near-black type across the
  ink; the two `-webkit-` properties in `FIELD` are the only way to say no.
- **The error line is always in the layout**, empty or not. The column is
  bottom-aligned against the paragraph beside it, so a message appearing out of
  nothing would shove the field and the button up as somebody reached for them.
- **It never shows a tick for something that did not happen.** `ENDPOINT` in
  `services/letter.ts` is empty, so today the button hands a one-line message to
  the writer's own email client and the reply says exactly that. This is the
  contact form's rule, and it matters more here, not less: an address typed into
  a box that goes nowhere leaves somebody waiting a month for a letter that is
  never coming.

It says four things and no more: an eyebrow, the offer, a field, a button. The
paragraph under the heading and the small print under the field are both gone —
a footer is not where anybody reads two sentences of explanation, and the
privacy policy is still one link away in the footer's own bottom row.

The title in `letter-data.ts` is an undertaking rather than copy: "once a month"
is a promise to everybody who hands over an address, and the office has to be
able to keep it. If the letter will go out on some other rhythm, that file
changes first.

## One ground and a drawn seam

The home page runs on **one colour** from the header to the footer. It used to
alternate paper and sand — paper, sand, paper, sand, paper, ink — and that is
gone. Where a colour change used to say a section had ended, a drawn divider
says it instead.

- **`--color-ground` in `index.css` is the page's colour, and it is one line.**
  It is `paper-2` (`#F5F5F2`). Set it to `var(--color-paper)` and the site goes
  white; nothing else has to change. `body` takes it, so every section inherits.
- **No section on the home page may set a background of its own.** That is the
  whole mechanism. `HomeAsk` and `HomeZakat` each lost `bg-sand` *and* the green
  radial wash that was sitting on it — the wash was kept for one round on the
  reasoning that it was texture rather than separation, and it was not: at a
  tenth of green across the full width of a band it just redrew the alternation
  in a cooler grey.
- **`components/Divider.tsx` is the seam**, in two weights — `rule` and `mark`.
  `mark` is the home page's section breaker and is used at all four seams
  (client's direction, 16 September 2026); `rule` is the same hairline without
  the building, and is what the other pages should reach for when they follow.
- **The mark is a line with a masjid standing on it, not a badge in a gap.** The
  glyph's ground is the last two units of its viewBox, and `Marked` aligns the
  row on `items-end`, so the two hairlines land on exactly the line the building
  stands on. Centred instead — which it was — the rules cut across the dome two
  thirds of the way up and the base hung below them. If the glyph is ever
  redrawn, keep the ground at the bottom edge of the box or that comes back.
- **It is drawn, not traced.** A trace of the logo bitmap was in `Ornament.tsx`
  for a while: accurate, and mush at the 32px a divider actually uses it, with
  the lock-up's single off-centre minaret making a centred ornament lean. The
  glyph has two minarets where the artwork has one, on purpose.
- **There were two more and they are gone.** `skyline` (a horizon of domes) and
  `tile` (an eight-point star lattice) came off at the client's request on
  16 September 2026, and the home page's two uses became plain rules — a seam is
  still needed, because on one ground the divider is the only thing saying a
  section ended. Both are recoverable: the paths, the tile's data URI and the
  two things that were awkward about each are recorded at the head of
  `Divider.tsx`. The lesson worth keeping is that the pattern work on this site
  has consistently been the first thing to feel like too much, and the hairline
  has consistently been enough.
- **The dividers are punctuation, not decoration.** A `mark` between every
  section says nothing at all. `pages/Home.tsx` places four and each one is
  commented with what it is marking.

`About`, `WhereItGoes`, `GetInvolved`, `Zakat` and `Give` still alternate their
grounds. Nothing breaks while they do — the change is per page — but they should
follow, and each one is the same edit: drop `bg-sand` / `bg-paper` / any wash
from the section roots, and place dividers in the page file.

## The masjid mark

`components/Ornament.tsx` takes the dome and minaret out of the logo lock-up and
makes them available on their own. Until now the only place the mark appeared
was inside the logo PNG in the header and the footer, which wasted the one shape
the organisation owns.

Two things come out of it: `MasjidMark` (the full silhouette — dome, minaret
and the sweep they stand on) and `MasjidGlyph` (symmetrical, no sweep, built to
read at 28px, which is what the `mark` divider uses).

Three things to know before editing it:

- **The dome is a pointed bell, not an onion.** Read off the artwork: the
  profile leaves the finial at about 55 degrees, bows outward, and is still
  widening when it reaches the base. Drawn as an onion — pulling back in near
  the foot — it came out a teardrop. `Divider.tsx`'s `Silhouette` carries the
  same profile and has to change in the same commit if this one does.
- **They are drawn, not traced.** A 159x126 bitmap rendered at 28px is mush, and
  28px is where the glyph actually earns its keep.
- **`--ornament-cut` is the colour the arcade under the dome is cut in.** It
  follows the ground, because the same mark on the ink footer with white cuts is
  three bright slots in a silhouette. Anything with a ground of its own
  re-declares it.

**There was an arch, and there is not.** The dome's profile was opened out into
a clip path and used to crop the photographs on the home page's impact rail,
which cost that rail its landscape crop — an arch is a portrait form. It came
off at the client's request on 16 September 2026, and `ArchClip`, `.arch-crop`
and the `<ArchClip />` in `Layout` went with it rather than being left unused.
The path and the two things that were hard-won about it are recorded in a
comment at the foot of `Ornament.tsx` if it is ever wanted back. **The masjid
now appears on the home page in one place only: the dividers.**

**The logo's own colours are not the site's, and that is deliberate.** The
artwork is teal `#006770` and yellow `#FBD208`; the site is `--color-green`
`#2F6B5A` and `--color-gold` `#C89B2C`, both quieter. Do not "correct" one to
the other without deciding which way the whole site goes.

## The design system

`src/index.css` is the only place colours, type and spacing are defined. It is the
prototype's `:root` block ported into Tailwind v4's `@theme`, so each token generates
utilities directly:

| Token | Use it as |
| --- | --- |
| `--color-green` `#2F6B5A` | `bg-green`, `text-green` |
| `--color-gold` `#C89B2C` | `bg-gold` — give actions only |
| `--color-ink` `#151A18` | `bg-ink` |
| `--color-text-2` `#5B6260` | `text-text-2` |
| `--color-line` `#DDDDD8` | `border-line` |
| `--font-serif` Fraunces | `font-serif` — display |
| `--font-sans` Inter Tight | `font-sans` — interface |
| `--spacing-s1..s6` 8/16/24/40/64/104px | `p-s4`, `gap-s2` |
| `--container-page` 1240px | `max-w-page` |

There is no `tailwind.config.js` and no `postcss.config.js` — Tailwind v4 does not need
them. Add a token to `@theme` and the utility exists.

Two rules carried over from `DESIGN-NOTES.md`:

- `.nums` sets tabular lining numerals. **Every amount on the site takes it** so columns
  of money line up.
- Gold is the give action and the focus ring, and nothing else. The moment a second thing
  is gold, the button stops being the brightest thing on the page.

## Porting from the prototype

The finished prototype is `../index.html`, its page-by-page content map is
`../SITE-STRUCTURE.md`, and the reasoning behind the home page is `../DESIGN-NOTES.md`.
Both `../index.html` and `../al-anwaar-prototype-v2.html` load their media from
`Website/public/assets/`, so keep that folder where it is or they go blank.
Those three files are the source of truth. A page file is a table of contents — it
composes its sections and nothing else — and each section of it is one file in
`src/sections/`, so a long page never becomes a long file. `Home.tsx` lists all seven
steps of the home page argument in order and marks off the ones that are done.

Everything below `Home.tsx` is still a stub whose comment header lists the sections that
page needs, apart from the two legal pages, the contact page and the about page, which
are finished.

### What is ported

- **Home, section 1 of 7 — `sections/HomeHero.tsx`.** The fact, the itemised $50 pack
  and the give module, on the prototype's 7/5 split. No photograph: the pack, weighed and
  priced against a donor's own grocery bill, is the evidence (`DESIGN-NOTES.md`). The
  layout flips to one column under 900px and the give module moves up between the pack and
  the small print — proof before the ask — and the pack's third staple takes its own
  full-width row under 520px. The prototype's 900/520 breakpoints are written inline as
  `min-[900px]:` and `max-[520px]:` rather than bent to fit Tailwind's `lg`.
- **`components/GiveModule.tsx`.** One piece of state drives the impact labels, the fee
  line, the button label and its href, so the label is never stale: choose Monthly and the
  three impact labels rewrite themselves and the button gains "a month"; type your own
  amount and the ladder lets go. The fee is stated in dollars and recalculated on every
  change. It sits in `components/` because the appeal and event pages both want one.
- **`pages/Privacy.tsx` and `pages/Terms.tsx`.** The two pages the footer's small print
  points at. Both are the same three parts: `sections/LegalHero.tsx` — one photograph read
  through the home hero's two scrims, pulled up behind the header, carrying the breadcrumb,
  the document in one sentence and the three facts a reader wants before they start. It is
  a band rather than a screen: the home page earns 100svh, a legal page would just be
  putting a wall in front of the clause you came for. Its two photographs are licensed
  stock, credited in that file. Then `sections/LegalBody.tsx`, which is the contents list
  that sticks to the viewport on a wide screen and the numbered clauses beside it. The two section files are
  shared rather than named `<Page><Section>`, because the pages differ only in their words.
  A page file holds the clauses as data and the prose inside a clause carries no classes:
  `LegalBody` styles the paragraphs, lists and links from one place, so the documents stay
  readable as documents. Every clause has an `id`, so anything on the site can link to one.
  The wording is a first draft written to the Australian Privacy Principles and to what a
  DGR-endorsed charity has to say about gifts — **it needs a solicitor before launch**, and
  each file lists what is still a placeholder in its header comment.
- **`pages/About.tsx`, in six sections.** Hero, mission and vision, the dated story, the
  board, the honest limits, and work with us. Its content is not invented: the mission,
  the three values and the hadith are the **previous site's own words**, taken from
  alanwaar.group and kept verbatim rather than smoothed over; the ABN, the 30 July 2020
  registration and the public-benevolent-institution status come from the **ACNC register**
  and are now in `org-data.ts`; the dates in the story are read off our own photographs in
  `public/assets/`. `AboutHero` is the one hero on the site whose photograph is ours — the
  masjid at Jamee Muzafah — so it is the one hero that carries a credit, which is the
  caption rule in `DESIGN-NOTES.md` running the other way for once.
  Three things on that page are deliberately unfinished and say so on screen: the **vision
  is marked a draft** until the board adopts it, the **board seats carry no names** because
  inventing three would have been a lie that looked finished, and the two pay figures wear
  a "to confirm" chip. Each section file lists what has to be settled.
  Two things the ACNC register does not agree with the site about are written up at the top
  of `org-data.ts`: the registered address, and the list of operating countries.
- **`pages/WhereItGoes.tsx`, in eight sections.** The accountability page: the shared ink
  band, four years of filed accounts, the five places as a ledger, the dated distribution
  log, who delivers the work, the sources, registration, and the ask. All of its words and
  figures are in `components/where-data.ts`, whose header explains each set and why it is
  allowed to be printed. Three things are worth knowing before editing it:
  **the accounts are real** — every figure is from the Annual Information Statement lodged
  with the ACNC, which is open data, and the word "audited" must never appear on the page
  because a small charity lodges no financial report and this one has not.
  **The five per-country figures are the only invented numbers on the site's most literal
  page.** They are shown at the client's request (16 September 2026), live in one field
  (`indicative`), wear a "to confirm" chip each, and are set against the real filed total at
  the foot of the section. They deliberately **do not sum to it** and must never be
  reconciled to it — that is written up at the top of `where-data.ts`.
  **Sections disappear rather than apologise.** The distribution log renders nothing at all
  below six dated entries, and a country with no record prints the admission in the space
  its evidence line would occupy. There is no "coming soon" anywhere on the page.
  `nav-data.ts` links the header panel at seven of its anchors and the footer at an eighth,
  so a section that goes takes its menu link with it in the same commit.
  Four things are waiting on the client and each is a TODO in `where-data.ts`: the field
  log, partner names for four of the five places, one Gaza photograph, and the register's
  operating-countries list.

- **`pages/GetInvolved.tsx`, in five sections** (rebuilt 17 September 2026): a teal photo
  hero, then the three ways in that the header menu lists (volunteering, running a
  fundraiser, mosque and school partnerships) and a close. Workplace giving and the social
  feeds were cut the same day.
- **Community fundraisers, `/fundraisers`** (added 17 September 2026 after a peer-to-peer
  campaigns page the user named): browse (`pages/Fundraisers.tsx`), start one in four steps
  with a live preview (`pages/FundraiserStart.tsx`), and a page per fundraiser with a give
  card (`pages/Fundraiser.tsx`). **Every fundraiser raises for one of our real appeals**, and
  its Donate goes to `/give?fundraiser=<slug>`, which books to that appeal's fund.
  **The fundraisers come from the platform** (`GET /api/public/fundraisers`), read through
  `useFundraisers()` / `useFundraiser()` in `services/fundraisers.ts`. One started on
  `/fundraisers/start` is posted to `POST /api/public/fundraisers`: the organiser is found
  or created by email, the page waits in Admin → Fundraisers for approval, they are emailed
  a link to `/account/fundraisers`, and the form ends on "sent for approval" (25 September
  2026; this replaced the localStorage preview and the invented `SAMPLE_FUNDRAISERS`). All of its words are in
  `components/involved-data.ts`. The things to know before editing it:
  **nothing on the page collects a name.** There is no volunteer sign-up, no fundraiser
  wizard and no "register your interest" box, and that is deliberate — the site has no
  server, and the rule at the top of `services/contact.ts` and `services/letter.ts` applies
  hardest here, where somebody offering up a Saturday would simply conclude they were not
  wanted when nobody wrote back. The last section says so to the reader in as many words.
  **The only number on the page is a filed one** — the volunteer count out of the latest
  Annual Information Statement, read live from `where-data.ts`, which is five and is used
  as the invitation rather than hidden.
  **No gold anywhere.** The page does not ask for money; the Donate button at the top of
  every page covers anyone who changed their mind.
  Four of its five calls to action deep-link into the contact form with the subject already
  chosen, which is why `ContactForm` now reads `?topic=` (checked against `TOPICS`, not
  trusted). That added one topic, "Fundraising or an event" — **the office should confirm it
  wants that as a separate pile**, since these strings are inbox routing rather than copy.
  Three TODOs are flagged in `involved-data.ts`: whether the warehouse is in Silverwater or
  Guildford (the site currently says both), whether it can host a corporate packing morning,
  and the standing reminder that every date in the diary is unconfirmed — which matters more
  on this page than anywhere else, because this one invites a stranger to turn up.

- **The events diary came back on 17 September 2026** at the user's request: `/events` (no per-event pages), `components/event-data.ts`, `components/EventCard.tsx` and `sections/HomeEvents.tsx`. Every event in it is a placeholder, and the client should confirm it wants events back. What follows is the 16 September removal, kept for the record.
- **The events diary is gone from the whole site** (16 September 2026, client's request).
  `/events`, `/events/:slug`, `pages/Events.tsx`, `pages/Event.tsx`, `components/event-data.ts`,
  `sections/HomeEvent.tsx` and the event pinned into the header's Get involved panel were all
  removed. The four licensed stock event photographs are still in `public/assets/images`
  (`event-dinner`, `event-packing`, `event-iftar`, `event-eid`) — unused, kept deliberately,
  since they were bought and cost nothing to hold.
- **`components/social-data.ts` is the only place the social URLs are written down.**
  Facebook is `facebook.com/alanwaarorgau` and Instagram is `instagram.com/alanwaarcharity` —
  **both real**, given by the client and checked. Note the two handles do not match each other
  or the domain, so nothing derives one from the other. `Footer.tsx` and `org-data.ts` both
  read this file; they used to carry their own placeholder copies.
  WhatsApp and YouTube in `org-data.ts` are **still placeholders** and still go nowhere.
- **Two sections replaced the events bands**, keeping the slot and its job — asking for
  attention rather than money, so neither carries gold.
  `sections/HomeSocial.tsx` closes the home page with type and two links and **no iframe**:
  this is the page everybody lands on, and nobody should be handed to Meta for opening it.
  `sections/InvolvedSocial.tsx` used to carry the actual posts (the Facebook page-plugin
  timeline and a grid of Instagram posts) on `/get-involved#social`; it was cut on
  17 September 2026 at the user's request, and the menu's "Latest posts" now goes to
  `/contact#social` (and from 17 September 2026 to the home page's `/#social`). `facebookTimeline` and `EMBEDDABLE` in `social-data.ts` are unused since.
  **Nothing from Meta loads until a button is pressed.** Both embeds are Meta-served iframes
  that set cookies on every visitor the moment they mount, so they sit behind one consent
  click that says what pressing it does. The precedent is the OpenStreetMap preview in
  `Footer.tsx`, which loads only on hover for the same reason.
  **Instagram post links have to be typed by hand** into `POSTS` in `social-data.ts`, and that
  array is empty. There is no public profile-feed embed — oEmbed has needed an app token since
  2020 and the profile page serves no permalinks to a logged-out reader (checked). Paste four
  or six post URLs in and the grid fills itself; until then that half of the section says so.
- **`nav-data.ts` links can now be `external: true`**, rendered as a plain `<a>` by both
  `Header` and `MobileDrawer` — react-router's `<Link>` reads an absolute URL as a path.
  Added for the two accounts in the Get involved panel, whose Events column became "Follow along".

Still to port on the home page: what's urgent, the delivery ticker, the zakat entry, the
88/7/5 split, the field report, and the next event. The sticky mobile "Give $50" bar is
also still to come — in the prototype it appears once the hero's give module scrolls out
of view, so it needs `HomeHero` and the header to share that one piece of state.

One open item from `DESIGN-NOTES.md`: check every photo caption against the field team's
log before launch.
