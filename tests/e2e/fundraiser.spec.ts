import { expect, test } from '@playwright/test'
import { STAFF, freshEmail, signInStaff, watchErrors } from './helpers'

/* ---------------------------------------------------------------------------
   A fundraiser started on the public site, signed out, in a real browser
   (finding M10): the four-step form, the "check your email" screen, the link
   from the email opening /fundraisers/confirm, the button there, and the page
   arriving in the staff approval queue — and not before.

   The link's token only ever leaves the server inside the email (the email
   log keeps a redacted copy), so the test reads the real message from the
   e2e server's outbox tap (scripts/e2e-server.ts, GET /__e2e/mail).
--------------------------------------------------------------------------- */

test('a signed-out organiser confirms by email before staff see the page', async ({ page, browser }) => {
  const errors = watchErrors(page)
  const email = freshEmail('fundraiser')
  const title = `Walking for water ${Date.now().toString(36)}`

  await page.goto('/fundraisers/start')
  await expect(page.getByRole('heading', { name: 'Set up your fundraiser' })).toBeVisible()

  /* 1. occasion, 2. appeal: the first of each */
  await page.locator('label:has(input[type=radio])').first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Which appeal should it go to?')).toBeVisible()
  await page.locator('label:has(input[type=radio])').first().click()
  await page.getByRole('button', { name: 'Continue' }).click()

  /* 3. the page */
  await page.getByLabel('Fundraiser title').fill(title)
  await page.getByLabel('Your reason, in your own words').fill(
    'I am walking every morning this month so that a village can have clean water. Please give what you can.',
  )
  await page.getByLabel('Or your own goal').fill('500')
  const ends = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('End date').fill(ends)
  await page.getByRole('button', { name: 'Continue' }).click()

  /* 4. about you */
  await page.getByLabel('First name').fill('Hana')
  await page.getByLabel('Last name').fill('Ibrahim')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel(/I will only share this page/).check()
  await page.getByRole('button', { name: 'Create my fundraiser' }).click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  /* not in the approval queue yet */
  const staff = await browser.newPage()
  await signInStaff(staff, STAFF.fundraising)
  const before = await staff.request.get('/api/admin/fundraisers?pageSize=200')
  expect(JSON.stringify(await before.json())).not.toContain(title)

  /* the link from the email: it opens a page with a button, and does nothing by itself */
  const mail = await (await page.request.get(`/__e2e/mail?to=${encodeURIComponent(email)}`)).json()
  expect(mail.subject).toBe('Please confirm your fundraiser')
  const link = /href="([^"]*\/fundraisers\/confirm\?t=[^"]+)"/.exec(mail.html)?.[1]
  expect(link, 'the confirmation link is in the real email').toBeTruthy()
  /* the email's link carries the configured site address; open its path here */
  const url = new URL(link!.replace(/&amp;/g, '&'))
  await page.goto(url.pathname + url.search)
  await expect(page.getByRole('heading', { name: 'Confirm your fundraiser' })).toBeVisible()
  const still = await staff.request.get('/api/admin/fundraisers?pageSize=200')
  expect(JSON.stringify(await still.json())).not.toContain(title)

  await page.getByRole('button', { name: 'Confirm my fundraiser' }).click()
  await expect(page.getByRole('heading', { name: 'Thank you, it is with us' })).toBeVisible()

  /* now staff can review it */
  await staff.goto('/admin/fundraisers')
  await expect(staff.getByText(title).first()).toBeVisible()

  /* the same link again says so, and changes nothing */
  await page.reload()
  await page.getByRole('button', { name: 'Confirm my fundraiser' }).click()
  await expect(page.getByRole('heading', { name: 'Already confirmed' })).toBeVisible()

  expect(errors).toEqual([])
})
