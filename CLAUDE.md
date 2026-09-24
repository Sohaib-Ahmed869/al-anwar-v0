# CLAUDE.md

Working notes for Claude on the Al-Anwaar website and donation platform. `README.md` is
the long-form design log (why each page looks the way it does); this file covers what you
need to work in the repo safely. Keep both up to date when something they say changes.

## What this is

A charity site plus three portals, in one Vite app, backed by one Express API:

- **Public site** (`src/pages`, `src/sections`, `src/components`): appeals, give,
  zakat, fundraisers, volunteer and partner forms, legal pages.
- **Donor portal** `/account` (`src/account`): giving history, regular gifts, receipts,
  tax statements, own fundraisers, profile. Sign-in is an emailed six-digit code.
- **Admin portal** `/admin` (`src/admin`): donors, gifts, plans, enquiries, appeals,
  fundraiser approvals, campaigns, bank-statement matching, reports and Xero export, staff,
  activity, email log, settings.
- **Compliance portal** `/compliance` (`src/compliance`): ACNC registers, statutory
  calendar, document library, audit trail, reports pack.
- **API** (`server/`): Express 5, Mongoose 9, zod, all under `/api`.
- **Shared** (`shared/`): domain vocabulary, permissions table, types and money helpers.
  Both client and server compile it.

## Commands

```
npm run dev        # site on :5190 and API on :4600 together (vite proxies /api)
npm run typecheck  # client (tsconfig.json) and server (server/tsconfig.json)
npm run build      # typecheck both, then vite build to dist/
npm start          # the API; with NODE_ENV=production it also serves dist/
node scripts/sweep.mjs [filter]      # screenshot every portal page, desktop and phone,
                                     # report console errors and sideways scroll
node scripts/shot.mjs admin/donors --mobile [--as email | --donor email]
```

There's no test suite. To verify a change, run `npm run typecheck`, then
`node scripts/sweep.mjs` while `npm run dev` is running. It should report
"74/74 clean". For flows, drive the page with Playwright.

## Machine-specific gotchas

- **Port 4000 and 5173 belong to other apps** on this machine. The API is on 4600
  and Vite is on 5190 with `strictPort`.
- **The connected Chrome can't reach localhost.** Use `scripts/shot.mjs` or
  Playwright for screenshots, not the browser extension.
- **No local Mongo or Docker.** Development uses mongodb-memory-server, with files
  in `.data/mongo`. It seeds invented data the first time; `SEED_RESET=1` wipes and
  re-seeds.
- With no `.env`, email goes to Admin → Email log (the outbox) and payments are
  simulated. A regular gift on a card ending 0002 is declined.

Dev logins (password `alanwaar-demo`): `yusuf@alanwaar.group` (owner), `maryam@` (admin),
`omar@` (finance), `fatima@` (fundraising), `bilal@` (volunteer), `khalid@` (compliance).
Donor: `amina.rahman@example.com`; in development the code is shown on screen.

## Rules the code relies on

- **Money is integer cents** everywhere on the server and in `shared/`. The public
  site's give form and fundraiser pages work in dollars, and they convert at the API
  boundary.
- **One road for a gift.** Every gift goes through `recordGift()` in
  `server/lib/giving.ts`: checkout, the recurring scheduler, bank matching and admin
  entry alike. Don't write `Gift.create` anywhere else.
- **Permissions live in one table**, `shared/access.ts`. The server checks it on each
  route, and the portals read it to decide what to draw. When you add a route, add a
  permission check there and gate the UI the same way.
- **Audit every change.** Mutations call `audit(req, action, sentence, target)` from
  `server/lib/audit.ts`. The sentence is plain English for the compliance portal.
- **CSRF:** every `/api` write needs the `X-Requested-With` header. `src/portal/api.ts`
  sends it, and public-site fetches must add `'X-Requested-With': 'aa'`.
- **Two sessions:** `aa_donor` (donor) and `aa_staff` (staff). No route accepts
  both. `/api/me/*` routes never take a donor id from the request.
- **Validation:** parse bodies with `parse(zodSchema, req.body)` from `server/lib/http.ts`.
  A failure returns `{ error: { message, fields } }`, and forms show `fields` inline.
- **Public-site validation is shared.** `validateGift()` in `src/services/give.ts`
  runs in the browser and, loaded by path, on the server.
- **Fundraisers** are read from `/api/public/fundraisers` through `useFundraisers()` /
  `useFundraiser()` (`src/services/fundraisers.ts`). New ones, from the site or the
  donor portal, start as `pending` and go public only after admin approval.
- **The portals are lazy chunks** outside the public `Layout` (`src/App.tsx`).
- **Background jobs** (`server/jobs/scheduler.ts`) run on `setInterval` inside the API
  process. Only one process may run them.

## Design conventions

- Tokens live only in `src/index.css` (Tailwind v4 `@theme`, with no tailwind config file).
- **Gold (`bg-gold`) is only for the give action** (and the focus ring). Everything
  else interactive is green or teal.
- Every amount takes `.nums` (tabular numerals).
- Portal UI kit: `src/portal/ui` (radix-ui, vaul, cmdk, sonner, lucide). Charts are
  in `src/portal/charts` (recharts). Data fetching uses @tanstack/react-query through
  `src/portal/api.ts`.
- Public page files only compose sections. Each section is one file named
  `src/sections/<Page><Section>.tsx`, and page words live in `*-data.ts` files.
- Media lives only in `public/assets/`.
- Code comments explain *why*, in full sentences, in a block header at the top of
  each file. Match that density when editing.

## Configuration and deploying

`.env.example` lists every variable. In production (`NODE_ENV=production`),
`JWT_SECRET` and `MONGODB_URI` are required and the server refuses to start without
them. `APP_URL` is used in emailed links.

Optional variables: SMTP (Amazon SES), `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
(the webhook is `POST /api/webhooks/stripe`), the PayPal keys, and `S3_BUCKET` (without
it, uploads go to `.data/uploads`, which is not durable on most hosts). Google and
Facebook donor sign-in are also optional.

**Current status (25 September 2026):** runs locally only, on the embedded database.
The plan is the frontend on Vercel and the API on Render, with MongoDB Atlas. The
Vercel build then needs the API origin for `/api`, either through a rewrite or a base
URL, plus cross-site cookie settings. Don't deploy until the user asks.

The production shape is **one Node process** that serves `/api` and the built `dist/`.
It needs a persistent process because of the timers, and a real MongoDB (Atlas).
`vercel.json` and the handlers in `api/` predate the server and are superseded by it.
