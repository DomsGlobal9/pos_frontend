import { Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { tillToken, tillClosed, personOut } from '../lib/session.js'
import { closeThisTill } from '../lib/api.js'
import { Users, Receipt, ShieldCheck, History, Wallet, CalendarCheck, Boxes, BarChart3, RefreshCw, Settings, Plug, ChevronRight, Monitor, LogOut, Power } from 'lucide-react'
import { askYesNo } from '../components/Ask.jsx'

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
  { to: '/bills', label: 'Bills', hint: 'Find a sale, open it, print it again', live: true, Icon: Receipt },
  { to: '/payment-checks', label: 'Payments to check', hint: 'UPI and card not yet confirmed, cheques and bank transfers', live: true, Icon: ShieldCheck },
  { to: '/activity', label: 'Activity', hint: 'Discounts, price changes, approvals', live: true, Icon: History },
  { to: '/shift', label: 'Shift and drawer', hint: 'Open, cash in and out, close', live: true, Icon: Wallet },
  { to: '/day-close', label: 'Close the day', hint: 'Sales, payments, cash and what is still open', live: true, Icon: CalendarCheck },
  { to: '/inventory-link', label: 'Inventory link', hint: 'Items from Inventory, and stock kept in step', live: true, Icon: Boxes },
  { to: '/reports', label: 'Reports', hint: 'Sales, payments, GST, cash and dues', live: true, Icon: BarChart3 },
  { to: '/sync', label: 'Waiting to sync', hint: 'Sales kept on this till while the internet was down', live: true, Icon: RefreshCw },
  { to: '/settings', label: 'Settings', hint: 'UPI QR, Inventory link, devices', live: true, Icon: Settings },
  { to: '/devices', label: 'Devices', hint: 'Every screen the till runs on', live: true, Icon: Monitor },
  { to: '/items', label: 'Items', hint: 'What this till sells, their prices and GST', live: true, Icon: Boxes },
  { to: '/staff', label: 'Staff', hint: 'Who works the till, their PINs and roles', live: true, Icon: Users },
  { to: '/connections', label: 'Connections', hint: 'Your other software, Excel import, sales for the accountant', live: true, Icon: Plug }
]

export default function More() {
  const { shop } = useOutletContext() ?? {}

  return (
    <div style={s.page}>
      <h1 style={s.title}>More</h1>

      {/* SIGN OUT (25 Nov, owner: "there is no sign-out button"): both ways, said plainly, at the TOP of More (it sat under 13 rows). */}
      {shop?.shop && (
        <section style={s.shop} aria-label="Sign out">
          <div style={s.muted}>Signed in to</div>
          <div><b>{shop.shop.shopName}</b>{shop.cashier?.name ? <> · {shop.cashier.name}</> : null}</div>
          {shop.shop.gstin && <div style={s.muted}>GSTIN {shop.shop.gstin}</div>}
          {tillToken() && (
            <div style={s.signOut}>
              <button type="button" style={s.signOutBtn} onClick={() => personOut()}>
                <LogOut size={17} aria-hidden="true" /> Sign out{shop.cashier?.name ? ` ${shop.cashier.name}` : ''}
              </button>
              <span style={s.muted}>The till stays open; the next person picks their name and enters their PIN.</span>
              <button type="button" className="btn-quiet danger" style={s.signOutBtn} onClick={async () => {
                if (!await askYesNo('Close the till on this device?', { note: 'Everyone is signed out here. An owner or manager will need their password to open it again.', confirmLabel: 'Close the till', danger: true })) return
                try { await closeThisTill() } catch { /* closing here is what matters */ }
                tillClosed()
              }}>
                <Power size={17} aria-hidden="true" /> Close the till on this device
              </button>
              <span style={s.muted}>For the end of the day, or a device you are leaving: it needs the owner's or a manager's password again.</span>
            </div>
          )}
        </section>
      )}


      <ul style={s.list} className="card-list">
        {ROWS.map(row => (
          <li key={row.to}>
            {/* Live rows navigate. The rest are disabled WITH A VISIBLE REASON -- which the link
                integrity rule allows, and a dead button does not. */}
            {row.live ? (
              <Link to={row.to} style={{ ...s.row, ...s.rowLive }}>
                <span style={s.icon}><row.Icon size={18} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.label}>{row.label}</div>
                  <div style={s.muted}>{row.hint}</div>
                </div>
                <ChevronRight size={18} aria-hidden="true" style={{ color: 'var(--ink-soft)' }} />
              </Link>
            ) : (
              <div style={s.row} aria-disabled="true">
                <span style={s.icon}><row.Icon size={18} aria-hidden="true" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.label}>{row.label}</div>
                  <div style={s.muted}>{row.hint}</div>
                </div>
                <span style={s.badge}>{row.phase}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Link to="/sell" style={s.action}>Go to Sell</Link>
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 16, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  icon: { flex: 'none', display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)' },
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
  shop: { border: '1px solid var(--line)', borderRadius: 14, padding: 16, background: 'var(--panel)', boxShadow: 'var(--shadow)', display: 'grid', gap: 4 },
  signOut: { display: 'grid', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', justifyItems: 'start' },
  signOutBtn: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  action: {
    justifySelf: 'start', display: 'inline-flex', alignItems: 'center', minHeight: 48,
    padding: '0 18px', borderRadius: 10, textDecoration: 'none',
    border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600
  },
}
