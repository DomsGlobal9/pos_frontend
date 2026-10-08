import { useQuery } from '@tanstack/react-query'
import { loadAudit, messageFor, rupees } from '../lib/api.js'

/**
 * Who did what. POS-CORE-010. Owner and managers only.
 *
 * The question an owner brings here is never "did someone give a discount" -- the bill shows that.
 * It is "who keeps giving them, and what reason keeps being given". So each row leads with the
 * person and the reason, and the amount comes after.
 *
 * A cashier who opens this gets one plain sentence from the server (POS-APR-006) rather than a
 * status code -- and the list itself, because it names people, is not theirs to read.
 */
const LABEL = {
  'sale.discount_over_limit': 'Discount over the limit',
  'sale.price_override': 'Price changed',
  'approval.granted': 'Manager approved',
  'approval.refused': 'Approval refused',
  'payment.unconfirmed': 'Payment not confirmed',
  'payment.resolved': 'Payment checked',
  'bill.reprinted': 'Bill reprinted',
  'sale.completed': 'Sale',
  'return.created': 'Return',
  'exchange.created': 'Exchange',
  'store_credit.spent': 'Store credit spent',
  'shift.opened': 'Shift opened',
  'shift.closed': 'Shift closed',
  'shift.count_mismatch': "Drawer count didn't match",
  'cash.in': 'Cash in',
  'cash.out': 'Cash out',
  'day.closed': 'Day closed',
  'day.reclosed': 'Day closed again',
  'inventory.connected': 'Connected to Inventory',
  'inventory.disconnected': 'Disconnected from Inventory',
  'inventory.retried': 'Inventory sending retried',
  'inventory.skipped': 'Bill left out of Inventory',
  'inventory.catalogue_synced': 'Items refreshed from Inventory',
  /*
   * The rest of what the server actually records. Fifteen of these were missing, so the owner's
   * Activity screen showed them raw -- "shop.upi_set", "till.opened" -- next to rows in English
   * (found on the live till, 5 Oct). An unknown action still falls back to its code below, which
   * is the right last resort: it names exactly what to add here.
   */
  'till.opened': 'Till opened',
  'till.closed': 'Till closed',
  'staff.added': 'Person added',
  'staff.changed': 'Person changed',
  'device.updated': 'Device changed',
  'shop.upi_set': 'UPI ID set',
  'shop.logo_set': 'Logo changed',
  'sale.offers_applied': 'Offers applied',
  'items.imported': 'Items imported from a file',
  'receipt.sent': 'Bill sent to the customer',
  'order.handed_over_with_due': 'Kept order handed over with money still owed',
  'order.written_off': 'Balance written off as never paid',
  'api_key.created': 'Key made for your other software',
  'api_key.revoked': 'Key stopped',
  'webhook.created': 'Updates address added',
  'webhook.updated': 'Updates address changed',
  'webhook.deleted': 'Updates address removed',
  'webhook.resent': 'Update sent again'
}

export default function Audit() {
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['audit'], queryFn: loadAudit })

  return (
    <div style={s.page}>
      <h1 style={s.title}>Activity</h1>
      <p style={s.muted}>Discounts over the limit, price changes and approvals — newest first.</p>

      {isLoading && <p style={s.muted}>Loading…</p>}
      {isError && <p style={s.bad}>{messageFor(error)}</p>}
      {!isLoading && !isError && (data ?? []).length === 0 && (
        <p style={s.muted}>Nothing to show yet.</p>
      )}

      <ul style={s.list} className="card-list">
        {(data ?? []).map(row => {
          const d = row.detail ?? {}
          return (
            <li key={row.id} style={s.row}>
              <div>
                <b>{LABEL[row.action] ?? row.action}</b>
                {row.subject && <span style={s.muted}> · {row.subject}</span>}
              </div>
              <div style={s.muted}>
                {row.actorName ?? 'Someone'}
                {d.approvedBy ? ` asked · ${d.approvedBy} approved` : d.byOwnAuthority ? ' on their own authority' : ''}
                {d.discountPaise ? ` · ${rupees(d.discountPaise)} off` : ''}
                {d.reason ? ` · "${d.reason}"` : ''}
              </div>
              <div style={s.muted}>{new Date(row.createdAt).toLocaleString('en-IN')}</div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: { display: 'grid', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--line)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, margin: 0 },
  bad: { color: 'var(--bad)', margin: 0 }
}
