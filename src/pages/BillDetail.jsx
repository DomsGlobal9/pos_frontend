import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadBill, messageFor, rupees } from '../lib/api.js'
import Receipt from '../components/Receipt.jsx'

/**
 * WF-SALE-02. POS-SALE-007..009, POS-RCPT-003.
 *
 * One bill from history, in the same shape the customer's copy was printed in -- because it IS
 * the same component. Rendering a stored bill differently from the original is how a reprint
 * stops matching the paper someone is holding, and the paper is the one that wins an argument.
 *
 * No `onDone`, so the Receipt drops its "Next sale" action and its Enter shortcut: there is no
 * next sale to start from here, and a cashier landing on an old bill must not have Enter do
 * something they did not ask for.
 *
 * RETURN AND EXCHANGE START HERE (POS-SALE-010, -011), from the bill itself -- a refund with no
 * bill behind it is the oldest way money leaves a till. What already came back is listed above the
 * receipt, not written onto it: the receipt is the customer's paper as printed, and a reprint must
 * still match it. POS-SALE-012: nothing on a bill is ever edited or deleted; a credit note beside
 * it is the only correction.
 */
export default function BillDetail() {
  const { id } = useParams()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => loadBill(id)
  })

  if (isLoading) {
    return <p style={s.state}>Opening the bill…</p>
  }

  if (isError) {
    return (
      <div style={s.state}>
        <p style={s.bad}>{messageFor(error)}</p>
        <Link to="/bills" style={s.back}>Back to bills</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={s.crumb} className="no-print">
        <Link to="/bills" style={s.back}>← All bills</Link>
        {/* POS-SALE-009. Only when the bill has one -- most will not. */}
        {data.customer && (
          <Link to={`/customers/${data.customer.id}`} style={s.back}>
            {data.customer.name || data.customer.phoneMasked} →
          </Link>
        )}
      </div>
      <div style={s.panel} className="no-print">
        {data.status !== 'RETURNED' && data.status !== 'PENDING_SYNC' && (
          <div style={s.actions}>
            <Link to={`/bills/${data.id}/return`} style={s.action}>Return</Link>
            <Link to={`/bills/${data.id}/exchange`} style={s.action}>Exchange</Link>
          </div>
        )}
        {data.status === 'RETURNED' && <p style={s.note}>Everything on this bill has been returned.</p>}

        {data.returns?.length > 0 && (
          <ul style={s.returns}>
            {data.returns.map(r => (
              <li key={r.id}>
                <Link to={`/returns/${r.id}`} style={s.returnRow}>
                  <span>
                    {r.exchangeSale ? 'Exchanged' : 'Returned'} · {r.creditNoteNo}
                    <span style={s.soft}> · {new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </span>
                  <b>{rupees(r.totalPaise)}</b>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data.exchangedFrom && (
          <Link to={`/returns/${data.exchangedFrom.returnId}`} style={s.back}>
            Exchange against {data.exchangedFrom.originalInvoiceNo} ({data.exchangedFrom.creditNoteNo}) →
          </Link>
        )}
      </div>

      <Receipt sale={data} />
    </div>
  )
}

const s = {
  state: { padding: 16, display: 'grid', gap: 12, justifyItems: 'start' },
  crumb: { padding: '10px 16px 0', display: 'flex', justifyContent: 'space-between', gap: 12 },
  back: { color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 14 },
  panel: { padding: '10px 16px 0', display: 'grid', gap: 10, maxWidth: 720 },
  actions: { display: 'flex', gap: 8 },
  action: {
    minHeight: 44, padding: '0 18px', display: 'inline-flex', alignItems: 'center',
    border: '1px solid var(--line)', borderRadius: 10, textDecoration: 'none', color: 'var(--ink)',
    background: 'var(--panel)', fontWeight: 600
  },
  note: { margin: 0, color: 'var(--ink-soft)' },
  returns: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  returnRow: {
    display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
    borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)', fontSize: 14
  },
  soft: { color: 'var(--ink-soft)', fontSize: 12 },
  bad: { color: 'var(--bad)', margin: 0 }
}
