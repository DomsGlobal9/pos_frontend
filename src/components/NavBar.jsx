import { NavLink } from 'react-router-dom'
import { Home, ScanBarcode, ClipboardList, Users, LayoutGrid } from 'lucide-react'
import { isTouchFirst } from '../lib/useMedia.js'

/**
 * The five primary destinations. MASTER.md §16.2 fixes them at five; a sixth needs product
 * approval recorded in the changelog.
 *
 * Bottom bar on phone and tablet, side bar on a computer. Same destinations, same order, so muscle
 * memory carries between a shop's counter machine and the owner's phone.
 *
 * REDONE 17 Nov (owner: "redesign the nav bar"). On a computer, a side bar with the words beside the
 * icons once the screen is wide enough (a narrow rail below 1200 px); on a phone, a floating bar lifted
 * off the edge. Where you are is a deep green tile; Sell -- the one thing a till is for -- always
 * carries the lime, so it is found without reading. The look lives in index.css (.nav-*).
 *
 * THE FOCUS RULE. A barcode scanner is a keyboard and types into whatever holds focus, so nothing
 * here may take focus from the Sell search box on mouse-over or on render. The links are reachable
 * by Tab deliberately -- a keyboard user needs them -- but nothing calls focus() and nothing
 * autofocuses. A scan that lands in a nav link is a scan the cashier does not notice losing.
 */
const TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/sell', label: 'Sell', Icon: ScanBarcode, sell: true },
  { to: '/orders', label: 'Orders', Icon: ClipboardList },
  { to: '/customers', label: 'Customers', Icon: Users },
  { to: '/more', label: 'More', Icon: LayoutGrid }
]

export default function NavBar({ device }) {
  const bottom = isTouchFirst(device)
  return (
    <nav className={bottom ? 'nav-bottom' : 'nav-rail'} aria-label="Main">
      {!bottom && (
        <div className="nav-brand" aria-hidden="true">
          <img src="/scaleezy-mark.svg" alt="" width="30" height="30" />
          <span className="nav-brand-text"><b>ScaleEzy</b><span>POS</span></span>
        </div>
      )}
      <div className="nav-items">
        {TABS.map(({ to, label, Icon, end, sell }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${sell ? ' nav-sell' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon">
                  <Icon size={bottom ? 20 : 19} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                </span>
                <span className="nav-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
