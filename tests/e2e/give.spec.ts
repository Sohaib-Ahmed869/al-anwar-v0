import { expect, test, type Page } from '@playwright/test'
import { freshEmail } from './helpers'

/* ---------------------------------------------------------------------------
   Giving on the public site, in a real browser: the three-step form on /give
   (Gift, Details, Pay) through to the thank-you page. Payments are simulated
   (no Stripe key), so "Give" records the gift as paid and the thank-you page
   shows the receipt.

   The bank-transfer pledge isn't offered on the form, so its thank-you page is
   reached the way the API hands it back, and checked there.
--------------------------------------------------------------------------- */

/** the give form's own section (the footer's sign-up has an Email field too) */
const giveForm = (page: Page) => page.locator('[aria-labelledby="give-form-head"]')

async function giveThroughForm(page: Page, query: string, email: string) {
  await page.goto(`/give?${query}`)
  const form = giveForm(page)
  await form.getByRole('button', { name: 'Continue' }).click()

  await form.getByLabel('First name').fill('Playwright')
  await form.getByLabel('Last name').fill('Tester')
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByRole('button', { name: 'Continue' }).click()

  await form.getByRole('radio', { name: /Credit or debit card/ }).click()
  await form.getByRole('button', { name: /^Give \$/ }).click()
  await page.waitForURL(/\/thank-you\?/)
}

test('a one-off card gift reaches the thank-you page with a receipt', async ({ page }) => {
  await giveThroughForm(page, 'appeal=gaza-emergency&amount=50&frequency=once', freshEmail('once'))
  await expect(page.getByRole('heading', { name: 'Thank you, Playwright' })).toBeVisible()
  await expect(page.getByText('This was a simulated payment')).toBeVisible()
  await expect(page.getByText('Receipt number')).toBeVisible()
  await expect(page.getByText('$50.00').first()).toBeVisible()
})

test('a monthly gift says when the next payment is', async ({ page }) => {
  await giveThroughForm(page, 'appeal=gaza-emergency&amount=50&frequency=monthly', freshEmail('monthly'))
  await expect(page.getByRole('heading', { name: 'Thank you, Playwright' })).toBeVisible()
  await expect(page.getByText(/The next payment is on/)).toBeVisible()
})

test('the form will not go on without the donor’s details', async ({ page }) => {
  await page.goto('/give?appeal=gaza-emergency&amount=50&frequency=once')
  const form = giveForm(page)
  await form.getByRole('button', { name: 'Continue' }).click()
  await form.getByRole('button', { name: 'Continue' }).click()
  /* still on Details, and the fields say what is wrong */
  await expect(form.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(form.getByRole('button', { name: /^Give \$/ })).toHaveCount(0)
})

test('a bank transfer pledge shows the reference and the account', async ({ page }) => {
  const res = await page.request.post('/api/public/checkout', {
    headers: { 'X-Requested-With': 'aa' },
    data: {
      fund: 'sadaqah', frequency: 'once', amount: 150, operatingCosts: 0, provider: 'bank',
      first: 'Bank', last: 'Giver', email: freshEmail('bank'), behalfName: '', updates: false, appealSlug: 'gaza-emergency',
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.kind).toBe('bank')
  await page.goto(body.url)
  await expect(page.getByRole('heading', { name: 'Nearly there, Bank' })).toBeVisible()
  await expect(page.getByText(body.reference).first()).toBeVisible()
  await expect(page.getByText(body.bank.bsb).first()).toBeVisible()
})
