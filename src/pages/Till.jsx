import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import { searchItems, completeSale, messageFor, rupees } from '../lib/api.js'
import { isTouchFirst } from '../lib/useMedia.js'
import { basketTotals, lineTotal, saveDraft, loadDraft, clearDraft, newOnceKey } from '../lib/basket.js'
import PaymentPanel from '../components/PaymentPanel.jsx'
import Receipt from '../components/Receipt.jsx'
import VariantSheet from '../components/VariantSheet.jsx'
import CustomerSheet from '../components/CustomerSheet.jsx'

/**
 * The sell screen.
 *
 * WF-SELL-01. POS-SELL-001..003, -005, -008..012, -014, -022..025.
 *
 * One screen, no navigation during a sale. Nothing here takes the cashier off this screen to
 * finish a bill.
 *
 * LAYOUT BY DEVICE. Desktop keeps the basket beside a permanent totals panel, because a counter has
 * the width and the cashier wants the running total in view at all times. Phone and tablet put the
 * basket in one column with the total and the primary action pinned to the bottom, where a thumb
 * reaches -- MASTER.md UX commandments 2 and 3.
 *
 * KEYBOARD FIRST, because a barcode scanner IS a keyboard: it types the code and presses Enter.
 * That single fact drives everything about the input -- the search box holds focus at all times and
 * takes it back after every add, every dialog and every error. A scan that lands nowhere is a scan
 * the cashier does not notice losing.
 */
export default function Till() {
  // Read once, lazily. Passing loadDraft itself rather than calling it keeps localStorage out of
  // every render.
  const [draft] = useState(loadDraft)
  const [lines, setLines] = useState(draft.lines)
  const [onceKey, setOnceKey] = useState(draft.onceKey)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [paying, setPaying] = useState(false)
  const [receipt, setReceipt] = useState(null)
  // The colour/size picker, when a search result turns out to have siblings. WF-PRODUCT-01.
  const [picking, setPicking] = useState(null)
  /*
   * The customer on this bill, or null. POS-CUST-001.
   *
   * Null is a perfectly good final answer -- someone paying cash who will not give a number is a
   * normal Saturday -- so nothing below may treat it as a missing value to be chased.
   */
  const [customer, setCustomer] = useState(null)
  const [askingCustomer, setAskingCustomer] = useState(false)
  const searchBox = useRef(null)

  // The shell already loads these and shows connection state in the header; asking again here
  // would be a second round trip for the same answer on the screen that can least afford one.
  const { device, shop } = useOutletContext() ?? {}
  const stacked = isTouchFirst(device)

  const totals = basketTotals(lines)

  // Saved together. A reload mid-sale keeps the same key, so resubmitting the same basket
  // replays instead of charging twice.
  useEffect(() => { saveDraft(lines, onceKey) }, [lines, onceKey])

  // The box takes focus back whenever nothing is in the way. A scanner fires into whatever has
  // focus, so anything else means a scanned saree lands in the void.
  const refocus = () => requestAnimationFrame(() => searchBox.current?.focus())
  useEffect(() => { if (!paying && !receipt) refocus() }, [paying, receipt, lines.length])

  /**
   * A tapped search result. POS-SELL-006.
   *
   * If the item has siblings -- the same saree in three colours -- the cashier has not chosen yet,
   * so the picker opens. A SCANNED barcode never comes through here; it is one specific piece and
   * goes straight into the basket, because adding a tap to every scan would blow the 150 ms budget.
   */
  function chooseItem(item) {
    if (item.priceFromPaise && item.variantGroup) {
      setPicking({ group: item.variantGroup, name: item.name })
      return
    }
    addItem(item)
  }

  function addItem(item) {
    setLines(current => {
      const at = current.findIndex(l => l.id === item.id)
      if (at >= 0) {
        const next = [...current]
        next[at] = { ...next[at], qty: next[at].qty + 1 }
        return next
      }
      return [...current, {
        id: item.id, code: item.code, name: item.name, colour: item.colour, size: item.size,
        pricePaise: item.pricePaise, taxRate: item.taxRate, qty: 1, availableQty: item.availableQty
      }]
    })
    setQuery('')
    setResults([])
    refocus()
  }

  async function find(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    setBusy(true)
    try {
      const found = await searchItems(q)
      if (found.exact && found.items.length === 1) {
        // Straight into the basket. Asking the cashier to click the only result is a click a sale,
        // all day.
        addItem(found.items[0])
      } else if (found.items.length === 0) {
        // The box keeps what was typed: a scan that read badly is usually retyped, not re-scanned.
        toast.error(`Nothing found for "${q}"`)
        setResults([])
        refocus()
      } else {
        setResults(found.items)
      }
    } catch (error) {
      toast.error(messageFor(error))
      refocus()
    } finally {
      setBusy(false)
    }
  }

  const setQty = (id, qty) =>
    setLines(current => qty <= 0
      ? current.filter(l => l.id !== id)
      : current.map(l => (l.id === id ? { ...l, qty } : l)))

  function startAgain() {
    setLines([])
    setCustomer(null)
    // A NEW key for the next basket. Reusing it would make the next sale look like a replay of the
    // last one and hand the cashier back the wrong bill.
    setOnceKey(newOnceKey())
    clearDraft()
    setReceipt(null)
    setPaying(false)
    refocus()
  }

  async function takePayment(payments) {
    const counterId = shop?.counters?.[0]?.id
    if (!counterId) {
      toast.error('This till has no counter set up yet.')
      return
    }
    try {
      const result = await completeSale({
        onceKey,
        counterId,
        lines: lines.map(l => ({ itemId: l.id, qty: l.qty })),
        ...(customer ? { customerId: customer.id } : {}),
        payments
      })
      // Cleared HERE, on save -- not in startAgain. A cashier who walks away after handing
      // over the bill, or whose browser reloads before they press Next sale, must not come back
      // to a basket that has already been paid for.
      clearDraft()
      setReceipt(result.sale)
      setPaying(false)
      if (result.replayed) toast('That bill was already saved. Showing it again.')
    } catch (error) {
      // Stays on the payment screen with the basket intact. A failed save must never look like a
      // completed sale, and must never cost the cashier the basket.
      toast.error(messageFor(error))
    }
  }

  if (receipt) return <Receipt sale={receipt} onDone={startAgain} />

  return (
    <div style={s.page}>
      <main style={{ ...s.body, ...(stacked ? s.bodyStacked : s.bodySplit) }}>
        <section style={s.left}>
          <form onSubmit={find}>
            <input
              ref={searchBox}
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Scan a barcode, or type a code or name"
              aria-label="Find an item"
            />
          </form>

          {results.length > 0 && (
            <ul style={s.results}>
              {results.map(item => (
                <li key={item.id}>
                  <button style={s.result} onClick={() => chooseItem(item)}>
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" style={s.thumb} />
                      : <span style={{ ...s.thumb, ...s.noImage }} aria-hidden="true" />}
                    <span style={s.resultText}>
                      <span>{item.name}</span>
                      <span style={s.muted}>
                        {item.priceFromPaise
                          ? `${item.variantCount} colours and sizes`
                          : [item.colour, item.size, item.code].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span style={s.resultRight}>
                      {/* A row standing for several colours shows the cheapest as a "from" price;
                          a specific piece shows its own. */}
                      <b>{item.priceFromPaise ? `from ${rupees(item.priceFromPaise)}` : rupees(item.pricePaise)}</b>
                      {!item.priceFromPaise && <Left qty={item.availableQty} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {lines.length === 0 && results.length === 0 && (
            <p style={s.empty}>Scan an item to start.</p>
          )}

          {lines.length > 0 && (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Item</th>
                  <th style={{ ...s.th, width: 130 }}>Qty</th>
                  <th style={{ ...s.thRight, width: 110 }}>Price</th>
                  <th style={{ ...s.thRight, width: 110 }}>Total</th>
                  <th style={{ ...s.th, width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id}>
                    <td style={s.td}>
                      {line.name}
                      <div style={s.muted}>
                        {[line.colour, line.size].filter(Boolean).join(', ')}
                        {line.colour || line.size ? ' · ' : ''}{line.code}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={s.qty}>
                        <button style={s.qtyBtn} onClick={() => setQty(line.id, line.qty - 1)} aria-label="One less">−</button>
                        <span style={s.qtyNum}>{line.qty}</span>
                        <button style={s.qtyBtn} onClick={() => setQty(line.id, line.qty + 1)} aria-label="One more">+</button>
                      </div>
                    </td>
                    <td style={s.tdRight}>{rupees(line.pricePaise)}</td>
                    <td style={s.tdRight}><b>{rupees(lineTotal(line))}</b></td>
                    <td style={s.td}>
                      <button style={s.remove} onClick={() => setQty(line.id, 0)} aria-label="Remove">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside style={{ ...s.right, ...(stacked ? s.rightStacked : s.rightSplit) }}>
          <div>
            {/* Above the total, because it is the thing a cashier checks last before taking
                money -- and because leaving it blank has to stay effortless. */}
            <div style={s.customer}>
              {customer ? (
                <>
                  <span style={s.customerName}>{customer.name || customer.phoneDisplay}</span>
                  <button style={s.customerClear} onClick={() => setCustomer(null)}>Remove</button>
                </>
              ) : (
                <button style={s.customerAdd} onClick={() => setAskingCustomer(true)}>
                  + Add customer
                </button>
              )}
            </div>
            <div style={s.totalLabel}>Total</div>
            <div style={s.totalValue}>{rupees(totals.totalPaise)}</div>
            {totals.roundOffPaise !== 0 && (
              <div style={s.muted}>Rounding {rupees(totals.roundOffPaise)}</div>
            )}
            <div style={{ ...s.muted, marginTop: 8 }}>
              {lines.length} {lines.length === 1 ? 'line' : 'lines'}
              {' · '}
              {(() => {
                const n = lines.reduce((sum, l) => sum + l.qty, 0)
                return `${n} ${n === 1 ? 'item' : 'items'}`
              })()}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {lines.length > 0 && (
              <button onClick={startAgain}>Clear bill</button>
            )}
            <button
              style={s.complete}
              disabled={lines.length === 0 || busy}
              onClick={() => setPaying(true)}
            >
              Take payment
            </button>
          </div>
        </aside>
      </main>

      {paying && (
        <PaymentPanel
          totalPaise={totals.totalPaise}
          enabledMethods={shop?.shop?.enabledPaymentMethods}
          onCancel={() => { setPaying(false); refocus() }}
          onConfirm={takePayment}
        />
      )}

      {askingCustomer && (
        <CustomerSheet
          onPick={(c) => { setCustomer(c); setAskingCustomer(false); refocus() }}
          onSkip={() => { setAskingCustomer(false); refocus() }}
          onClose={() => { setAskingCustomer(false); refocus() }}
        />
      )}

      {picking && (
        <VariantSheet
          group={picking.group}
          name={picking.name}
          onPick={(variant) => { setPicking(null); addItem(variant) }}
          onClose={() => { setPicking(null); refocus() }}
        />
      )}
    </div>
  )
}

/** How many are left, when that is known. Null is not zero, and must not be shown as zero. */
function Left({ qty }) {
  if (qty === null || qty === undefined) return null
  if (qty <= 0) return <span style={{ ...s.muted, color: 'var(--bad)' }}>none left</span>
  if (qty === 1) return <span style={{ ...s.muted, color: 'var(--warn)' }}>last one</span>
  return <span style={s.muted}>{qty} left</span>
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  body: { flex: 1, display: 'grid', minHeight: 0 },
  // Counter: basket and totals side by side, total always in view.
  bodySplit: { gridTemplateColumns: 'minmax(0, 1fr) 300px' },
  // Phone and tablet: one column, totals pinned under it.
  bodyStacked: { gridTemplateRows: 'minmax(0, 1fr) auto' },
  left: { padding: 16, overflow: 'auto', minWidth: 0 },
  right: { background: 'var(--panel)', padding: 16, display: 'flex' },
  rightSplit: {
    borderLeft: '1px solid var(--line)',
    flexDirection: 'column', justifyContent: 'space-between'
  },
  rightStacked: {
    borderTop: '1px solid var(--line)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
  },
  empty: { color: 'var(--ink-soft)', marginTop: 24 },
  results: { listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6 },
  result: {
    width: '100%', display: 'flex', alignItems: 'center',
    textAlign: 'left', fontWeight: 400, gap: 12, minHeight: 60
  },
  resultText: { display: 'grid', flex: 1, minWidth: 0 },
  resultRight: { display: 'grid', justifyItems: 'end', gap: 2 },
  thumb: { width: 40, height: 40, borderRadius: 6, flex: '0 0 auto', objectFit: 'cover' },
  noImage: { background: 'var(--bg)', border: '1px solid var(--line)' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 14 },
  th: { textAlign: 'left', fontSize: 12, color: 'var(--ink-soft)', padding: '6px 8px', borderBottom: '1px solid var(--line)' },
  thRight: { textAlign: 'right', fontSize: 12, color: 'var(--ink-soft)', padding: '6px 8px', borderBottom: '1px solid var(--line)' },
  td: { padding: '8px', borderBottom: '1px solid var(--line)', verticalAlign: 'middle' },
  tdRight: { padding: '8px', borderBottom: '1px solid var(--line)', textAlign: 'right', verticalAlign: 'middle' },
  muted: { color: 'var(--ink-soft)', fontSize: 12 },
  qty: { display: 'flex', alignItems: 'center', gap: 4 },
  qtyBtn: { minHeight: 36, minWidth: 36, padding: 0, fontSize: 18, lineHeight: 1 },
  qtyNum: { minWidth: 28, textAlign: 'center', fontWeight: 600 },
  remove: { minHeight: 36, minWidth: 36, padding: 0, fontSize: 18, lineHeight: 1, border: 'none', background: 'none', color: 'var(--ink-soft)' },
  customer: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  customerName: { fontWeight: 600, fontSize: 14 },
  customerClear: { minHeight: 32, padding: '0 8px', fontSize: 12, fontWeight: 400 },
  customerAdd: { minHeight: 40, padding: '0 12px', fontSize: 14, fontWeight: 400 },
  totalLabel: { fontSize: 13, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 40, fontWeight: 700, lineHeight: 1.1 },
  complete: { minHeight: 54, fontSize: 16, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
