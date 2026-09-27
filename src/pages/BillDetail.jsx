import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadBill, messageFor } from '../lib/api.js'
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
 * Return and exchange (POS-SALE-010, -011) attach to this screen in Phase 6.
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
      </div>
      <Receipt sale={data} />
    </div>
  )
}

const s = {
  state: { padding: 16, display: 'grid', gap: 12, justifyItems: 'start' },
  crumb: { padding: '10px 16px 0' },
  back: { color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 14 },
  bad: { color: 'var(--bad)', margin: 0 }
}
