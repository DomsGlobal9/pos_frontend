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
 * TWO APPROVED TILES ARE ABSENT ON PURPOSE. POS-HOME-004 (orders needing attention) and
 * POS-HOME-005 (shift status) are P0 but their data arrives in Phases 5 and 7. The server says
 * which sections it can answer and this renders only those, because "0 orders waiting" and "there
 * is no orders feature yet" look identical on a screen and mean opposite things. Both are recorded
 * BLOCKED in FEATURES.md, not dropped.
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
              <Link to={`/bills/${row.id}`} style={s.row}>
                <div>
                <div>
                  <b>{rupees(row.totalPaise)}</b>
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
  feed: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    minHeight: 56, padding: '10px 0', borderBottom: '1px solid var(--line)',
    textDecoration: 'none', color: 'var(--ink)'
  },
  muted: { color: 'var(--ink-soft)', fontSize: 12 }
}
