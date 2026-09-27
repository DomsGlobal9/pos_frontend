import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { loadBills, rupees, messageFor } from '../lib/api.js'

/**
 * WF-SALES-01. POS-SALE-001..006.
 *
 * Finding a sale that has already been made -- which is what a shop does all day. Someone comes
 * back with a creased receipt, or without one and only a phone number, and the person behind the
 * counter has a queue.
 *
 * ONE SEARCH BOX, not three. A shopkeeper should not have to know whether what they are holding is
 * an invoice number or a phone number before they can type it; the server tries both. That is the
 * small version of the universal-search idea, scoped to bills.
 *
 * The filters underneath are for the other job this screen does: the owner reconciling the card
 * machine at closing, who wants card bills for today and nothing else.
 */
export default function Bills() {
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('')
  const [when, setWhen] = useState('')
  const [pages, setPages] = useState([undefined])

  const params = { q: q.trim(), method, ...dateRange(when) }

  const { data, isLoading, isError, error, isFetching } = useQuery({
    // The cursor is part of the key so each page caches separately.
    queryKey: ['bills', params, pages[pages.length - 1]],
    queryFn: () => loadBills({ ...params, after: pages[pages.length - 1] }),
    // Keeps the previous page on screen while the next one loads, so the list does not blink
    // empty under someone who is reading it.
    placeholderData: keepPreviousData
  })

  /** Any filter change starts the paging over -- page 3 of the old filter is meaningless. */
  const reset = (fn) => (value) => { fn(value); setPages([undefined]) }

  const bills = data?.bills ?? []

  return (
    <div style={s.page}>
      <h1 style={s.title}>Bills</h1>

      <input
        value={q}
        onChange={e => reset(setQ)(e.target.value)}
        placeholder="Invoice number, phone or name"
        aria-label="Find a bill"
      />

      <div style={s.filters}>
        <select value={when} onChange={e => reset(setWhen)(e.target.value)} aria-label="When">
          <option value="">Any date</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
        <select value={method} onChange={e => reset(setMethod)(e.target.value)} aria-label="Paid by">
          <option value="">Any payment</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
        </select>
      </div>

      {isError && <p style={s.bad}>{messageFor(error)}</p>}
      {isLoading && <p style={s.muted}>Looking…</p>}

      {!isLoading && bills.length === 0 && (
        <p style={s.muted}>
          {q || method || when
            ? 'No bills match that. Try a shorter search, or clear the filters.'
            : 'No bills yet. They appear here as soon as you sell something.'}
        </p>
      )}

      <ul style={s.list}>
        {bills.map(bill => (
          <li key={bill.id}>
            <Link to={`/bills/${bill.id}`} style={s.row}>
              <div style={s.rowMain}>
                <div>
                  <b>{rupees(bill.totalPaise)}</b>
                  <span style={s.muted}>
                    {' · '}{bill.itemCount} {bill.itemCount === 1 ? 'item' : 'items'}
                    {bill.customerName ? ` · ${bill.customerName}` : ''}
                  </span>
                </div>
                <div style={s.muted}>
                  {bill.invoiceNo}
                  {bill.methods.length > 0 && ` · ${bill.methods.map(pretty).join(' + ')}`}
                  {bill.printCount > 1 && ` · ${bill.printCount} copies printed`}
                </div>
              </div>
              <div style={s.when}>{stamp(bill.createdAt)}</div>
            </Link>
          </li>
        ))}
      </ul>

      {data?.nextCursor && (
        <button
          onClick={() => setPages(p => [...p, data.nextCursor])}
          disabled={isFetching}
        >
          {isFetching ? 'Loading…' : 'Show older'}
        </button>
      )}

      {pages.length > 1 && (
        <button onClick={() => setPages([undefined])}>Back to newest</button>
      )}
    </div>
  )
}

const pretty = (m) => ({ CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit', POINTS: 'Points', BALANCE: 'Balance' }[m] ?? m)

function dateRange(when) {
  if (!when) return {}
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = when === 'today' ? 0 : when === 'week' ? 6 : 29
  const from = new Date(midnight.getTime() - days * 86_400_000)
  return { from: from.toISOString() }
}

function stamp(at) {
  const d = new Date(at)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const s = {
  page: { padding: 16, display: 'grid', gap: 12, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    // Comfortably tappable on a phone, which is where a shop owner checks a bill from the shop floor.
    minHeight: 60, padding: '8px 0', borderBottom: '1px solid var(--line)',
    textDecoration: 'none', color: 'var(--ink)'
  },
  rowMain: { minWidth: 0 },
  when: { color: 'var(--ink-soft)', fontSize: 12, whiteSpace: 'nowrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  bad: { color: 'var(--bad)', margin: 0 }
}
