import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadAwaitingCheck, resolvePayment, rupees, messageFor } from '../lib/api.js'

/**
 * WF-PAY-02. POS-PAY-010, -011.
 *
 * Payments nobody is sure about yet.
 *
 * This screen is the whole reason the "not confirmed yet" option is safe to offer. A state nobody
 * ever looks at is just a quieter way of losing the money — so every unconfirmed payment lands
 * here, with the bill it belongs to, until someone settles it against the bank.
 *
 * Two answers, and both are recorded: the money arrived (with the reference that is finally
 * available), or it never did and the bill is genuinely short. There is no third option and no way
 * to make the row disappear, because a row that can be dismissed is a row that will be.
 */
export default function PaymentChecks() {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['awaiting-check'],
    queryFn: loadAwaitingCheck
  })

  async function settle(payment, arrived) {
    const reference = arrived
      // Asked for, not demanded: the whole point is that a reference may still not exist.
      ? (window.prompt(`Reference for the ${rupees(payment.amountPaise)} ${payment.method} payment, if you have one:`) ?? '')
      : ''
    setBusy(payment.id)
    try {
      await resolvePayment(payment.id, { arrived, ...(reference.trim() ? { reference: reference.trim() } : {}) })
      toast.success(arrived ? 'Marked as received.' : 'Marked as never arrived.')
      queryClient.invalidateQueries({ queryKey: ['awaiting-check'] })
      queryClient.invalidateQueries({ queryKey: ['bill', payment.saleId] })
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(null)
    }
  }

  const payments = data ?? []

  return (
    <div style={s.page}>
      <h1 style={s.title}>Payments to check</h1>
      <p style={s.intro}>
        These were taken without confirmation. Check each one against the bank, then say what you
        found. <b>Never ask the customer to pay again</b> — the money may already be in.
      </p>

      {isError && <p style={s.bad}>{messageFor(error)}</p>}
      {isLoading && <p style={s.muted}>Loading…</p>}

      {!isLoading && payments.length === 0 && (
        <p style={s.muted}>Nothing to check. Every payment is confirmed.</p>
      )}

      <ul style={s.list} className="card-list">
        {payments.map(payment => (
          <li key={payment.id} style={s.row}>
            <div style={s.detail}>
              <div>
                <b>{rupees(payment.amountPaise)}</b>
                <span style={s.muted}> · {payment.method}</span>
              </div>
              <div style={s.muted}>
                <Link to={`/bills/${payment.saleId}`} style={s.link}>{payment.invoiceNo}</Link>
                {' · '}{new Date(payment.createdAt).toLocaleString('en-IN')}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </div>
            </div>
            <div style={s.actions}>
              <button
                disabled={busy === payment.id}
                onClick={() => settle(payment, true)}
              >
                It arrived
              </button>
              <button
                disabled={busy === payment.id}
                style={s.never}
                onClick={() => settle(payment, false)}
              >
                Never arrived
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  intro: { margin: 0, lineHeight: 1.6, fontSize: 14, color: 'var(--ink-soft)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid var(--line)'
  },
  detail: { minWidth: 0 },
  actions: { display: 'flex', gap: 8 },
  never: { color: 'var(--bad)' },
  link: { color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  bad: { color: 'var(--bad)', margin: 0 }
}
