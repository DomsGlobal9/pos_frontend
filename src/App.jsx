import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppShell from './AppShell.jsx'
import Home from './pages/Home.jsx'
import Till from './pages/Till.jsx'
import Placeholder from './pages/Placeholder.jsx'
import More from './pages/More.jsx'

/**
 * Routes. Every path here is a screen registered in docs/product/FLOWS.md.
 *
 * The narrow-screen notice that used to live in this file is GONE -- CHG-001 retires the rule that
 * hid selling below 768 px. Phone, tablet and desktop are all first-class now, and the shell
 * adapts rather than refusing.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'sell', element: <Till /> },
      {
        path: 'orders',
        element: (
          <Placeholder
            title="Orders"
            does="Everything a customer is waiting for: goods kept for them, money still due, and orders ready to collect."
            arriving="Being built now. Until then, completed sales appear on Home."
          />
        )
      },
      {
        path: 'customers',
        element: (
          <Placeholder
            title="Customers"
            does="Find a customer by phone, see what they have bought, and what they owe."
            arriving="Being built now. A sale does not need a customer, so selling works without this."
          />
        )
      },
      { path: 'more', element: <More /> },
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
