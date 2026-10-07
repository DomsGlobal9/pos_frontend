import { useEffect, useRef, useState } from 'react'
import { rupees } from '../lib/api.js'

/**
 * A manager saying yes, in place. POS-APR-001, -002, -003, -006.
 *
 * The cashier asked for something they may not do alone -- a discount over the limit, or a price
 * that is not the one on the tag. A manager walks over, reads what is being asked, types why and
 * their PIN, and walks away.
 *
 * THE CASHIER NEVER SIGNS OUT. Their basket, their payment and the customer at the counter all
 * stay exactly where they were. That is the whole feature; the alternative -- a manager signing in
 * properly -- throws the cashier out mid-sale and, in a real shop, ends with the manager's
 * password on a sticky note by the till.
 *
 * WHAT IS BEING APPROVED IS SHOWN IN FULL before anyone types a PIN. A manager approving
 * "something" without seeing that it is 26% off a silk saree is not approving anything.
 */
export default function ApprovalSheet({ need, error, busy, onApprove, onCancel, initialReason = '' }) {
  const [reason, setReason] = useState(initialReason)
  const [pin, setPin] = useState('')
  const reasonBox = useRef(null)

  useEffect(() => { reasonBox.current?.focus() }, [])

  function submit(event) {
    event.preventDefault()
    if (busy) return
    onApprove({ pin: pin.trim(), reason: reason.trim() })
  }

  const what = describe(need)

  return (
    <div style={s.backdrop} role="dialog" aria-label="Manager approval">
      <form style={s.panel} onSubmit={submit}>
        <div>
          <b style={s.title}>Manager approval needed</b>
          <p style={s.what}>{what}</p>
        </div>

        <label style={s.label}>
          Why
          <input
            ref={reasonBox}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Regular customer, damaged piece, bulk order…"
            aria-label="Reason"
          />
        </label>

        <label style={s.label}>
          Manager PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            aria-label="Manager PIN"
          />
        </label>

        {/* POS-APR-006: a refusal in plain words -- "that PIN was not recognised", "Ravi is not
            allowed to approve a discount above the limit" -- never a 403. */}
        {error && <p style={s.bad}>{error}</p>}

        <p style={s.muted}>
          The sale stays as it is while the manager approves. Nobody is signed out.
        </p>

        <div style={s.actions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.confirm} disabled={busy || !pin || reason.trim().length < 4}>
            {busy ? 'Checking…' : 'Approve'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** What exactly is being asked for, in the words a manager would use. */
function describe(need) {
  if (!need) return ''
  if (need.kind === 'DISCOUNT_OVER_LIMIT') {
    const percent = need.subtotalPaise
      ? Math.round((need.discountPaise / need.subtotalPaise) * 1000) / 10
      : null
    return `${rupees(need.discountPaise)} off a ${rupees(need.subtotalPaise)} bill` +
      (percent !== null ? ` — ${percent}%` : '') +
      `. Cashiers can give up to ${need.limitPercent}% on their own.`
  }
  if (need.kind === 'PRICE_OVERRIDE') {
    const lines = need.lines ?? []
    if (lines.length === 1) {
      return `Selling ${lines[0].code} at ${rupees(lines[0].nowPaise)} instead of ${rupees(lines[0].wasPaise)}.`
    }
    return `Changing the price of ${lines.length} items.`
  }
  if (need.kind === 'CASH_OUT') {
    return `Taking ${rupees(need.amountPaise)} out of the drawer for "${need.forWhat}".`
  }
  if (need.kind === 'RETURN') {
    return `Refunding ${rupees(need.totalPaise)} on ${need.invoiceNo}. Cashiers need a manager for any return.`
  }
  if (need.kind === 'PAYMENT_VOID') {
    return `Marking ${rupees(need.amountPaise)} ${need.method} on ${need.invoiceNo} as never arrived. ` +
      'The customer will owe it again.'
  }
  if (need.kind === 'RETURN_OUTSIDE_WINDOW') {
    return `Refunding ${rupees(need.totalPaise)} on ${need.invoiceNo}, which is ${need.daysSince} days old. ` +
      `The shop takes returns for ${need.windowDays} days.`
  }
  if (need.kind === 'PAY_LATER') {
    return `Selling on credit: ${rupees(need.owedPaise)} of a ${rupees(need.totalPaise)} bill will be owed, and the goods go home now.`
  }
  return 'Something on this bill needs a manager.'
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(16,24,14,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    // Above the payment sheet, which is still open underneath.
    zIndex: 10
  },
  panel: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, boxShadow: 'var(--shadow-lift)',
    padding: 20, width: 420, maxWidth: '100%', display: 'grid', gap: 14
  },
  title: { fontSize: 17 },
  what: { margin: '6px 0 0', lineHeight: 1.5 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  bad: { margin: 0, color: 'var(--bad)', fontSize: 14 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  confirm: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
