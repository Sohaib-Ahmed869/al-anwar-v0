import { describe, expect, it } from 'vitest'

/* SECURITY FINDING H5, the server side. The server pins its clock to Sydney
   (server/env.ts) and does its month arithmetic in local time — so with the
   process started in UTC (vitest.config.ts, as on Render), loading the server
   must switch it to Sydney, and the next charge date must keep the Sydney
   day and time of day, across month ends, February and daylight saving. */

const { advance } = await import('../../server/lib/giving')

/** an instant given as a Sydney wall-clock time, checked by its Sydney parts */
const syd = (iso: string) => new Date(iso) // the process is in Sydney once env.ts has loaded
const parts = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]

describe('the server keeps Sydney time', () => {
  it('loading the server pins the process to Australia/Sydney', () => {
    expect(process.env.TZ).toBe('Australia/Sydney')
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Australia/Sydney')
    /* 9am on 1 July in Sydney is 23:00 on 30 June UTC */
    expect(parts(new Date('2026-06-30T23:00:00Z'))).toEqual([2026, 7, 1, 9, 0])
  })
})

describe('advance(): the next date a regular gift falls due', () => {
  it('keeps the day of the month, clamped to short months, and comes back', () => {
    const jan31 = syd('2027-01-31T09:00:00')
    const feb = advance(jan31, 'monthly', 31)
    expect(parts(feb)).toEqual([2027, 2, 28, 9, 0])
    const mar = advance(feb, 'monthly', 31)
    expect(parts(mar)).toEqual([2027, 3, 31, 9, 0])
    const apr = advance(mar, 'monthly', 31)
    expect(parts(apr)).toEqual([2027, 4, 30, 9, 0])
  })

  it('handles the 29th and 30th through February, leap year or not', () => {
    expect(parts(advance(syd('2027-01-29T09:00:00'), 'monthly', 29))).toEqual([2027, 2, 28, 9, 0])
    expect(parts(advance(syd('2028-01-29T09:00:00'), 'monthly', 29))).toEqual([2028, 2, 29, 9, 0])
    expect(parts(advance(syd('2028-01-30T09:00:00'), 'monthly', 30))).toEqual([2028, 2, 29, 9, 0])
  })

  it('keeps 9am across the daylight-saving changes', () => {
    /* clocks go forward on 4 October 2026 and back on 4 April 2027 */
    expect(parts(advance(syd('2026-09-15T09:00:00'), 'monthly', 15))).toEqual([2026, 10, 15, 9, 0])
    expect(parts(advance(syd('2027-03-15T09:00:00'), 'monthly', 15))).toEqual([2027, 4, 15, 9, 0])
    expect(parts(advance(syd('2026-10-01T09:00:00'), 'weekly'))).toEqual([2026, 10, 8, 9, 0])
    expect(parts(advance(syd('2027-04-01T09:00:00'), 'weekly'))).toEqual([2027, 4, 8, 9, 0])
  })

  it('a plan started on the 1st in Sydney stays on the 1st (it drifted to the 30th/31st in UTC)', () => {
    /* 8am on 1 August in Sydney is 22:00 on 31 July UTC */
    const start = new Date('2026-07-31T22:00:00Z')
    expect(start.getDate()).toBe(1)
    expect(parts(advance(start, 'monthly', start.getDate()))).toEqual([2026, 9, 1, 8, 0])
  })
})
