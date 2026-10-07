import { useEffect, useRef, useState } from 'react'
import { createUpiQr, loadUpiQr, closeUpiQr, rupees, messageFor } from '../lib/api.js'
import { newOnceKey } from '../lib/basket.js'

/**
 * UPI THAT CONFIRMS ITSELF (PLAN-payments Step 2). A single-use QR for exactly this amount, made on the
 * shop's own Razorpay through Inventory. While it is up the till asks every 2 s; the moment Razorpay
 * says paid, the row is paid -- no reference to type, and a screenshot cannot pass. The server checks
 * again at Complete, so this screen's "paid" is only a signal.
 *
 * When it cannot be had (switched off, Razorpay slow, offline) it says so in one line and the shop's
 * own UPI QR below it is used as before.
 */
export default function RazorpayQr({ amountPaise, onChange }) {
  const [qr, setQr] = useState(null)       // { qrId, imageUrl, amountPaise }
  const [state, setState] = useState('idle') // idle | making | waiting | paid | wrong | refused
  const [note, setNote] = useState('')
  const live = useRef(null)

  // The amount changed under a QR: that QR is for the old amount. Close it; a new one is a tap away.
  useEffect(() => {
    if (qr && qr.amountPaise !== amountPaise && state === 'waiting') {
      closeUpiQr(qr.qrId).catch(() => {})
      setQr(null); setState('idle'); onChange(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountPaise])

  // The row goes away (another method chosen) with a QR still waiting: close it.
  // ponytail: a payment landing in that same second is caught by Razorpay's own records, not by a bill.
  useEffect(() => () => { if (live.current && stateRef.current === 'waiting') closeUpiQr(live.current).catch(() => {}) }, [])
  const stateRef = useRef(state)
  stateRef.current = state

  // Ask while waiting. Stops when paid, closed, or this row goes away.
  useEffect(() => {
    if (state !== 'waiting' || !qr) return
    live.current = qr.qrId
    const timer = setInterval(async () => {
      try {
        const s = await loadUpiQr(qr.qrId)
        if (live.current !== qr.qrId) return
        if (s.status === 'PAID') { setState('paid'); onChange({ qrId: qr.qrId, paid: true, utr: s.utr ?? s.paymentId }) }
        else if (s.status === 'PAID_WRONG_AMOUNT') { setState('wrong'); setNote(`The customer paid ${rupees(s.paidPaise)}, not ${rupees(amountPaise)}. Check with them -- this payment is not counted.`) }
        else if (s.status === 'CLOSED') { setState('idle'); setQr(null); onChange(null) }
      } catch { /* a missed poll is retried in 2 s */ }
    }, 2000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, qr?.qrId])

  async function make() {
    setState('making'); setNote('')
    try {
      const made = await createUpiQr(amountPaise, newOnceKey())
      if (!made.ok) { setState('refused'); setNote(made.reason); return }
      setQr(made); setState('waiting'); onChange({ qrId: made.qrId, paid: false })
    } catch (err) {
      setState('refused'); setNote(messageFor(err))
    }
  }

  if (!navigator.onLine) return null
  if (state === 'idle' || state === 'making') {
    return (
      <button type="button" onClick={make} disabled={state === 'making' || !amountPaise} style={s.button}>
        {state === 'making' ? 'Making the QR…' : `Show Razorpay QR for ${rupees(amountPaise)} (confirms itself)`}
      </button>
    )
  }
  if (state === 'refused') return <p style={s.muted} role="status">{note} Use the shop's own QR below.</p>
  return (
    <div style={s.box} aria-label="Razorpay QR">
      {state === 'paid'
        ? <p style={s.paid} role="status">Paid ✓ {rupees(amountPaise)} received by Razorpay.</p>
        : <>
            <img src={qr.imageUrl} alt={`UPI QR for ${rupees(amountPaise)}`} width={200} height={200} style={s.img} />
            <p style={s.muted} role="status">
              {state === 'wrong' ? note : `Waiting for the customer to pay ${rupees(amountPaise)}… it confirms itself.`}
            </p>
          </>}
    </div>
  )
}

const s = {
  button: { justifySelf: 'start' },
  box: { display: 'grid', justifyItems: 'center', gap: 6, padding: 10, border: '1px solid var(--line)', borderRadius: 12 },
  img: { width: 200, height: 200, imageRendering: 'pixelated', background: '#fff' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center' },
  paid: { margin: 0, color: 'var(--good, #15803d)', fontWeight: 700 }
}
