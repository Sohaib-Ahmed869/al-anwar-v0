import { expect, test } from '@playwright/test'
import { can } from '../../shared/access'
import { REGISTERS } from '../../shared/registers'
import { DONOR, PASSWORD, STAFF, freshEmail, signInDonor, signInStaff, watchErrors } from './helpers'

/* ---------------------------------------------------------------------------
   The three portals in a real browser.

     donor       sign in with the code shown on screen (no SMTP in tests),
                 giving history, receipts, a tax statement
     admin       sign in with a password, the dashboard, record a cash gift
                 through the dialog, approve a supporter page, download the
                 Xero file
     volunteer   what the role table says it may not see, it does not see
     compliance  a register opens

   Signing in through the forms is tested once each; the other tests sign in
   through the API (helpers.ts) and start on the page they are about.
--------------------------------------------------------------------------- */

test.describe('donor portal', () => {
  test('signs in with the emailed code and lands on the overview', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/account/login')
    await page.getByLabel('Email').fill(DONOR)
    await page.getByRole('button', { name: 'Email me a code' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    const code = (await page.getByText(/Your code is/).locator('strong').textContent())!.trim()
    expect(code).toMatch(/^\d{6}$/)
    await page.getByLabel('Digit 1').click()
    await page.keyboard.type(code)

    await page.waitForURL(/\/account\/?$/)
    await expect(page.getByRole('heading', { name: /Assalamu alaykum/ })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a wrong code is refused', async ({ page }) => {
    await page.goto('/account/login')
    await page.getByLabel('Email').fill(DONOR)
    await page.getByRole('button', { name: 'Email me a code' }).click()
    const code = (await page.getByText(/Your code is/).locator('strong').textContent())!.trim()
    const wrong = code === '000000' ? '111111' : '000000'
    await page.getByLabel('Digit 1').click()
    await page.keyboard.type(wrong)
    await expect(page).toHaveURL(/\/account\/login/)
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  })

  test('giving history, receipts and a tax statement', async ({ page }) => {
    const errors = watchErrors(page)
    await signInDonor(page)
    await page.goto('/account/giving')
    await expect(page.getByRole('heading', { name: 'My giving' })).toBeVisible()
    await expect(page.getByRole('row').nth(1)).toBeVisible()

    await page.goto('/account/receipts')
    await expect(page.getByRole('heading', { name: 'Receipts & tax' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Open receipt/ }).first()).toBeVisible()

    const years = await page.request.get('/api/me/gifts/statements')
    const fy = (await years.json()).items[0].fy
    await page.goto(`/account/statement/${fy}`)
    await expect(page.getByText(/Annual tax statement|Giving statement/).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the portal is closed when signed out', async ({ page }) => {
    await page.goto('/account/giving')
    await page.waitForURL(/\/account\/login/)
  })
})

test.describe('admin portal', () => {
  test('the owner signs in with a password and sees the dashboard', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(STAFF.owner)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/admin\/?$/)
    await expect(page.getByRole('link', { name: 'Donations' }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a wrong password is refused', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(STAFF.owner)
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('records a cash donation for a new donor', async ({ page }) => {
    await signInStaff(page, STAFF.finance)
    await page.goto('/admin/gifts?new=1')
    const dialog = page.getByRole('dialog', { name: 'Record a donation' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'New donor' }).click()
    await dialog.getByLabel('First name').fill('Cash')
    await dialog.getByLabel('Last name').fill('Giver')
    await dialog.getByLabel('Email').fill(freshEmail('cash'))
    await dialog.getByLabel('Amount').fill('40')
    await dialog.getByRole('button', { name: 'Save donation' }).click()
    await expect(page.getByText(/^Saved /).first()).toBeVisible()
    await expect(dialog).toBeHidden()
  })

  test('approves a pending supporter page', async ({ page }) => {
    await signInStaff(page, STAFF.fundraising)
    const list = await page.request.get('/api/admin/fundraisers?status=pending')
    const pending = (await list.json()).items[0]
    test.skip(!pending, 'no pending page left in the seed')

    await page.goto(`/admin/fundraisers?status=pending&open=${pending.id}`)
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect
      .poll(async () => (await (await page.request.get(`/api/admin/fundraisers/${pending.id}`)).json()).fundraiser?.status ?? null)
      .toBe('live')

    await page.goto(`/fundraisers/${pending.slug}`)
    await expect(page.getByRole('heading', { name: pending.title })).toBeVisible()
  })

  test('downloads the Xero file', async ({ page }) => {
    await signInStaff(page, STAFF.finance)
    const from = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
    await page.goto(`/admin/reports?tab=xero&from=${from}`)
    const button = page.getByRole('button', { name: 'Download for Xero' })
    await expect(button).toBeEnabled()
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    expect(download.suggestedFilename()).toMatch(/^xero-.*\.csv$/)
  })
})

test.describe('roles', () => {
  test('a volunteer sees only what the role table gives them', async ({ page }) => {
    await signInStaff(page, STAFF.volunteer)
    await page.goto('/admin/donors')
    if (can('volunteer', 'donors.read')) {
      await expect(page).toHaveURL(/\/admin\/donors/)
    } else {
      /* sent somewhere they may be, and no Donors link to come back by */
      await expect(page).not.toHaveURL(/\/admin\/donors/)
      await expect(page.getByRole('link', { name: 'Donors', exact: true })).toHaveCount(0)
    }
    /* never the settings, the staff list or the compliance portal */
    await page.goto('/admin/settings')
    await expect(page).not.toHaveURL(/\/admin\/settings/)
    await page.goto('/admin/staff')
    await expect(page).not.toHaveURL(/\/admin\/staff/)
    const api = await page.request.get('/api/compliance/overview')
    expect(api.status()).toBe(403)
  })

  test('the compliance officer opens a register', async ({ page }) => {
    const errors = watchErrors(page)
    await signInStaff(page, STAFF.compliance)
    const risks = REGISTERS.find((r) => r.key === 'risks') ?? REGISTERS[0]!
    await page.goto(`/compliance/registers/${risks.key}`)
    await expect(page.getByRole('heading', { name: risks.label, exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
})
