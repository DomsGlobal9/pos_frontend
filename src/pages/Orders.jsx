import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  loadOrders, loadBill, collectOnOrder, markOrderReady, handOverOrder,
  rupees, messageFor
} from '../lib/api.js'
import { newOnceKey } from '../lib/basket.js'
import PaymentPanel from '../components/PaymentPanel.jsx'
import Receipt from '../components/Receipt.jsx'
import { askYesNo } from '../components/Ask.jsx'

/**
 * WF-ORDERS-01. POS-ORD-006..010.
 *
 * Everything a customer is waiting on. One word for the shop -- Orders -- over what is really two
 * separate facts: where the goods are, and whether money is owed. The tabs are filters over those,
 * so an order that is Ready AND still owes money appears under both. That is the truth; a single
 * status would have to hide one of them.
 */
const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'WAITING', label: 'Waiting' },
  { key: 'READY', label: 'Ready' },
  { key: 'DUE', label: 'Due' },
  { key: 'COMPLETE', label: 'Complete' }
]

const WHERE = { WAITING: 'Waiting', READY: 'Ready to collect', HANDED_OVER: 'Handed over' }

export function Orders() {
  const [tab, setTab] = useState('ALL')
  const [q, setQ] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['orders', tab, q.trim()],
    queryFn: () => loadOrders(tab, q.trim()),
    placeholderData: keepPreviousData
  })

  const orders = data ?? []

  return (
    <div style={s.page}>
      <h1 style={s.title}>Orders</h1>

      <div style={s.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            style={{ ...s.tab, ...(tab === t.key ? s.tabOn : null) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Customer, phone or invoice number"
        aria-label="Find an order"
      />

      {isError && <p style={s.bad}>{messageFor(error)}</p>}
      {isLoading && <p style={s.muted}>Loading…</p>}
      {!isLoading && orders.length === 0 && (
        <p style={s.muted}>
          {q.trim() ? 'No orders match that.' : EMPTY[tab]}
        </p>
      )}

      <ul style={s.list} className="card-list">
        {orders.map(order => (
          <li key={order.id}>
            <Link to={`/orders/${order.id}`} style={s.row}>
              <div style={s.main}>
                <div><b>{order.customerName || 'No name'}</b></div>
                <div style={s.muted}>
                  {order.itemCount} {order.itemCount === 1 ? 'piece' : 'pieces'}
                  {order.note ? ` · ${order.note}` : ''}
                </div>
                <div style={s.muted}>{order.invoiceNo}</div>
              </div>
              {/* Two facts, two tags: money, and where the goods are. A date goes red once it has passed. */}
              <div style={s.right}>
                <div style={s.tags}>
                  {order.owedPaise > 0
                    ? <span className="chip warn">{rupees(order.owedPaise)} due</span>
                    : <span className="chip good">Paid</span>}
                  <span className={`chip${order.fulfilment === 'READY' ? ' brand' : ''}`}>{WHERE[order.fulfilment]}</span>
                </div>
                {order.promisedAt && order.fulfilment !== 'HANDED_OVER' && (
                  <div style={order.overdue ? s.late : s.muted}>
                    {order.overdue ? 'Late · ' : 'Collect '}{when(order.promisedAt)}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const EMPTY = {
  ALL: 'No orders yet. From the sell screen, More → Keep for customer.',
  WAITING: 'Nothing waiting.',
  READY: 'Nothing ready to collect.',
  DUE: 'Nobody owes anything.',
  COMPLETE: 'No completed orders yet.'
}

/**
 * WF-ORDER-02. POS-ORD-011..014, POS-PAY-014.
 *
 * One order, and the three things a shop does with it: take more money, say it is ready, hand it
 * over. The bill itself sits underneath, rendered by the same component as every other bill, so
 * what the shop sees here is exactly what the customer's copy says.
 */
export function OrderDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [collecting, setCollecting] = useState(null)
  const [busy, setBusy] = useState(false)
  const { shop } = useOutletContext() ?? {}

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => loadBill(id)
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bill', id] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['home'] })
  }

  async function collect(payments) {
    try {
      // The counter, so a cash balance counts in the drawer it went into. POS-SHIFT-005.
      await collectOnOrder(id, { onceKey: collecting.onceKey, payments, counterId: shop?.counters?.[0]?.id })
      toast.success('Payment taken.')
      setCollecting(null)
      refresh()
    } catch (err) {
      // Stays open with what was typed. A payment that failed must never look like one that worked.
      toast.error(messageFor(err))
    }
  }

  async function ready() {
    setBusy(true)
    try {
      await markOrderReady(id)
      toast.success('Marked ready.')
      refresh()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  /**
   * POS-ORD-013. With money owed, the server refuses and says how much -- and that refusal is the
   * warning. The person at the till then decides, in so many words, whether to hand it over
   * anyway. That decision is recorded with their name.
   */
  async function handOver() {
    setBusy(true)
    try {
      await handOverOrder(id)
      toast.success('Handed over.')
      refresh()
    } catch (err) {
      const details = err?.response?.data?.details
      if (details?.code === 'HANDOVER_WITH_DUE') {
        const yes = await askYesNo('Hand it over anyway?', {
          note: `${rupees(details.owedPaise)} is still owed on this order. The amount and your name will be recorded.`,
          confirmLabel: 'Hand over'
        })
        if (yes) {
          try {
            await handOverOrder(id, true)
            toast.success('Handed over with money still owed.')
            refresh()
          } catch (inner) {
            toast.error(messageFor(inner))
          }
        }
      } else {
        toast.error(messageFor(err))
      }
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p style={s.state}>Loading…</p>
  if (isError) {
    return (
      <div style={s.state}>
        <p style={s.bad}>{messageFor(error)}</p>
        <Link to="/orders" style={s.muted}>Back to orders</Link>
      </div>
    )
  }

  const kept = data.kind === 'KEPT'
  const done = data.fulfilment === 'HANDED_OVER'

  return (
    <div>
      <div style={s.panel} className="no-print">
        <Link to="/orders" style={s.muted}>← All orders</Link>

        <div style={s.headline}>
          <div>
            <b style={{ fontSize: 18 }}>{data.customer?.name || 'Customer'}</b>
            <div style={s.muted}>{WHERE[data.fulfilment]}{data.promisedAt && !done ? ` · collect ${when(data.promisedAt)}` : ''}</div>
            {data.note && <div style={s.note}>{data.note}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {data.owedPaise > 0
              ? <><div style={s.muted}>Still owed</div><div style={s.owedBig}>{rupees(data.owedPaise)}</div></>
              : <div style={s.paid}>Paid in full</div>}
          </div>
        </div>

        {kept && !done && (
          <div style={s.actions}>
            {data.owedPaise > 0 && (
              // One key per opening of the panel, so a double press records the money once.
              <button style={s.primary} onClick={() => setCollecting({ onceKey: newOnceKey() })}>
                Take payment
              </button>
            )}
            {data.fulfilment === 'WAITING' && (
              <button onClick={ready} disabled={busy}>Mark ready</button>
            )}
            <button onClick={handOver} disabled={busy}>Hand over</button>
          </div>
        )}

        {kept && done && data.owedPaise > 0 && (
          <div style={s.actions}>
            <button style={s.primary} onClick={() => setCollecting({ onceKey: newOnceKey() })}>
              Take payment
            </button>
          </div>
        )}

        {data.handoverDuePaise > 0 && (
          <p style={s.muted}>Handed over with {rupees(data.handoverDuePaise)} still owed.</p>
        )}
      </div>

      <Receipt sale={data} />

      {collecting && (
        <PaymentPanel
          mode="COLLECT"
          totalPaise={data.owedPaise}
          creditPaise={data.customer?.storeCreditPaise ?? 0}
          onCancel={() => setCollecting(null)}
          onConfirm={collect}
        />
      )}
    </div>
  )
}

function when(at) {
  return new Date(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 860, alignContent: 'start' },
  state: { padding: 16, display: 'grid', gap: 10, justifyItems: 'start' },
  title: { margin: 0, fontSize: 22 },
  tabs: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 },
  tab: { minHeight: 40, padding: '0 14px', fontWeight: 400, whiteSpace: 'nowrap' },
  tabOn: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 64,
    padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)'
  },
  main: { minWidth: 0 },
  right: { textAlign: 'right', whiteSpace: 'nowrap', display: 'grid', gap: 6, justifyItems: 'end' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' },
  owed: { color: 'var(--warn)', fontWeight: 700 },
  late: { color: 'var(--bad)', fontSize: 12, fontWeight: 600 },
  panel: { padding: '12px 16px 0', display: 'grid', gap: 12, maxWidth: 760 },
  headline: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  note: { marginTop: 6, fontSize: 14 },
  owedBig: { fontSize: 24, fontWeight: 700, color: 'var(--warn)' },
  paid: { color: 'var(--good)', fontWeight: 600 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, textDecoration: 'none' },
  bad: { color: 'var(--bad)', margin: 0 }
}
