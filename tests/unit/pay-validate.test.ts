import { describe, expect, it } from 'vitest'
import { FUNDS, MIN_GIFT, NAME_LOOKS_RIGHT, designationOf, takesMonthly, validateGift, type GiftPayload } from '../../shared/giving'
import { CAUSES } from '../../src/components/give-data'

/* The giving rules in shared/giving.ts: one function, run by the give form
   before it posts and by POST /api/public/checkout on whatever arrives. */

const gift = (over: Partial<GiftPayload> = {}): GiftPayload => ({
  fund: 'sadaqah',
  frequency: 'once',
  amount: 50,
  operatingCosts: 0,
  provider: 'stripe',
  first: 'Amina',
  last: 'Rahman',
  email: 'amina@example.com',
  behalfName: '',
  updates: false,
  ...over,
})

describe('validateGift', () => {
  it('accepts an ordinary gift', () => {
    expect(validateGift(gift())).toEqual({})
  })

  it('refuses an unknown fund', () => {
    expect(validateGift(gift({ fund: 'yachts' })).fund).toBeTruthy()
  })

  it('refuses less than the minimum, NaN and absurd amounts', () => {
    expect(validateGift(gift({ amount: MIN_GIFT - 0.01 })).amount).toBeTruthy()
    expect(validateGift(gift({ amount: Number.NaN })).amount).toBeTruthy()
    expect(validateGift(gift({ amount: 2_000_000 })).amount).toBeTruthy()
    expect(validateGift(gift({ amount: MIN_GIFT }))).toEqual({})
  })

  it('takes only the listed operating-cost contributions', () => {
    for (const ok of [0, 2, 5, 10]) expect(validateGift(gift({ operatingCosts: ok })).operatingCosts).toBeUndefined()
    for (const bad of [3.17, 10_000, -2, Number.NaN]) expect(validateGift(gift({ operatingCosts: bad })).operatingCosts).toBeTruthy()
  })

  it('needs a name and a working address', () => {
    expect(validateGift(gift({ first: ' ' })).first).toBeTruthy()
    expect(validateGift(gift({ last: '' })).last).toBeTruthy()
    expect(validateGift(gift({ email: 'not-an-email' })).email).toBeTruthy()
    expect(validateGift(gift({ email: `${'a'.repeat(200)}@example.com` })).email).toBeTruthy()
  })

  it('keeps links, markup and formulas out of names (M10)', () => {
    for (const bad of ['[Your receipt](https://evil.tld)', '<b>x</b>', '=HYPERLINK("x")', 'a@b.com']) {
      expect(validateGift(gift({ first: bad })).first, bad).toBeTruthy()
    }
    for (const ok of ['Amina', "O'Neil", 'Al-Hassan', 'Zoë', 'محمد', 'J. R.']) {
      expect(validateGift(gift({ first: ok })).first, ok).toBeUndefined()
    }
  })

  it('refuses a monthly gift of something owed once', () => {
    for (const f of FUNDS.filter((x) => !x.monthly)) {
      expect(validateGift(gift({ fund: f.id, frequency: 'monthly' })).frequency, f.id).toBeTruthy()
    }
    for (const f of FUNDS.filter((x) => x.monthly)) {
      expect(validateGift(gift({ fund: f.id, frequency: 'monthly' })), f.id).toEqual({})
    }
  })

  it('refuses a monthly gift by PayPal', () => {
    expect(validateGift(gift({ frequency: 'monthly', provider: 'paypal' })).provider).toBeTruthy()
  })

  it('refuses an unknown provider or frequency', () => {
    expect(validateGift(gift({ provider: 'cash' as never })).provider).toBeTruthy()
    expect(validateGift(gift({ frequency: 'daily' as never })).frequency).toBeTruthy()
  })
})

describe('funds and designations', () => {
  it('the site’s causes and the shared funds are the same list', () => {
    expect(CAUSES.map((c) => c.id).sort()).toEqual(FUNDS.map((f) => f.id).sort())
  })

  it('a fund offers a monthly ladder exactly when the rule allows monthly', () => {
    for (const c of CAUSES) expect(Boolean(c.monthly), c.id).toBe(takesMonthly(c.id))
  })

  it('the obligations keep their own designation; everything else is sadaqah', () => {
    expect(designationOf('zakat')).toBe('zakat')
    expect(designationOf('zakat-fitr')).toBe('zakat_fitr')
    expect(designationOf('kaffarah')).toBe('kaffarah')
    expect(designationOf('fidyah')).toBe('fidyah')
    for (const id of ['water', 'food', 'education', 'emergency', 'qurbani', 'sadaqah', 'anything']) expect(designationOf(id)).toBe('sadaqah')
  })

  it('NAME_LOOKS_RIGHT caps a name at 80 characters', () => {
    expect(NAME_LOOKS_RIGHT.test('a'.repeat(80))).toBe(true)
    expect(NAME_LOOKS_RIGHT.test('a'.repeat(81))).toBe(false)
  })
})
