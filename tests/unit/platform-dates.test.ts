import { describe, expect, it } from 'vitest'
import { fyOf, fyRange, sydneyDay, sydneyMidnight, sydneyParts } from '../../shared/domain'

/* SECURITY FINDING H5. The financial year and the calendar day are Sydney's,
   whatever zone the machine runs in. This file runs with the process in UTC
   (vitest.config.ts), as Render does, and never loads server/env.ts (which
   pins the server to Sydney) — so these pass only if shared/domain.ts names
   the zone itself, as it must for browsers anywhere. */

describe('the process is in UTC for these tests', () => {
  it('really is', () => {
    expect(new Date('2026-07-01T00:00:00Z').getHours()).toBe(0)
  })
})

describe('the financial year, in Sydney', () => {
  it('30 June 23:59 Sydney is the old year; 1 July 00:00 Sydney is the new one', () => {
    /* AEST, UTC+10 */
    expect(fyOf('2026-06-30T13:59:00Z')).toBe(2026)
    expect(fyOf('2026-06-30T14:00:00Z')).toBe(2027)
  })

  it('9am on 1 July in Sydney — still 30 June in UTC — is the new year', () => {
    expect(fyOf('2026-06-30T23:00:00Z')).toBe(2027)
  })

  it('a date-only string means that day', () => {
    expect(fyOf('2026-07-01')).toBe(2027)
    expect(fyOf('2026-06-30')).toBe(2026)
  })

  it('fyRange starts and ends at Sydney midnight on 1 July', () => {
    const { from, to } = fyRange(2027)
    expect(from.toISOString()).toBe('2026-06-30T14:00:00.000Z')
    expect(to.toISOString()).toBe('2027-06-30T14:00:00.000Z')
    expect(fyOf(from)).toBe(2027)
    expect(fyOf(new Date(to.getTime() - 1))).toBe(2027)
    expect(fyOf(to)).toBe(2028)
  })
})

describe('Sydney midnight across daylight saving', () => {
  it('is UTC+10 in winter and UTC+11 in summer', () => {
    expect(sydneyMidnight(2026, 7, 1).toISOString()).toBe('2026-06-30T14:00:00.000Z')
    expect(sydneyMidnight(2027, 1, 1).toISOString()).toBe('2026-12-31T13:00:00.000Z')
  })

  it('is right on the days the clocks change (4 Oct 2026 forward, 4 Apr 2027 back)', () => {
    /* the change happens at 2am/3am, so midnight is still on the old offset */
    expect(sydneyMidnight(2026, 10, 4).toISOString()).toBe('2026-10-03T14:00:00.000Z')
    expect(sydneyMidnight(2026, 10, 5).toISOString()).toBe('2026-10-04T13:00:00.000Z')
    expect(sydneyMidnight(2027, 4, 4).toISOString()).toBe('2027-04-03T13:00:00.000Z')
    expect(sydneyMidnight(2027, 4, 5).toISOString()).toBe('2027-04-04T14:00:00.000Z')
  })

  it('round-trips: the midnight of a day is that day', () => {
    for (const [y, m, d] of [[2026, 10, 4], [2027, 4, 4], [2028, 2, 29], [2026, 12, 31]] as const) {
      const at = sydneyMidnight(y, m, d)
      expect(sydneyParts(at)).toMatchObject({ year: y, month: m, day: d, hour: 0, minute: 0 })
      expect(sydneyDay(at)).toBe(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  })
})
