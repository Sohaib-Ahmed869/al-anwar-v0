/* ---------------------------------------------------------------------------
   Development tool: screenshot a page of the running app, signed in as anyone.

     node scripts/shot.mjs /admin                       (as the owner)
     node scripts/shot.mjs /admin/donors --as omar@alanwaar.group --mobile
     node scripts/shot.mjs /account --donor amina.rahman@example.com
     node scripts/shot.mjs /admin/login --anon --full

   Flags: --mobile (390x844), --full (whole page), --out <file.png>,
          --wait <ms> extra settle time, --click "<text>" click a button/link
          by its visible text before shooting (repeatable).
   Needs `npm run dev` running. Staff passwords are the seed's demo password.
   Prints the file path, and any console errors from the page.
--------------------------------------------------------------------------- */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const val = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : undefined
}
const VALUED = ['as', 'donor', 'out', 'wait', 'click']
const positional = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]?.slice(2)))
/* Git Bash rewrites "/admin" to "C:/Program Files/Git/admin"; undo that, and
   accept "admin/donors" without the slash too */
const path = positional ? '/' + positional.replace(/^.*\/Git\//, '').replace(/^\/+/, '') : '/'
const clicks = args.flatMap((a, i) => (a === '--click' ? [args[i + 1]] : []))
const BASE = process.env.SHOT_BASE ?? 'http://localhost:5190'
const mobile = flag('mobile')
const outDir = process.env.SHOT_DIR ?? '.data/shots'
mkdirSync(outDir, { recursive: true })
const out = val('out') ?? join(outDir, `${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}${mobile ? '-m' : ''}.png`)

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
})
const headers = { 'X-Requested-With': 'aa', 'Content-Type': 'application/json' }

if (!flag('anon')) {
  const donor = val('donor')
  if (donor) {
    const r = await ctx.request.post(`${BASE}/api/auth/donor/code`, { headers, data: { email: donor } })
    const { devCode } = await r.json()
    const v = await ctx.request.post(`${BASE}/api/auth/donor/verify`, { headers, data: { email: donor, code: devCode } })
    if (!v.ok()) throw new Error(`donor sign-in failed: ${await v.text()}`)
  } else {
    const email = val('as') ?? 'yusuf@alanwaar.group'
    const r = await ctx.request.post(`${BASE}/api/auth/staff/login`, { headers, data: { email, password: 'alanwaar-demo', remember: true } })
    if (!r.ok()) throw new Error(`staff sign-in failed: ${await r.text()}`)
  }
}

const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
for (const text of clicks) {
  await page.getByText(text, { exact: false }).first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}
await page.waitForTimeout(Number(val('wait') ?? 700))
await page.screenshot({ path: out, fullPage: flag('full') })
console.log(out)
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'))
await browser.close()
