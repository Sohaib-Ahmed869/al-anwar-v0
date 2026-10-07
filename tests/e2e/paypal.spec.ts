import { expect, test, type Page } from '@playwright/test'
import { freshEmail, watchErrors } from './helpers'

/* ---------------------------------------------------------------------------
   Giving with PayPal in a real browser, against the pretend PayPal the e2e
   server runs (scripts/e2e-server.ts): the give form → PayPal's approval page
   → back to us, where the order is captured → the thank-you page.

     PayPal takes the money     a real receipt (not a SIM- test one)
     PayPal holds it (PENDING)  "PayPal is processing your payment", no receipt
     PayPal declines it         our own words, nothing charged, a way back
     the donor cancels          back on /give; the gift was never paid

   POST /__e2e/paypal/next decides what the next order's capture does.
--------------------------------------------------------------------------- */

const giveForm = (page: Page) => page.locator('[aria-labelledby="give-form-head"]')

async function nextCapture(page: Page, capture: 'complete' | 'pending' | 'declined') {
  const res = await page.request.post('/__e2e/paypal/next', { data: { capture } })
  expect(res.status()).toBe(200)
}

/** /give → details → PayPal → the pretend approval page */
async function toPaypal(page: Page, email: string, amount = 40) {
  await page.goto(`/give?appeal=gaza-emergency&amount=${amount}&frequency=once`)
  const form = giveForm(page)
  await form.getByRole('button', { name: 'Continue' }).click()
  await form.getByLabel('First name').fill('Paypal')
  await form.getByLabel('Last name').fill('Giver')
  await form.getByLabel('Email', { exact: true }).fill(email)
  await form.getByRole('button', { name: 'Continue' }).click()
  await form.getByRole('radio', { name: /PayPal/ }).click()
  await form.getByRole('button', { name: /^Give \$/ }).click()
  await page.waitForURL(/\/__fakepaypal\/approve\?token=/)
  await expect(page.getByRole('heading', { name: 'Pretend PayPal' })).toBeVisible()
  await expect(page.getByText(`Pay $${amount.toFixed(2)} AUD to Al-Anwaar?`)).toBeVisible()
}

test('PayPal takes the money: back on the thank-you page with a real receipt', async ({ page }) => {
  const errors = watchErrors(page)
  await nextCapture(page, 'complete')
  await toPaypal(page, freshEmail('pp-paid'))
  await page.getByRole('link', { name: 'Approve' }).click()

  await page.waitForURL(/\/thank-you\?gift=.*&t=/)
  await expect(page.getByRole('heading', { name: 'Thank you, Paypal' })).toBeVisible()
  await expect(page.getByText('Receipt number')).toBeVisible()
  /* a live provider took it: no test receipt, no simulated notice */
  await expect(page.getByText(/AA-\d{4}-\d{6}/)).toBeVisible()
  await expect(page.getByText(/SIM-\d{4}/)).toHaveCount(0)
  await expect(page.getByText('This was a simulated payment')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('PayPal holds the payment for review: the page says so and waits', async ({ page }) => {
  await nextCapture(page, 'pending')
  await toPaypal(page, freshEmail('pp-held'))
  await page.getByRole('link', { name: 'Approve' }).click()

  await page.waitForURL(/\/thank-you\?gift=.*&t=/)
  await expect(page.getByRole('heading', { name: 'PayPal is processing your payment' })).toBeVisible()
  await expect(page.getByText('Receipt number')).toHaveCount(0)
})

test('PayPal declines: our own words, nothing charged, and a way to try again', async ({ page }) => {
  await nextCapture(page, 'declined')
  await toPaypal(page, freshEmail('pp-declined'))
  await page.getByRole('link', { name: 'Approve' }).click()

  await page.waitForURL(/\/thank-you\?gift=.*&t=/)
  await expect(page.getByRole('heading', { name: 'The payment did not go through' })).toBeVisible()
  await expect(page.getByText(/nothing was charged/i)).toBeVisible()
  /* PayPal's own message never reaches the donor */
  await expect(page.getByText(/instrument presented was declined/i)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible()
})

test('the donor cancels on PayPal: back on the give page, and nothing was paid', async ({ page }) => {
  const email = freshEmail('pp-cancel')
  await nextCapture(page, 'complete')
  await toPaypal(page, email)
  await page.getByRole('link', { name: 'Cancel and return' }).click()

  await page.waitForURL(/\/give\?cancelled=1/)
  await expect(giveForm(page)).toBeVisible()
})
