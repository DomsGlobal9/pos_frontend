import { NavLink } from 'react-router-dom'
import { Home, ScanBarcode, ClipboardList, Users, MoreHorizontal } from 'lucide-react'
import { isTouchFirst } from '../lib/useMedia.js'

/**
 * The five primary destinations. MASTER.md §16.2 fixes them at five; a sixth needs product
 * approval recorded in the changelog.
 *
 * Bottom bar on phone and tablet, left rail on desktop. Same destinations, same order, so muscle
 * memory carries between a shop's counter machine and the owner's phone.
 *
 * THE FOCUS RULE. A barcode scanner is a keyboard and types into whatever holds focus, so nothing
 * here may take focus from the Sell search box on mouse-over or on render. The links are reachable
 * by Tab deliberately -- a keyboard user needs them -- but nothing calls focus() and nothing
 * autofocuses. A scan that lands in a nav link is a scan the cashier does not notice losing.
 */
const TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/sell', label: 'Sell', Icon: ScanBarcode },
  { to: '/orders', label: 'Orders', Icon: ClipboardList },
  { to: '/customers', label: 'Customers', Icon: Users },
  { to: '/more', label: 'More', Icon: MoreHorizontal }
]

export default function NavBar({ device }) {
  const bottom = isTouchFirst(device)
  return (
    <nav
      style={bottom ? s.bottom : s.rail}
      aria-label="Main"
    >
      {!bottom && (
        <div style={s.logo} aria-hidden="true">
          <img src="/scaleezy-mark.svg" alt="" width="30" height="30" />
          <span style={s.logoText}>POS</span>
        </div>
      )}
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({
            ...(bottom ? s.tabBottom : s.tabRail),
            ...(isActive ? (bottom ? s.activeBottom : s.activeRail) : null)
          })}
        >
          {({ isActive }) => (
            <>
              <span style={{ ...s.iconWrap, ...(isActive && bottom ? s.iconActive : null) }}>
                <Icon size={bottom ? 21 : 20} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
              </span>
              <span style={bottom ? s.labelBottom : s.labelRail}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const s = {
  bottom: {
    display: 'flex',
    borderTop: '1px solid var(--line)',
    background: 'var(--panel)',
    boxShadow: '0 -4px 16px -10px rgba(20, 30, 16, 0.15)',
    // Clear of the home indicator on a phone, so the last tab is not half under it.
    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
  },
  rail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: 96,
    padding: '14px 10px',
    borderRight: '1px solid var(--line)',
    background: 'var(--panel)'
  },
  logo: { display: 'grid', justifyItems: 'center', gap: 2, padding: '4px 0 14px', marginBottom: 6, borderBottom: '1px solid var(--line)' },
  logoText: { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--brand-deep)' },
  iconWrap: { display: 'grid', placeItems: 'center', width: 44, height: 28, borderRadius: 999 },
  iconActive: { background: 'var(--brand-tint-strong)' },
  tabBottom: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    // Comfortably above the 48px minimum: this is the most-tapped furniture in the product.
    minHeight: 56,
    textDecoration: 'none',
    color: 'var(--ink-soft)'
  },
  tabRail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 64,
    borderRadius: 14,
    textDecoration: 'none',
    color: 'var(--ink-soft)'
  },
  activeRail: { color: 'var(--brand-deep)', fontWeight: 700, background: 'var(--brand-tint)' },
  activeBottom: { color: 'var(--brand-deep)', fontWeight: 700 },
  labelBottom: { fontSize: 11 },
  labelRail: { fontSize: 11.5 }
}
