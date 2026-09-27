import { Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'

/**
 * WF-MORE-01.
 *
 * Everything a cashier does not need while selling. MASTER.md §21 lists what must stay out of the
 * main experience -- reports menus, integration settings, audit logs, technical statuses -- and
 * this is where the ones that do belong to the POS live, behind one tap.
 *
 * Each row is a registered destination. Rows whose phase has not arrived are DISABLED WITH A
 * VISIBLE REASON rather than hidden or dead, which is what the link-integrity rule allows.
 */
const ROWS = [
  { to: '/bills', label: 'Bills', hint: 'Find a sale, open it, print it again', live: true },
  { to: '/payment-checks', label: 'Payments to check', hint: 'UPI and card taken without confirmation', live: true },
  { to: '/activity', label: 'Activity', hint: 'Discounts, price changes, approvals', live: true },
  { to: '/shift', label: 'Shift and drawer', hint: 'Open, cash in and out, close', live: true },
  { to: '/day-close', label: 'Close the day', hint: 'Sales, payments, cash and what is still open', live: true },
  { to: '/reports', label: 'Reports', hint: 'Today, payment methods, day close', phase: 'Phase 9' },
  { to: '/sync', label: 'Waiting to sync', hint: 'Anything not yet saved to the server', phase: 'Phase 11' },
  { to: '/settings', label: 'Settings', hint: 'Shop details, billing, discounts', phase: 'Phase 4' },
  { to: '/integrations', label: 'Connections', hint: 'API, webhooks, import and export', phase: 'Phase 12' }
]

export default function More() {
  const { shop } = useOutletContext() ?? {}

  return (
    <div style={s.page}>
      <h1 style={s.title}>More</h1>

      <ul style={s.list}>
        {ROWS.map(row => (
          <li key={row.to}>
            {/* Live rows navigate. The rest are disabled WITH A VISIBLE REASON -- which the link
                integrity rule allows, and a dead button does not. */}
            {row.live ? (
              <Link to={row.to} style={{ ...s.row, ...s.rowLive }}>
                <div>
                  <div style={s.label}>{row.label}</div>
                  <div style={s.muted}>{row.hint}</div>
                </div>
                <span aria-hidden="true" style={s.muted}>›</span>
              </Link>
            ) : (
              <div style={s.row} aria-disabled="true">
                <div>
                  <div style={s.label}>{row.label}</div>
                  <div style={s.muted}>{row.hint}</div>
                </div>
                <span style={s.badge}>{row.phase}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {shop?.shop && (
        <section style={s.shop}>
          <div style={s.muted}>Signed in to</div>
          <div><b>{shop.shop.shopName}</b></div>
          {shop.shop.gstin && <div style={s.muted}>GSTIN {shop.shop.gstin}</div>}
          {shop.cashier?.name && <div style={s.muted}>{shop.cashier.name}</div>}
        </section>
      )}

      <Link to="/sell" style={s.action}>Go to Sell</Link>
    </div>
  )
}

const s = {
  page: { padding: 16, display: 'grid', gap: 16, maxWidth: 640, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 56, padding: '8px 0', borderBottom: '1px solid var(--line)',
    // Not yet reachable, and it says so rather than looking tappable.
    opacity: 0.55
  },
  rowLive: { opacity: 1, textDecoration: 'none', color: 'var(--ink)' },
  label: { fontWeight: 600 },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  badge: {
    fontSize: 11, color: 'var(--ink-soft)', border: '1px solid var(--line)',
    borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap'
  },
  shop: { border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--panel)' },
  action: {
    justifySelf: 'start', display: 'inline-flex', alignItems: 'center', minHeight: 48,
    padding: '0 18px', borderRadius: 10, textDecoration: 'none',
    border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600
  }
}
