import { Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppShell from './AppShell.jsx'
import AskHost from './components/Ask.jsx'
import PageLoading from './components/PageLoading.jsx'
import { lazyPage, warmUp } from './lib/lazyPage.js'
import { ScreenProblem } from './components/ScreenBoundary.jsx'

/*
 * EVERY SCREEN IS ITS OWN FILE (17 Nov), fetched the first time it is opened -- and kept by the
 * service worker, so the till still opens every screen with the internet off.
 */
const load = {
  Home: () => import('./pages/Home.jsx'),
  Till: () => import('./pages/Till.jsx'),
  Placeholder: () => import('./pages/Placeholder.jsx'),
  More: () => import('./pages/More.jsx'),
  Bills: () => import('./pages/Bills.jsx'),
  BillDetail: () => import('./pages/BillDetail.jsx'),
  PaymentChecks: () => import('./pages/PaymentChecks.jsx'),
  Customers: () => import('./pages/Customers.jsx'),
  Audit: () => import('./pages/Audit.jsx'),
  Orders: () => import('./pages/Orders.jsx'),
  ReturnFlow: () => import('./pages/ReturnFlow.jsx'),
  CreditNote: () => import('./pages/CreditNote.jsx'),
  Shift: () => import('./pages/Shift.jsx'),
  DayClose: () => import('./pages/DayClose.jsx'),
  InventoryLink: () => import('./pages/InventoryLink.jsx'),
  Reports: () => import('./pages/Reports.jsx'),
  PublicReceipt: () => import('./pages/PublicReceipt.jsx'),
  Settings: () => import('./pages/Settings.jsx'),
  Devices: () => import('./pages/Devices.jsx'),
  Sync: () => import('./pages/Sync.jsx'),
  Connections: () => import('./pages/Connections.jsx'),
  Staff: () => import('./pages/Staff.jsx'),
  Items: () => import('./pages/Items.jsx'),
  Labels: () => import('./pages/Labels.jsx'),
  ShopSetup: () => import('./pages/ShopSetup.jsx')
}
const Home = lazyPage(load.Home)
const Till = lazyPage(load.Till)
const Placeholder = lazyPage(load.Placeholder)
const More = lazyPage(load.More)
const Bills = lazyPage(load.Bills)
const BillDetail = lazyPage(load.BillDetail)
const PaymentChecks = lazyPage(load.PaymentChecks)
const Customers = lazyPage(load.Customers, 'Customers')
const CustomerDetail = lazyPage(load.Customers, 'CustomerDetail')
const Audit = lazyPage(load.Audit)
const Orders = lazyPage(load.Orders, 'Orders')
const OrderDetail = lazyPage(load.Orders, 'OrderDetail')
const ReturnFlow = lazyPage(load.ReturnFlow)
const CreditNote = lazyPage(load.CreditNote)
const Shift = lazyPage(load.Shift)
const DayClose = lazyPage(load.DayClose)
const InventoryLink = lazyPage(load.InventoryLink)
const Reports = lazyPage(load.Reports)
const PublicReceipt = lazyPage(load.PublicReceipt)
const Settings = lazyPage(load.Settings)
const Devices = lazyPage(load.Devices)
const Sync = lazyPage(load.Sync)
const Connections = lazyPage(load.Connections)
const Staff = lazyPage(load.Staff)
const Items = lazyPage(load.Items)
const Labels = lazyPage(load.Labels)
const ShopSetup = lazyPage(load.ShopSetup)

// The screens a cashier opens first, fetched while the till is idle so the first tap is instant.
// ...then all the rest, so every screen is on the device before the internet can drop (17 Nov).
warmUp([load.Till, load.Home, load.Bills, load.Orders, load.Customers, load.More], Object.values(load))

// The guide loads on its own, only when opened: the till never downloads it otherwise.
const HelpLayout = lazyPage(() => import('./pages/help/HelpLayout.jsx'))
const HelpHome = lazyPage(() => import('./pages/help/HelpHome.jsx'))
const HelpArticle = lazyPage(() => import('./pages/help/HelpArticle.jsx'))
/** A screen outside the till's shell (the guide, the customer's receipt, setup) waits on its own. */
const page = (el) => <Suspense fallback={<PageLoading />}>{el}</Suspense>


/**
 * Routes. Every path here is a screen registered in docs/product/FLOWS.md.
 *
 * The narrow-screen notice that used to live in this file is GONE -- CHG-001 retires the rule that
 * hid selling below 768 px. Phone, tablet and desktop are all first-class now, and the shell
 * adapts rather than refusing.
 */
const router = createBrowserRouter([
  // The customer's digital receipt, outside the till: no navigation, no sign-in. POS-RCPT-009.
  { path: '/r/:token', element: page(<PublicReceipt />), errorElement: <ScreenProblem /> },
  // Setting up a new shop -- ScaleEzy staff, with the setup key. Outside the till: no sign-in.
  { path: '/setup', element: page(<ShopSetup />), errorElement: <ScreenProblem /> },
  // The guide, outside the till: readable when the till is locked or not yet opened. The "?" in the
  // header opens /help?from=<this screen> and the page about that screen opens itself.
  {
    path: '/help',
    element: page(<HelpLayout />), errorElement: <ScreenProblem />,
    children: [
      { index: true, element: page(<HelpHome />) },
      { path: ':section/:slug', element: page(<HelpArticle />) }
    ]
  },
  {
    path: '/',
    element: <AppShell />, errorElement: <ScreenProblem />,
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

      { path: 'items', element: <Items /> },
      { path: 'labels', element: <Labels /> },
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
  return (
    <>
      <RouterProvider router={router} />
      {/* One for the whole app: every askText/askYesNo anywhere renders here. */}
      <AskHost />
    </>
  )
}
