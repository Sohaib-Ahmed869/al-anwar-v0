import { describe, expect, it } from 'vitest'
import { centsToDecimal, formatMoney, formatMoneyShort, formatNumber, formatPercent, parseMoney } from '../../shared/money'
import { isOperatingCosts, OPERATING_COSTS_CENTS } from '../../shared/operating-costs'

/* ---------------------------------------------------------------------------
   shared/money.ts is the only place money is formatted — on screen, in email
   and in the CSV exports — so a receipt and the portal can't print the same
   gift two ways. These pin down its behaviour, including the float traps that
   integer cents exist to avoid.
--------------------------------------------------------------------------- */

describe('formatMoney', () => {
  it('prints whole dollars without cents, and cents when there are some', () => {
    expect(formatMoney(5000)).toBe('$50')
    expect(formatMoney(123450)).toBe('$1,234.50')
    expect(formatMoney(5)).toBe('$0.05')
  })
  it('exact always shows cents; whole rounds', () => {
    expect(formatMoney(5000, { exact: true })).toBe('$50.00')
    expect(formatMoney(123450, { whole: true })).toBe('$1,235')
  })
  it('treats null and undefined as zero', () => {
    expect(formatMoney(null)).toBe('$0')
    expect(formatMoney(undefined)).toBe('$0')
  })
  it('handles negatives (refunds)', () => {
    expect(formatMoney(-2550)).toMatch(/^-\$25\.50$/)
  })
})

describe('formatMoneyShort', () => {
  it.each([
    [0, '$0'],
    [99_900, '$999'],
    [120_000, '$1.2k'],
    [100_000, '$1k'],
    [4_820_000, '$48k'],
    [130_000_000, '$1.3m'],
    [1_500_000_000, '$15m'],
  ])('%i cents → %s', (cents, text) => {
    expect(formatMoneyShort(cents)).toBe(text)
  })
})

describe('parseMoney', () => {
  it.each([
    ['12.50', 1250],
    ['$1,234.5', 123450],
    [' 7 ', 700],
    ['0.1', 10],
    ['-3.20', -320],
    [19.99, 1999],
    [0.1 + 0.2, 30],
  ])('%s → %i cents', (input, cents) => {
    expect(parseMoney(input)).toBe(cents)
  })
  it.each(['', 'abc', '1.234', '1.2.3', '$', '12,50.1x'])('rejects %j', (input) => {
    expect(parseMoney(input)).toBeNaN()
  })
})

describe('centsToDecimal', () => {
  it('is a plain decimal for CSV and Xero', () => {
    expect(centsToDecimal(1250)).toBe('12.50')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(100_000_000)).toBe('1000000.00')
  })
  it('round-trips through parseMoney for every cent value in a range', () => {
    for (let c = 0; c <= 100_000; c += 7) expect(parseMoney(centsToDecimal(c))).toBe(c)
  })
})

describe('numbers and percents', () => {
  it('formats', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatPercent(0.125, 1)).toBe('12.5%')
    expect(formatPercent(0.5)).toBe('50%')
  })
})

describe('operating costs', () => {
  it('only the listed figures (and none) are accepted', () => {
    expect(isOperatingCosts(0)).toBe(true)
    for (const c of OPERATING_COSTS_CENTS) expect(isOperatingCosts(c)).toBe(true)
    expect(isOperatingCosts(317)).toBe(false)
    expect(isOperatingCosts(-200)).toBe(false)
  })
})
