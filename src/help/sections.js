/**
 * The till's guide, in the order a shop meets it: start, sell, take the money, credit and orders,
 * after the sale, the end of the day, and what runs behind. Each page is content/<section id>/<page>.md
 * and says which screen it is about (`app:`), so the "?" on that screen opens it. A page listed here
 * with no file yet is left out of the menu.
 *
 * Built the same way as Inventory's Help Center (src/help there), so the two read and work alike;
 * where a subject is Inventory's own (items, prices, points rules, the Day Book), a page here says so
 * in a line and links to Inventory's guide rather than repeating it.
 */
export const SECTIONS = [
  { id: 'start', title: 'Start here', icon: 'Compass',
    blurb: 'Your job at the till -- cashier, manager or owner -- and the words used on it.',
    pages: ['cashier', 'manager', 'owner', 'open-the-till', 'find-your-way', 'words-we-use'] },
  { id: 'selling', title: 'Selling', icon: 'ShoppingBag',
    blurb: 'Make a bill: items, the customer, who served, discounts and offers, parking a bill.',
    pages: ['make-a-bill', 'customers', 'served-by', 'discounts-and-offers', 'park-a-bill'] },
  { id: 'payments', title: 'Payments', icon: 'Wallet',
    blurb: 'Every way a customer can pay: cash, UPI, any card machine, points, store credit, split.',
    pages: ['how-customers-can-pay', 'upi', 'card-machine', 'payments-to-check', 'points-and-store-credit'] },
  { id: 'orders', title: 'Orders and credit', icon: 'ClipboardList',
    blurb: 'Kept for the customer, sold on credit (udhaar), collecting what is owed, writing it off.',
    pages: ['kept-orders', 'sell-on-credit', 'collect-what-is-owed', 'write-off'] },
  { id: 'gst', title: 'GST and bills', icon: 'FileText',
    blurb: 'Which bill the till prints, business (B2B) bills, Rs 50,000+ bills, reprints and sharing.',
    pages: ['which-bill', 'business-bills', 'large-bills', 'bills-and-reprints'] },
  { id: 'returns', title: 'Returns and exchanges', icon: 'Undo2',
    blurb: 'Take something back, swap it for something else, and the credit note that goes with it.',
    pages: ['return', 'exchange'] },
  { id: 'day', title: 'Shifts and the day', icon: 'Clock',
    blurb: 'Open and count the drawer, cash in and out, close the shift and close the day.',
    pages: ['shift-and-drawer', 'close-the-day'] },
  { id: 'reports', title: 'Reports and the accountant', icon: 'BarChart3',
    blurb: 'How the day went, sales by salesperson, GST by rate, and the Excel for your accountant.',
    pages: ['reports', 'sales-by-salesperson', 'accountant-export'] },
  { id: 'setup', title: 'Set up and staff', icon: 'Settings',
    blurb: 'Staff and PINs, what needs a manager, shop settings, devices and connections.',
    pages: ['staff-and-pins', 'manager-approval', 'settings', 'devices'] },
  { id: 'behind', title: 'Internet and Inventory', icon: 'Wifi',
    blurb: 'When the internet drops, and how the till keeps Inventory up to date.',
    pages: ['when-the-internet-drops', 'inventory-link'] }
];
