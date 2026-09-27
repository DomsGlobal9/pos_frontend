import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { homeSummary, rupees } from '../lib/api.js'

/**
 * WF-HOME-01. POS-HOME-001, -002, -003, -006, -007.
 *
 * What matters now, and one obvious thing to do. Not a dashboard -- MASTER.md §10 says explicitly
 * not to turn this into a BI surface, and the Class 7 rule means a first-time user should know
 * what to press without being told.
 *
 * The server says which sections it can answer and this renders only those, because "0 orders
 * waiting" and "there is no orders feature yet" look identical on a screen and mean opposite
 * things. Orders arrived in Phase 5 and shift status (POS-HOME-005) in Phase 7.
 */
export default function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home'],
    queryFn: homeSummary,
    refetchInterval: 60_000
  })

  return (
    <div style={s.page}>
      <h1 style={s.greeting}>
        Good {data?.greeting ?? 'day'}
      </h1>

      {isError && (
        <p style={s.warn}>
          Today's figures aren't available right now. Selling still works.
        </p>
      )}

      <section style={s.tiles}>
        <div style={s.tile}>
          <div style={s.tileLabel}>Sold today</div>
          <div style={s.tileValue}>
            {isLoading ? '—' : rupees(data?.today.salesPaise ?? 0)}
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>Bills</div>
          <div style={s.tileValue}>
            {isLoading ? '—' : (data?.today.billCount ?? 0)}
          </div>
        </div>
      </section>

      {/* POS-HOME-005, POS-SHIFT-009. Which drawers are open -- and loudly, one left open overnight. */}
      {data?.shifts && (
        <Link to="/shift" style={s.shift}>
          {data.shifts.overnight > 0 && (
            <div style={s.late}>
              {data.shifts.overnight === 1 ? 'A shift has' : `${data.shifts.overnight} shifts have`} been open since yesterday. Close it first.
            </div>
          )}
          {data.shifts.open.length === 0
            ? <div>No shift open. Open one before taking cash →</div>
            : data.shifts.open.filter(sh => !sh.openSinceYesterday).map(sh => (
              <div key={sh.id}>
                {sh.counterName} open since {new Date(sh.openedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                {sh.openedBy ? ` · ${sh.openedBy}` : ''}
              </div>
            ))}
        </Link>
      )}

      {/* Only on a day with returns. Said separately from sales, never netted off silently. */}
      {data?.today.returnCount > 0 && (
        <p style={s.returns}>
          Returns today: {rupees(data.today.returnsPaise)} ({data.today.returnCount})
        </p>
      )}

      {/*
        * POS-HOME-004. Three different reasons to look at Orders, said separately, because "5
        * orders need attention" tells a shop owner nothing about what to DO: phone the ready ones,
        * chase the late ones, collect what is owed. Only the lines with something in them show.
        */}
      {data?.orders && (data.orders.readyToCollect + data.orders.overdue + data.orders.dueCount) > 0 && (
        <Link to="/orders" style={s.attention}>
          {data.orders.readyToCollect > 0 && (
            <div>{data.orders.readyToCollect} ready to collect</div>
          )}
          {data.orders.overdue > 0 && (
            <div style={s.late}>{data.orders.overdue} past their collection date</div>
          )}
          {data.orders.dueCount > 0 && (
            <div>{data.orders.dueCount} {data.orders.dueCount === 1 ? 'customer owes' : 'orders owe'} {rupees(data.orders.duePaise)}</div>
          )}
        </Link>
      )}

      {/* The one primary action. Sticky at the bottom on a phone is handled by the shell's
          scrolling content area; here it simply comes first in reading order after the figures. */}
      <Link to="/sell" style={s.primary}>
        New sale
      </Link>

      <section>
        <h2 style={s.heading}>Recent</h2>
        {isLoading && <p style={s.muted}>Loading…</p>}
        {!isLoading && (data?.activity?.length ?? 0) === 0 && (
          <p style={s.muted}>Nothing sold yet. Press New sale to start.</p>
        )}
        <ul style={s.feed}>
          {(data?.activity ?? []).map(row => (
            <li key={row.id}>
              {/* Every activity row is a destination, not decoration. WF-SALE-02. */}
              <Link to={row.kind === 'RETURN' ? `/returns/${row.id}` : `/bills/${row.id}`} style={s.row}>
                <div>
                <div>
                  {row.kind === 'RETURN' && <span style={s.returnTag}>Return </span>}
                  <b>{row.kind === 'RETURN' ? `−${rupees(row.totalPaise)}` : rupees(row.totalPaise)}</b>
                  <span style={s.muted}>
                    {' · '}{row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
                    {row.customerName ? ` · ${row.customerName}` : ''}
                  </span>
                </div>
                  <div style={s.muted}>{row.invoiceNo}</div>
                </div>
                <span style={s.muted}>{time(row.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function time(at) {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const s = {
  page: { padding: 16, display: 'grid', gap: 16, maxWidth: 720 },
  greeting: { margin: 0, fontSize: 22 },
  warn: { margin: 0, color: 'var(--warn)', fontSize: 14 },
  tiles: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  tile: { border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--panel)' },
  tileLabel: { fontSize: 12, color: 'var(--ink-soft)' },
  tileValue: { fontSize: 26, fontWeight: 700, marginTop: 2 },
  primary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, borderRadius: 12, textDecoration: 'none',
    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 17
  },
  heading: { margin: '0 0 8px', fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 },
  attention: {
    display: 'grid', gap: 4, padding: 14, borderRadius: 12, textDecoration: 'none',
    color: 'var(--ink)', border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 14
  },
  late: { color: 'var(--bad)' },
  returns: { margin: 0, color: 'var(--ink-soft)', fontSize: 14 },
  shift: {
    display: 'grid', gap: 4, padding: 12, borderRadius: 12, textDecoration: 'none',
    color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 14
  },
  returnTag: { color: 'var(--warn)', fontWeight: 600 },
  feed: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    minHeight: 56, padding: '10px 0', borderBottom: '1px solid var(--line)',
    textDecoration: 'none', color: 'var(--ink)'
  },
  muted: { color: 'var(--ink-soft)', fontSize: 12 }
}
