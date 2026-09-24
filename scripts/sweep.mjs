/* ---------------------------------------------------------------------------
   Development tool: screenshot every portal page at desktop and phone width,
   signed in once per role, and report console errors and any page that
   scrolls sideways on a phone.

     node scripts/sweep.mjs                 all pages
     node scripts/sweep.mjs admin           only paths containing "admin"

   Shots land in .data/sweep/. Needs `npm run dev` running.
--------------------------------------------------------------------------- */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:5190'
const only = process.argv[2]
const OUT = '.data/sweep'
mkdirSync(OUT, { recursive: true })

const STAFF = 'yusuf@alanwaar.group'
const PAGES = [
  ['anon', '/admin/login'], ['anon', '/account/login'],
  ['staff', '/admin'], ['staff', '/admin/donors'], ['staff', '/admin/donors/duplicates'],
  ['staff', '/admin/gifts'], ['staff', '/admin/plans'], ['staff', '/admin/plans?status=past_due'],
  ['staff', '/admin/enquiries'], ['staff', '/admin/appeals'], ['staff', '/admin/fundraisers'],
  ['staff', '/admin/campaigns'], ['staff', '/admin/bank'], ['staff', '/admin/reports'],
  ['staff', '/admin/reports?tab=xero'], ['staff', '/admin/staff'], ['staff', '/admin/activity'],
  ['staff', '/admin/emails'], ['staff', '/admin/settings'],
  ['staff', '/compliance'], ['staff', '/compliance/registers/risks'], ['staff', '/compliance/registers/overseas-partners'],
  ['staff', '/compliance/calendar'], ['staff', '/compliance/documents'], ['staff', '/compliance/audit'],
  ['staff', '/compliance/reports'], ['staff', '/compliance/reports?tab=pack'],
  ['volunteer', '/admin/gifts'],
  ['donor', '/account'], ['donor', '/account/giving'], ['donor', '/account/plans'], ['donor', '/account/receipts'],
  ['donor', '/account/fundraisers'], ['donor', '/account/fundraisers/new'], ['donor', '/account/profile'],
  ['donor', '/account/statement/2026'],
  ['anon', '/give?appeal=gaza-emergency&amount=50&frequency=monthly'],
].filter(([, p]) => !only || p.includes(only))

const headers = { 'X-Requested-With': 'aa', 'Content-Type': 'application/json' }
const browser = await chromium.launch()
const contexts = {}

async function ctxFor(who, mobile) {
  const key = `${who}-${mobile}`
  if (contexts[key]) return contexts[key]
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  })
  if (who === 'staff' || who === 'volunteer') {
    const email = who === 'staff' ? STAFF : 'bilal@alanwaar.group'
    const r = await ctx.request.post(`${BASE}/api/auth/staff/login`, { headers, data: { email, password: 'alanwaar-demo', remember: true } })
    if (!r.ok()) throw new Error(`${who} login failed ${r.status()}`)
  } else if (who === 'donor') {
    const email = 'amina.rahman@example.com'
    const { devCode } = await (await ctx.request.post(`${BASE}/api/auth/donor/code`, { headers, data: { email } })).json()
    const v = await ctx.request.post(`${BASE}/api/auth/donor/verify`, { headers, data: { email, code: devCode } })
    if (!v.ok()) throw new Error('donor login failed')
  }
  contexts[key] = ctx
  return ctx
}

const report = []
for (const mobile of [false, true]) {
  for (const [who, path] of PAGES) {
    const ctx = await ctxFor(who, mobile)
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource.*404/.test(m.text()) && errors.push(m.text().slice(0, 200)))
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
    page.on('response', (r) => r.url().includes('/api/') && r.status() >= 400 && errors.push(`${r.status()} ${r.url().replace(BASE, '')}`))
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(600)
    } catch (e) {
      errors.push(`nav: ${String(e).slice(0, 120)}`)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0)
    const file = `${OUT}/${who}${path.replace(/[^a-z0-9]+/gi, '_')}${mobile ? '-m' : ''}.png`
    await page.screenshot({ path: file, fullPage: true }).catch(() => {})
    report.push({ path, who, mobile, overflow, errors, file })
    await page.close()
  }
}
await browser.close()

let bad = 0
for (const r of report) {
  const issues = [...(r.overflow > 1 ? [`scrolls sideways by ${r.overflow}px`] : []), ...r.errors]
  if (issues.length) bad++
  console.log(`${issues.length ? '✗' : '✓'} ${r.mobile ? 'phone  ' : 'desktop'} ${r.who.padEnd(9)} ${r.path}${issues.length ? '\n     ' + issues.join('\n     ') : ''}`)
}
console.log(`\n${report.length - bad}/${report.length} clean · shots in ${OUT}/`)
