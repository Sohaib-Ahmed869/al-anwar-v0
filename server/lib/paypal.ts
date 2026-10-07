import type { Request } from 'express'
import { formatMoney } from '../../shared/money'
import { Gift } from '../models'
import { afterOnlineGiftPaid, markOnlineGiftPaid } from '../routes/webhooks'
import { alert } from './alert'
import { audit } from './audit'
import { paypalCapture, paypalOrderCapture, type CaptureResult } from './payments'

/* ---------------------------------------------------------------------------
   Settling a PayPal order against its gift — the one set of rules for the
   return page (which captures) and the abandoned-checkout sweep (which only
   asks PayPal what the order holds now).

     COMPLETED, in AUD, for exactly what the gift asked   paid (even a gift
                                                          marked failed: the
                                                          money arrived)
     COMPLETED for anything else                         left as it is, and
                                                          staff told
     PENDING capture (held for review)                   left pending, the
                                                          capture remembered;
                                                          the sweep checks it
     a definite decline                                  failed, if pending
     no clear answer                                     left pending

   PayPal's webhook (routes/webhooks.ts, POST /api/webhooks/paypal) settles a
   held capture the moment PayPal releases it, and brings refunds and
   reversals made in PayPal into the books; the sweep still re-reads held
   captures in case a webhook never arrives (lib/sweeps.ts). Finding M6.
--------------------------------------------------------------------------- */

export type PaypalOutcome = 'paid' | 'held' | 'failed' | 'waiting' | 'mismatch'

export async function settlePaypalOrder(
  giftId: string,
  orderId: string,
  opts: { capture: boolean; req?: Request | null },
): Promise<PaypalOutcome> {
  const gift = await Gift.findById(giftId)
  if (!gift) return 'waiting'
  const req = opts.req ?? null

  let cap: CaptureResult = opts.capture
    ? await paypalCapture(orderId).catch((err: unknown) => ({ ok: false as const, kind: 'unknown' as const, error: String(err) }))
    : { ok: false, kind: 'unknown', error: 'not captured here' }
  /* anything short of a clear answer: ask PayPal what the order holds now
     (a timeout after the capture went through, a second load of the page) */
  if (!cap.ok && cap.kind === 'unknown') {
    const held = await paypalOrderCapture(orderId).catch(() => null)
    if (held) cap = held
  }

  if (cap.ok) {
    const expected = gift.amount + (gift.fee ?? 0)
    if (cap.currency !== 'AUD' || cap.amountCents !== expected) {
      await audit(req, 'gift.mismatch', `PayPal captured ${cap.amountCents} ${cap.currency} (cents) for donation ${gift.number}, which asked for ${expected} AUD; it was not marked paid. Check it in PayPal.`, {
        type: 'gift', id: gift._id, label: gift.number,
      })
      return 'mismatch'
    }
    const paid = await markOnlineGiftPaid(gift.id, { paypal: cap.captureId }, { revive: true })
    if (paid) await afterOnlineGiftPaid(paid, 'PayPal')
    return 'paid'
  }

  if (cap.kind === 'pending') {
    const marked = await Gift.updateOne(
      { _id: gift._id, status: 'pending', 'paypalCapture.id': { $ne: cap.captureId } },
      { $set: { paypalCapture: { id: cap.captureId, status: 'PENDING', at: new Date() } } },
    )
    if (marked.modifiedCount) {
      await audit(req, 'gift.paypal_held', `PayPal is holding the ${formatMoney(gift.amount)} payment for donation ${gift.number} for review; it will be recorded when PayPal releases it`, {
        type: 'gift', id: gift._id, label: gift.number,
      })
    }
    return 'held'
  }

  if (cap.kind === 'declined') {
    const failed = await Gift.findOneAndUpdate({ _id: gift._id, status: 'pending' }, { $set: { status: 'failed', failureReason: cap.error }, $unset: { paypalCapture: 1 } })
    if (failed) {
      await audit(req, 'gift.failed', `PayPal did not complete ${formatMoney(gift.amount)} donation ${gift.number} from ${gift.donorName}: ${cap.error}`, {
        type: 'gift', id: gift._id, label: gift.number,
      })
    }
    return 'failed'
  }

  if (opts.capture) alert('webhook', `PayPal gave no clear answer for donation ${gift.number}; it stays pending and will be checked again`, cap.error)
  return 'waiting'
}
