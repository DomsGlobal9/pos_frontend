import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppShell from './AppShell.jsx'
import Home from './pages/Home.jsx'
import Till from './pages/Till.jsx'
import Placeholder from './pages/Placeholder.jsx'
import More from './pages/More.jsx'
import Bills from './pages/Bills.jsx'
import BillDetail from './pages/BillDetail.jsx'
import PaymentChecks from './pages/PaymentChecks.jsx'
import { Customers, CustomerDetail } from './pages/Customers.jsx'
import Audit from './pages/Audit.jsx'
import { Orders, OrderDetail } from './pages/Orders.jsx'
import ReturnFlow from './pages/ReturnFlow.jsx'
import CreditNote from './pages/CreditNote.jsx'
import Shift from './pages/Shift.jsx'
import DayClose from './pages/DayClose.jsx'
import InventoryLink from './pages/InventoryLink.jsx'
import Reports from './pages/Reports.jsx'
import PublicReceipt from './pages/PublicReceipt.jsx'
import Settings from './pages/Settings.jsx'
import Devices from './pages/Devices.jsx'
import Sync from './pages/Sync.jsx'
import Connections from './pages/Connections.jsx'
import Staff from './pages/Staff.jsx'

/**
 * Routes. Every path here is a screen registered in docs/product/FLOWS.md.
 *
 * The narrow-screen notice that used to live in this file is GONE -- CHG-001 retires the rule that
 * hid selling below 768 px. Phone, tablet and desktop are all first-class now, and the shell
 * adapts rather than refusing.
 */
const router = createBrowserRouter([
  // The customer's digital receipt, outside the till: no navigation, no sign-in. POS-RCPT-009.
  { path: '/r/:token', element: <PublicReceipt /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'sell', element: <Till /> },
      // WF-ORDERS-01 and WF-ORDER-02.
      { path: 'orders', element: <Orders /> },
      { path: 'orders/:id', element: <OrderDetail /> },
      // WF-CUSTOMERS-01 and WF-CUSTOMER-02.
      { path: 'customers', element: <Customers /> },
      { path: 'customers/:id', element: <CustomerDetail /> },
      // POS-CORE-010. Owner and managers.
      { path: 'activity', element: <Audit /> },
      { path: 'more', element: <More /> },
      // WF-SALES-01 and WF-SALE-02. Reached from More, and from a Home activity row.
      { path: 'bills', element: <Bills /> },
      { path: 'bills/:id', element: <BillDetail /> },
      // WF-RETURN-01 and WF-EXCHANGE-01, started from a bill. POS-SALE-010, -011.
      { path: 'bills/:id/return', element: <ReturnFlow mode="RETURN" /> },
      { path: 'bills/:id/exchange', element: <ReturnFlow mode="EXCHANGE" /> },
      // The credit note, as it prints. POS-RET-006.
      { path: 'returns/:id', element: <CreditNote /> },
      // WF-SHIFT-01 (with WF-CASH-01 as its sheet) and WF-DAY-01.
      { path: 'shift', element: <Shift /> },
      { path: 'day-close', element: <DayClose /> },
      // The owner's Inventory link. POS-INV-009, POS-SYNC-006.
      { path: 'inventory-link', element: <InventoryLink /> },
      // WF-REPORTS-01. POS-RPT-001..011.
      { path: 'reports', element: <Reports /> },
      // POS-PAY-012 (UPI ID), and WF-DEVICES-01. POS-DEV-001..004.
      { path: 'settings', element: <Settings /> },
      { path: 'devices', element: <Devices /> },
      // WF-SYNC-01. POS-SYNC-003, -004.
      { path: 'sync', element: <Sync /> },
      // WF-INTEGRATIONS-01. POS-API-001, POS-WEB-001..006, POS-EXP-001/002.
      { path: 'connections', element: <Connections /> },
      // Who works the till. POS-CORE-002, POS-SET-008.
      { path: 'staff', element: <Staff /> },
      // WF-PAY-02.
      { path: 'payment-checks', element: <PaymentChecks /> },
      {
        path: '*',
        element: (
          <Placeholder
            title="Not found"
            does="That page does not exist. The till may be running an older version than the server."
            arriving="Refreshing usually fixes it."
          />
        )
      }
    ]
  }
])

export default function App() {
  return <RouterProvider router={router} />
}
