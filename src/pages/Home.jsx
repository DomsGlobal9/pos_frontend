import { Link, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ScanBarcode, Receipt, Undo2, Wallet, ClipboardList, ChevronRight, Search } from 'lucide-react'
import { homeSummary, rupees } from '../lib/api.js'
import { isTouchFirst } from '../lib/useMedia.js'

/**
 * WF-HOME-01. POS-HOME-001..007.
 *
 * What matters now, and one obvious thing to do. Not a dashboard -- MASTER.md §10 says explicitly
 * not to turn this into a BI surface, and the Class 7 rule means a first-time user should know
 * what to press without being told. So: today's takings, one big "New sale", and only the things
 * that need someone -- a drawer, an order, a return.
 *
 * The server says which sections it can answer and this renders only those, because "0 orders
 * waiting" and "there is no orders feature yet" look identical on a screen and mean opposite
 * things.
 *
 * On a wide screen the activity sits beside the rest instead of below it, so a counter PC shows the
 * whole picture without scrolling.
 */
export default function Home() {
  const { device } = useOutletContext() ?? {}
  const wide = device && !isTouchFirst(device)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home'],
    queryFn: homeSummary,
    refetchInterval: 60_000
  })

  const orders = data?.orders
  const ordersNeedLook = orders && (orders.readyToCollect + orders.overdue + orders.dueCount) > 0

  const main = (
    <div style={s.column}>
      {/* The day, in one card. */}
      <section style={s.hero}>
        <div style={s.heroLabel}>Sold today</div>
        <div style={s.heroValue}>{isLoading ? '—' : rupees(data?.today.salesPaise ?? 0)}</div>
        <div style={s.heroRow}>
          <span>{isLoading ? '—' : data?.today.billCount ?? 0} bills</span>
          {data?.today.returnCount > 0 && (
            <>
              <span style={s.heroDot} aria-hidden="true" />
              {/* Said separately from sales, never netted off silently. */}
              <span>Returns today: {rupees(data.today.returnsPaise)} ({data.today.returnCount})</span>
            </>
          )}
        </div>
      </section>

      {isError && <p style={s.warn}>Today's figures aren't available right now. Selling still works.</p>}

      {/* The one primary action. */}
      <Link to="/sell" style={s.primary}>
        <ScanBarcode size={22} aria-hidden="true" />
        New sale
      </Link>

      <div style={s.quick}>
        <Quick to="/bills" Icon={Search} label="Find a bill" />
        <Quick to="/orders" Icon={ClipboardList} label="Orders" />
        <Quick to="/shift" Icon={Wallet} label="Drawer" />
      </div>

      {/* POS-HOME-005, POS-SHIFT-009. Which drawers are open -- loudly, one left open overnight. */}
      {data?.shifts && (
        <Link to="/shift" style={s.card}>
          <span style={{ ...s.cardIcon, ...(data.shifts.open.length === 0 || data.shifts.overnight ? s.iconWarn : s.iconGood) }}>
            <Wallet size={18} aria-hidden="true" />
          </span>
          <div style={s.cardBody}>
            <div style={s.cardTitle}>Drawer</div>
            {data.shifts.overnight > 0 && (
              <div style={s.late}>
                {data.shifts.overnight === 1 ? 'A shift has' : `${data.shifts.overnight} shifts have`} been open since yesterday. Close it first.
              </div>
            )}
            {data.shifts.open.length === 0
              ? <div style={s.cardText}>No shift open. Open one before taking cash →</div>
              : data.shifts.open.filter(sh => !sh.openSinceYesterday).map(sh => (
                <div key={sh.id} style={s.cardText}>
                  {sh.counterName} open since {new Date(sh.openedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  {sh.openedBy ? ` · ${sh.openedBy}` : ''}
                </div>
              ))}
          </div>
          <ChevronRight size={18} style={s.chev} aria-hidden="true" />
        </Link>
      )}

      {/*
        * POS-HOME-004. Three different reasons to look at Orders, said separately, because "5
        * orders need attention" tells a shop owner nothing about what to DO: phone the ready ones,
        * chase the late ones, collect what is owed.
        */}
      {ordersNeedLook && (
        <Link to="/orders" style={s.card}>
          <span style={{ ...s.cardIcon, ...s.iconBrand }}><ClipboardList size={18} aria-hidden="true" /></span>
          <div style={s.cardBody}>
            <div style={s.cardTitle}>Orders</div>
            <div style={s.chips}>
              {orders.readyToCollect > 0 && <span className="chip good">{orders.readyToCollect} ready to collect</span>}
              {orders.overdue > 0 && <span className="chip bad">{orders.overdue} past their collection date</span>}
              {orders.dueCount > 0 && (
                <span className="chip warn">
                  {orders.dueCount} {orders.dueCount === 1 ? 'customer owes' : 'orders owe'} {rupees(orders.duePaise)}
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={18} style={s.chev} aria-hidden="true" />
        </Link>
      )}
    </div>
  )

  const recent = (
    <section style={s.column}>
      <div style={s.sectionHead}>
        <h2 style={s.heading}>Recent</h2>
        <Link to="/bills" style={s.link}>All bills</Link>
      </div>
      {isLoading && <p style={s.muted}>Loading…</p>}
      {!isLoading && (data?.activity?.length ?? 0) === 0 && (
        <p style={s.empty}>Nothing sold yet. Press New sale to start.</p>
      )}
      <ul style={s.feed} className="card-list">
        {(data?.activity ?? []).map(row => {
          const isReturn = row.kind === 'RETURN'
          return (
            <li key={row.id}>
              {/* Every activity row is a destination, not decoration. WF-SALE-02. */}
              <Link to={isReturn ? `/returns/${row.id}` : `/bills/${row.id}`} style={s.row}>
                <span style={{ ...s.rowIcon, ...(isReturn ? s.iconWarn : s.iconBrand) }}>
                  {isReturn ? <Undo2 size={17} aria-hidden="true" /> : <Receipt size={17} aria-hidden="true" />}
                </span>
                <div style={s.rowMain}>
                  <div style={s.rowTitle}>
                    {isReturn ? 'Return' : (row.customerName || 'Sale')}
                    {isReturn && row.customerName ? ` · ${row.customerName}` : ''}
                  </div>
                  <div style={s.muted}>
                    {row.invoiceNo} · {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
                  </div>
                </div>
                <div style={s.rowRight}>
                  <b style={isReturn ? s.minus : undefined}>{isReturn ? `−${rupees(row.totalPaise)}` : rupees(row.totalPaise)}</b>
                  <div style={s.muted}>{time(row.at)}</div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <div style={s.page}>
      <header style={s.head}>
        <h1 style={s.greeting}>Good {data?.greeting ?? 'day'}</h1>
        <div style={s.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </header>
      <div style={wide ? s.twoCol : s.oneCol}>
        {main}
        {recent}
      </div>
    </div>
  )
}

const Quick = ({ to, Icon, label }) => (
  <Link to={to} style={s.quickItem}>
    <span style={s.quickIcon}><Icon size={18} aria-hidden="true" /></span>
    {label}
  </Link>
)

function time(at) {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 18, maxWidth: 1120, alignContent: 'start' },
  head: { display: 'grid', gap: 2 },
  greeting: { margin: 0 },
  date: { color: 'var(--ink-soft)', fontSize: 14 },
  oneCol: { display: 'grid', gap: 22 },
  twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' },
  column: { display: 'grid', gap: 14, alignContent: 'start' },

  hero: {
    padding: '20px 22px', borderRadius: 18, color: '#fff',
    background: 'linear-gradient(135deg, #164b1e 0%, #1f6428 100%)',
    boxShadow: '0 12px 30px -16px rgba(22, 75, 30, 0.55)'
  },
  heroLabel: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' },
  heroValue: { fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4, lineHeight: 1.1 },
  heroRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  heroDot: { width: 4, height: 4, borderRadius: 9, background: 'var(--brand)' },

  primary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 60, borderRadius: 16, textDecoration: 'none',
    background: 'var(--brand)', color: 'var(--brand-deep)', fontWeight: 800, fontSize: 18,
    boxShadow: '0 1px 2px rgba(22,75,30,0.15), 0 10px 24px -12px rgba(110,150,20,0.8)'
  },

  quick: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  quickItem: {
    display: 'grid', justifyItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 14,
    background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)',
    textDecoration: 'none', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textAlign: 'center'
  },
  quickIcon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)' },

  card: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--radius)',
    background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)',
    textDecoration: 'none', color: 'var(--ink)'
  },
  cardIcon: { flex: 'none', display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 12 },
  cardBody: { flex: 1, minWidth: 0, display: 'grid', gap: 4 },
  cardTitle: { fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardText: { fontSize: 14 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chev: { flex: 'none', color: 'var(--ink-soft)' },
  iconGood: { background: 'var(--good-tint)', color: 'var(--good)' },
  iconWarn: { background: 'var(--warn-tint)', color: 'var(--warn)' },
  iconBrand: { background: 'var(--brand-tint)', color: 'var(--brand-deep)' },
  late: { color: 'var(--bad)', fontSize: 14, fontWeight: 600 },
  warn: { margin: 0, color: 'var(--warn)', fontSize: 14 },

  sectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  heading: { margin: 0, fontSize: 16, fontWeight: 700 },
  link: { fontSize: 13, fontWeight: 600, textDecoration: 'none' },
  empty: { margin: 0, padding: 20, textAlign: 'center', color: 'var(--ink-soft)', background: 'var(--panel)', borderRadius: 'var(--radius)', border: '1px dashed var(--line-strong)' },
  feed: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 0',
    borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)'
  },
  rowIcon: { flex: 'none', display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 11 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowRight: { textAlign: 'right', whiteSpace: 'nowrap' },
  minus: { color: 'var(--warn)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12.5 }
}
