import { expect, test } from '@playwright/test'
import { DONOR, STAFF, freshEmail, signInDonor, signInStaff, watchErrors } from './helpers'

/* ---------------------------------------------------------------------------
   Three flows the findings report asked to see in a real browser:

     donor        a regular donation whose payment was declined: the donor
                  updates the card in the portal, the payment is taken there
                  and then, and the plan is active again
     bank import  finance uploads a statement whose line carries a website
                  pledge's reference, reviews it, saves it — the pledge is paid
                  and receipted
     campaign     fundraising writes a campaign to a small audience and sends
                  it; the queue (a background job, off in the e2e server) is
                  run through /__e2e/run/campaigns, and the page then shows it
                  delivered to everyone it counted

   Simulated payments throughout (no Stripe key): any valid card number goes
   through except one ending 0002.
--------------------------------------------------------------------------- */

const headers = { 'X-Requested-With': 'aa' }

test('a donor fixes a declined regular donation with a new card', async ({ page }) => {
  const errors = watchErrors(page)
  await signInDonor(page, DONOR)
  const made = await page.request.post('/__e2e/plan/failing', { data: { email: DONOR } })
  expect(made.status(), await made.text()).toBe(200)
  const { id, number } = await made.json()

  await page.goto('/account/plans')
  const card = page.getByText(number, { exact: false }).locator('xpath=ancestor::*[.//button][1]')
  await expect(card.getByText('The last payment did not go through')).toBeVisible()
  await card.getByRole('button', { name: 'Update card' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Update your card' })).toBeVisible()
  await dialog.getByLabel('Name on card').fill('Amina Rahman')
  await dialog.getByLabel('Card number').fill('4242 4242 4242 4242')
  await dialog.getByLabel('Expiry').fill(`12 / ${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`)
  await dialog.getByRole('button', { name: /^Save and give \$/ }).click()

  await expect(page.getByText(/Card updated, and your \$[\d,.]+ donation went through/)).toBeVisible()
  await expect(card.getByText('The last payment did not go through')).toHaveCount(0)

  const plans = await (await page.request.get('/api/me/plans')).json()
  const plan = (plans.items as { id: string; status: string; payment?: { last4?: string }; failure?: { count?: number } }[]).find((p) => p.id === id)!
  expect(plan.status).toBe('active')
  expect(plan.payment?.last4).toBe('4242')
  expect(plan.failure?.count ?? 0).toBe(0)
  expect(errors).toEqual([])
})

test('finance imports a bank statement and the matched pledge becomes a receipted gift', async ({ page }) => {
  const errors = watchErrors(page)
  /* a website pledge to pay by bank transfer, with its reference */
  const res = await page.request.post('/api/public/checkout', {
    headers,
    data: {
      fund: 'sadaqah', frequency: 'once', amount: 180, operatingCosts: 0, provider: 'bank',
      first: 'Statement', last: 'Payer', email: freshEmail('bankimport'), behalfName: '', updates: false, appealSlug: 'gaza-emergency',
    },
  })
  expect(res.status()).toBe(200)
  const pledge = await res.json()
  const thanks = new URL(pledge.url, 'http://x')

  await signInStaff(page, STAFF.finance)
  await page.goto('/admin/bank')
  const day = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Sydney' })
  const csv = ['Date,Amount,Description', `${day},180.00,TRANSFER FROM S PAYER ${pledge.reference}`].join('\n')
  await page.locator('input[type="file"]').setInputFiles({ name: `statement-${Date.now()}.csv`, mimeType: 'text/csv', buffer: Buffer.from(csv) })

  await page.waitForURL(/\/admin\/bank\/[a-f0-9]{24}/)
  await page.getByRole('button', { name: 'Save 1 donation' }).first().click()
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Save 1 donation' }).click()
  await expect(page.getByRole('heading', { name: /Saved 1 donation totalling \$180/ })).toBeVisible()

  const status = await (await page.request.get(`/api/public/gifts/${thanks.searchParams.get('gift')}/status?t=${thanks.searchParams.get('t')}`)).json()
  expect(status.status).toBe('succeeded')
  expect(status.receiptNumber).toMatch(/\d/)
  expect(errors).toEqual([])
})

test('fundraising sends a campaign to a small audience and sees it delivered', async ({ page }) => {
  const errors = watchErrors(page)
  await signInStaff(page, STAFF.fundraising)
  await page.goto('/admin/campaigns/new')

  const name = `E2E regular givers ${Date.now().toString(36)}`
  await page.getByLabel('Campaign name').fill(name)
  await page.getByLabel('Subject').fill('Thank you for giving every month, {{firstName}}')
  await page.getByLabel('Message').fill('Your regular donation kept the water stations running all winter. Thank you for standing with families who need it.')
  await page.getByRole('switch', { name: /Regular givers only/ }).click()

  const send = page.getByRole('button', { name: /^Send now to \d/ })
  await expect(send).toBeEnabled()
  await send.click()
  const confirm = page.getByRole('button', { name: /^Send to [\d,]+ donors$/ })
  const n = Number(((await confirm.textContent()) ?? '').replace(/[^\d]/g, ''))
  expect(n).toBeGreaterThan(0)
  await confirm.click()
  /* the page moves to the saved draft's address before the send is answered;
     wait for the send itself, which shows the progress */
  await page.waitForURL(/\/admin\/campaigns\/[a-f0-9]{24}/)
  await expect(page.getByText(/of [\d,]+ sent/)).toBeVisible()

  /* the batches go out (the scheduler's job, run on request here) */
  const ran = await page.request.post('/__e2e/run/campaigns')
  expect((await ran.json()).ok, 'the queue emptied').toBe(true)
  await page.reload()
  await expect(page.getByText('Delivered')).toBeVisible()
  await expect(page.getByText(`of ${n.toLocaleString('en-AU')} sent`)).toBeVisible()
  /* The preview is a sandboxed srcdoc iframe with no scripts in it (checked:
     the HTML has no <script>, handler or javascript: link). Chrome still logs
     "Blocked script execution in 'about:srcdoc'" at line 0 when the test
     browser's own instrumentation reaches into that frame — the sandbox doing
     its job, not something on the page. Anything else is still an error. */
  expect(errors.filter((e) => !e.includes("Blocked script execution in 'about:srcdoc'"))).toEqual([])
})
