import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { searchCustomers, loadCustomer, rupees, messageFor } from '../lib/api.js'

/**
 * WF-CUSTOMERS-01. POS-CUST-007.
 *
 * One box for a name or a number, because a shopkeeper should not have to decide which they are
 * holding before they can type it.
 *
 * NOT A CRM. What a cashier needs is who this person is and what they have bought here.
 * Segmentation, campaigns and communication history belong to CRM, which is not built yet — and
 * when it is, this screen links out to it rather than growing into it.
 */
export function Customers() {
  const [q, setQ] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customers', q.trim()],
    queryFn: () => searchCustomers(q.trim()),
    placeholderData: keepPreviousData
  })

  const customers = data ?? []

  return (
    <div style={s.page}>
      <h1 style={s.title}>Customers</h1>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Name or phone number"
        aria-label="Find a customer"
      />

      {isError && <p style={s.bad}>{messageFor(error)}</p>}
      {isLoading && <p style={s.muted}>Looking…</p>}

      {!isLoading && customers.length === 0 && (
        <p style={s.muted}>
          {q.trim()
            ? 'Nobody matches that.'
            : 'No customers yet. They are added during a sale — a sale never needs one.'}
        </p>
      )}

      <ul style={s.list}>
        {customers.map(customer => (
          <li key={customer.id}>
            <Link to={`/customers/${customer.id}`} style={s.row}>
              <div style={s.main}>
                <div><b>{customer.name || 'No name'}</b></div>
                <div style={s.muted}>{customer.phoneDisplay}</div>
              </div>
              <div style={s.right}>
                <div>{rupees(customer.lifetimeSpentPaise)}</div>
                <div style={s.muted}>
                  {customer.visitCount} {customer.visitCount === 1 ? 'visit' : 'visits'}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * WF-CUSTOMER-02. POS-CUST-008, -009, -010.
 *
 * Enough to serve the person, and a link to their bills. The "View in CRM" action (POS-CUST-013)
 * belongs here and is absent on purpose — CRM is not built, and a button that goes nowhere is
 * worse than no button.
 */
export function CustomerDetail() {
  const { id } = useParams()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => loadCustomer(id)
  })

  if (isLoading) return <p style={s.state}>Loading…</p>
  if (isError) {
    return (
      <div style={s.state}>
        <p style={s.bad}>{messageFor(error)}</p>
        <Link to="/customers" style={s.muted}>Back to customers</Link>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Link to="/customers" style={s.muted}>← All customers</Link>

      <div>
        <h1 style={s.title}>{data.name || 'No name'}</h1>
        <div style={s.muted}>{data.phoneDisplay}</div>
        {data.gstin && <div style={s.muted}>GSTIN {data.gstin}</div>}
      </div>

      <div style={s.tiles}>
        <Tile label="Visits" value={String(data.visitCount)} />
        <Tile label="Spent here" value={rupees(data.lifetimeSpentPaise)} />
      </div>

      {/* POS-CUST-011. Only when there is something -- a zero here is noise on every card. */}
      {data.owedPaise > 0 && (
        <Link to="/orders" style={s.owes}>
          Owes {rupees(data.owedPaise)} on kept orders →
        </Link>
      )}

      {/* POS-CUST-012. Only when there is some, with the reason under it. */}
      {(data.storeCreditPaise > 0 || data.creditHistory?.length > 0) && (
        <section>
          <h2 style={s.heading}>Store credit: {rupees(data.storeCreditPaise)}</h2>
          <ul style={s.list}>
            {data.creditHistory.map(entry => (
              <li key={entry.id} style={s.creditRow}>
                <span>
                  {entry.amountPaise > 0 ? 'Given' : 'Spent'}
                  {entry.documentNo && (
                    <Link to={entry.documentKind === 'CREDIT_NOTE' ? `/returns/${entry.documentId}` : `/bills/${entry.documentId}`} style={s.muted}>
                      {' '}· {entry.documentNo}
                    </Link>
                  )}
                  <span style={s.muted}> · {new Date(entry.createdAt).toLocaleDateString('en-IN')}</span>
                </span>
                <b>{entry.amountPaise > 0 ? '+' : '−'}{rupees(Math.abs(entry.amountPaise))}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.note && <p style={s.note}>{data.note}</p>}

      <div style={s.muted}>
        {data.marketingConsent ? 'Happy to receive offers' : 'Has not agreed to offers'}
        {data.firstSeenAt && ` · first visit ${new Date(data.firstSeenAt).toLocaleDateString('en-IN')}`}
      </div>

      <section>
        <h2 style={s.heading}>Recent bills</h2>
        {data.recent.length === 0 && <p style={s.muted}>Nothing bought yet.</p>}
        <ul style={s.list}>
          {data.recent.map(sale => (
            <li key={sale.id}>
              <Link to={`/bills/${sale.id}`} style={s.row}>
                <div style={s.main}>
                  <div><b>{rupees(sale.totalPaise)}</b>
                    <span style={s.muted}> · {sale.itemCount} {sale.itemCount === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div style={s.muted}>
                    {sale.invoiceNo}
                    {/* POS-CUST-015. */}
                    {sale.status === 'RETURNED'
                      ? ' · returned'
                      : sale.returnedPaise > 0 ? ` · ${rupees(sale.returnedPaise)} returned` : ''}
                  </div>
                </div>
                <div style={s.muted}>
                  {new Date(sale.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const Tile = ({ label, value }) => (
  <div style={s.tile}>
    <div style={s.muted}>{label}</div>
    <div style={s.tileValue}>{value}</div>
  </div>
)

const s = {
  page: { padding: 16, display: 'grid', gap: 14, maxWidth: 720, alignContent: 'start' },
  state: { padding: 16, display: 'grid', gap: 10, justifyItems: 'start' },
  title: { margin: 0, fontSize: 22 },
  heading: { margin: '0 0 8px', fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 },
  tiles: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  tile: { border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--panel)' },
  tileValue: { fontSize: 22, fontWeight: 700, marginTop: 2 },
  note: { margin: 0, padding: 10, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 },
  owes: {
    display: 'block', padding: 12, borderRadius: 10, textDecoration: 'none',
    border: '1px solid var(--line)', color: 'var(--warn)', fontWeight: 600
  },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  creditRow: {
    display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0',
    borderBottom: '1px solid var(--line)', fontSize: 14
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 60, padding: '8px 0', borderBottom: '1px solid var(--line)',
    textDecoration: 'none', color: 'var(--ink)'
  },
  main: { minWidth: 0 },
  right: { textAlign: 'right', whiteSpace: 'nowrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, textDecoration: 'none' },
  bad: { color: 'var(--bad)', margin: 0 }
}
