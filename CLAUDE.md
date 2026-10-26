# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run dev:web    # or either half alone (dev:api)
npm run typecheck  # client, server and tests (tsconfig.json, server/, tests/)
npm run build      # typecheck both, then vite build to dist/
npm start          # the API; with NODE_ENV=production it also serves dist/
node scripts/sweep.mjs [filter]      # screenshot every portal page, desktop and phone,
                                     # report console errors and sideways scroll
node scripts/shot.mjs admin/donors --mobile [--as email | --donor email]
npm test                             # unit + API tests (vitest; in-memory Mongo per file)
npx vitest run tests/api/<file>      # one file
npm run test:e2e                     # Playwright browser tests
npx tsx server/jobs/run-once.ts [--force]            # run every background job once, now
npx tsx server/scripts/migrate.ts [--again <name>]   # one-off data migrations
```

Shots land in `.data/shots` and `.data/sweep`. Write page paths without the leading
slash (`admin/donors`), because Git Bash rewrites `/admin` into a Windows path.
`shot.mjs` undoes that, but other scripts may not.

To verify a change: `npm run typecheck`, `npm test`, then `node scripts/sweep.mjs`
while `npm run dev` is running (it should report "74/74 clean"). API tests use
`tests/helpers/server.ts` (`startApi()`, signed-in `Client`s). Tests run with the
process in UTC, as in the production container, so date code that leans on the machine's zone fails there.
Set `STRICT_LIMITS=1` in a test that checks rate limits (otherwise they are 20× looser
outside production).

## Machine-specific gotchas

- **Port 4000 and 5173 belong to other apps** on this machine. The API is on 4600
  and Vite is on 5190 with `strictPort`.
- **The connected Chrome can't reach localhost.** Use `scripts/shot.mjs` or
  Playwright for screenshots, not the browser extension.
- **No local Mongo or Docker.** Development uses mongodb-memory-server, with files
  in `.data/mongo`, on port 27031. It seeds invented data the first time; `SEED_RESET=1`
  wipes and re-seeds. Only one process can open the embedded database, so
  `run-once.ts` connects to the dev server's instance if it's already running (and then
  needs `--force`, because the dev server holds the jobs lease).
- **A `.env` may exist** with real keys. Don't read it or print it. Tests and child
  processes must set every variable they care about explicitly (even to `''`), because
  `server/env.ts` loads `.env` and fills in anything left unset.
- **Bash heredocs lose backslashes here** (`\/` came out as `/`, `\u0000` as a NUL
  byte). Use the Edit tool for anything with a regex or an escape in it.
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
  entry alike. Don't write `Gift.create` anywhere else. The one exception is the seed's
  bulk `insertMany`.
- **Permissions live in one table**, `shared/access.ts`. The server checks it on each
  route (`requireStaff(...perms)` / `requireStaffAny` in `server/lib/auth.ts`), and the
  portals read it to decide what to draw. When you add a route, add a permission check
  there and gate the UI the same way.
- **Audit every change.** Mutations call `audit(req, action, sentence, target)` from
  `server/lib/audit.ts`. The sentence is plain English for the compliance portal.
- **CSRF:** every `/api` write needs the `X-Requested-With` header. `src/portal/api.ts`
  sends it, and public-site fetches must add `'X-Requested-With': 'aa'`.
- **Two sessions:** `aa_donor` (donor) and `aa_staff` (staff). No route accepts
  both. `/api/me/*` routes never take a donor id from the request.
- **Validation:** parse bodies with `parse(zodSchema, req.body)` from `server/lib/http.ts`.
  A failure returns `{ error: { message, fields } }`, and forms show `fields` inline.
- **Public-site validation is shared.** `validateGift()` lives in `shared/giving.ts`,
  which the server and the site both import. The server never imports from `src/`.
- **Fundraisers** are read from `/api/public/fundraisers` through `useFundraisers()` /
  `useFundraiser()` (`src/services/fundraisers.ts`). New ones, from the site or the
  donor portal, start as `pending` and go public only after admin approval.
- **The portals are lazy chunks** outside the public `Layout` (`src/App.tsx`).
- **Background jobs** (`server/jobs/scheduler.ts`) run on timers inside the API process,
  but only in the process holding the **jobs lease** (`server/models/JobLease.ts`), so a
  deploy overlap or a second instance never charges or emails twice. Every job also
  **claims each item** with a conditional update before acting on it (a plan, a notice,
  a campaign batch, a reminder); keep that pattern in anything new. Loops check
  `isStopping()` (`jobs/lifecycle.ts`) between items, so SIGTERM never lands mid-charge.
  `RUN_JOBS=0` turns the timers off.
- **Mongoose 9 rejects update pipelines** (`[{ $set: … }]`) unless you pass
  `updatePipeline: true`.
- **The server's clock is Sydney.** `server/env.ts` sets `process.env.TZ =
  'Australia/Sydney'` before anything else, so local-time Date maths and date-fns on the
  server follow the charity's calendar. Code in `shared/` also runs in browsers anywhere,
  so it must not use local time: use `fyOf`, `fyRange`, `sydneyDay` and `sydneyMidnight`
  from `shared/domain.ts`, and send date filters as `yyyy-mm-dd` strings.
- **Secrets never reach the email log.** An email carrying a code or a token link sets
  `logged` (the redacted copy the log stores) in `server/emails/templates.ts`. Keep codes
  out of subjects. In development the unredacted message is printed to the API console
  instead (that's where to find an invite or reset link), and so is it on a staging deploy
  with no SMTP (`ALLOW_SIMULATED_PAYMENTS=1`). On those two, and never on a live deploy,
  the donor sign-in screens also show the code (`showsCodesOnScreen()` in
  `server/lib/email.ts`).
- **User text stays out of email subjects and markup.** Campaign merge fields go in
  after the markdown is rendered (`campaignEmail`). New templates must `esc()` names and
  never put a donor's or fundraiser's words in a subject.
- **Failures nobody is watching** (a job, a webhook 5xx, an email that couldn't go) go
  through `alert()` in `server/lib/alert.ts`: one `[alert] kind: …` log line.
- **One-off data changes** go in `server/migrations.ts` (each runs once, at start-up),
  and are never edited after they ship.

## Design conventions

- **The brand is the 2026 styleguide** (`Al-Anwaar-Styleguide-2026.pdf`). Colours were
  read off its vector fills (the printed hex codes are a typo): dark teal `#08262A`, teal
  `#006770`, medium teal `#2E8C88`, saffron `#F2C14A`, off-white `#FFF5E4`. The old token
  names (ink, green, gold, ground…) carry these values, so `--color-green` IS the teal.
- Brand assets are vectors extracted from the PDF, in `public/assets/brand/`, and wrapped
  in `src/components/Brand.tsx` (Logo, BrandMark, Tiles, OutlineMark, Sticker, Arch,
  DomePanel, GradientDomes, HeroBrand). Never use the old `Al-Anwaar-Logo-*.png` files.
- Fonts are self-hosted from `public/fonts` (Bricolage Grotesque for Snaga Uni Display,
  Outfit for Neulis Neue, Noto Kufi Arabic). When the licensed files arrive, add them
  there and name them first in the `--font-*` tokens.
- Keep the brand elements in their roles and SPARING: the tiles appear only in the footer,
  the portals' sidebar, the sign-in panel, the home zakat band, the lead place card on
  /where-it-goes and, faintly, at the foot of each photo hero (HeroBrand) — not behind pages, not in panels (the client found that too
  much); the outlined mark appears only in the home
  hero and the sign-in panel;
  gradients are `bg-grad-*` utilities (domes for moments, bands for panels).
- Tokens live only in `src/index.css` (Tailwind v4 `@theme`, with no tailwind config file).
- **Gold (saffron, `bg-gold`) is only for the give action** (and the focus ring, labels
  and key details as type). Type on saffron is always `text-ink`. Everything else
  interactive is teal.
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

`.env.example` lists every variable. **Production (`NODE_ENV=production`) refuses to
start** without `JWT_SECRET`, `APP_URL`, `MONGODB_URI`, `SMTP_HOST`, a live
`STRIPE_SECRET_KEY` (`sk_live_`) and `STRIPE_WEBHOOK_SECRET` (the webhook is
`POST /api/webhooks/stripe`). If PayPal keys are set, it also needs the live
`PAYPAL_API` and `PAYPAL_WEBHOOK_ID` (the webhook is `POST /api/webhooks/paypal`; each
event is verified with PayPal, then the order or capture is re-read from PayPal). A staging deploy sets `ALLOW_SIMULATED_PAYMENTS=1` to waive the payment
and email checks. Simulated gifts are then marked and never get a real receipt, and
with no SMTP an email is recorded as failed rather than "sent".

Other variables:
- `ORIGIN_SECRET`: when set (on the server and Vercel both), `/api` answers only requests
  carrying it in `X-Origin-Auth`, which `middleware.ts` (Vercel Routing Middleware)
  adds. The health checks and the Stripe webhook are exempt. `API_ORIGIN` on Vercel
  gives the middleware the API's address.
- `REQUIRE_STAFF_MFA`: `1` or `0`. Unset means on in production and off elsewhere.
  When it's on, owner, admin and finance staff must set up an authenticator app (TOTP).
- `MFA_KEY`: the key two-step sign-in secrets and recovery codes are sealed with. Without
  it they use `JWT_SECRET`, so rotating that would break every enrolment. **Set it before
  go-live.** Setting it later is safe: secrets sealed under `JWT_SECRET` still open.
- A sole owner locked out of two-step sign-in (no phone, no recovery codes):
  `npx tsx server/scripts/reset-staff-mfa.ts <email>` in the API's shell. Otherwise an owner
  resets a colleague's from Staff and access, which also clears their password and emails
  them a reset link.
- `RUN_JOBS=0`: no background jobs in this process.
- `S3_BUCKET`: without it, uploads go to `.data/uploads`, which is not durable on most
  hosts. Google and Facebook donor sign-in are optional.
- `TZ` is pinned to Australia/Sydney by the server itself (the container's clock is UTC).

Health: `/api/health` returns 503 when MongoDB doesn't answer a ping, and reports each job's last success. `/api/live` only says the
process is up. Retention (`server/jobs/retention.ts`, daily) strips email bodies after
90 days and deletes enquiries closed more than two years ago. The privacy page promises
exactly that, so change them together.

**Hosting (26 October 2026, staging):**
- **API on AWS EC2** in Sydney: one `t4g.medium` (Arm) running Ubuntu 26.04, behind the
  Elastic IP `3.106.148.40` at `https://api.alanwar.charities.ltd` (a test domain, to be
  replaced). `compose.yaml` runs the API (`Dockerfile`) and MongoDB as containers; Nginx
  and Certbot on the host terminate HTTPS and forward to `127.0.0.1:4600`. The server's
  `.env` sits next to `compose.yaml` in `~/al-anwaar`. Redeploy: `git pull`, then
  `docker compose up -d --build`. Backups are daily EBS snapshots (volumes tagged
  `Backup=daily`). The step-by-step guide is the "Al-Anwaar Backend on EC2" doc.
- **MongoDB is 7.0, not 8.x:** 8.x refuses to start on kernels 6.19 to 7.0.13
  (SERVER-121912), which Ubuntu 26.04 ships. Move to 8.x once `uname -r` on the server
  reports 7.0.14 or later.
- **Site on Vercel**, set up in `vercel.json` (security headers, SPA fallback) and
  `middleware.ts` (forwards `/api/*` with the origin secret). Both forward to
  `https://api.alanwar.charities.ltd`, and a unit test keeps the two in step;
  `vercel.json`'s rewrite is the fallback. Change both when the API's domain changes.
- `render.yaml` is from the earlier Render deploy and is no longer used.
- The server runs through `tsx`, which is a dev dependency, so the image installs dev
  dependencies (`npm ci --include=dev` in the `Dockerfile`).
- Security headers (CSP, frame denial, HSTS) are in `vercel.json` and
  `server/security-headers.ts`, and a test keeps them identical. A new third party (a
  script, a font, an embed) has to be added to both, and to the privacy page.

Because of the rewrite, the browser sees a single origin, so the `lax` session cookies
work without CORS. `TRUST_PROXY=2` accounts for both proxies (Vercel, then Nginx), and recorded IPs use
`req.ip`. `.vercelignore` keeps
`server/` out of the Vercel upload. Don't add a top-level `api/` folder: Vercel would
turn it into serverless functions that take over the `/api` paths from the rewrite. `SEED_DEMO=1` seeds the demo data into
an empty production database for staging. Production accepts it only alongside
`ALLOW_SIMULATED_PAYMENTS=1`, and with it off refuses to start while any staff login still
uses the demo password (`demoLoginsLeft()` in `server/seed/seed.ts`), so going live means a
fresh database. New staff passwords are checked against Have I Been Pwned in production
(`server/lib/breached.ts`, `PWNED_CHECK`); a failed lookup accepts the password.

The production shape is **one Node process** serving `/api` (it can also serve the built
`dist/`, but Vercel does that here). It needs a persistent process because of the timers,
and a real MongoDB (here a container beside it).