import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { health, loadShop, searchItems, completeSale, messageFor, rupees } from '../lib/api.js'
import { basketTotals, lineTotal, saveDraft, loadDraft, clearDraft, newOnceKey } from '../lib/basket.js'
import PaymentPanel from '../components/PaymentPanel.jsx'
import Receipt from '../components/Receipt.jsx'

/**
 * The sell screen.
 *
 * One screen, no navigation during a sale. Items build up on the left, the total stays large on the
 * right. Nothing here takes the cashier off this screen to finish a bill.
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
  const searchBox = useRef(null)

  const { data: status } = useQuery({ queryKey: ['health'], queryFn: health, refetchInterval: 30_000 })
  const { data: shop } = useQuery({ queryKey: ['shop'], queryFn: loadShop, staleTime: Infinity })

  const totals = basketTotals(lines)

  // Saved together. A reload mid-sale keeps the same key, so resubmitting the same basket
  // replays instead of charging twice.
  useEffect(() => { saveDraft(lines, onceKey) }, [lines, onceKey])

  // The box takes focus back whenever nothing is in the way. A scanner fires into whatever has
  // focus, so anything else means a scanned saree lands in the void.
  const refocus = () => requestAnimationFrame(() => searchBox.current?.focus())
  useEffect(() => { if (!paying && !receipt) refocus() }, [paying, receipt, lines.length])

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
    // A NEW key for the next basket. Reusing it would make the next sale look like a replay of the
    // last one and hand the cashier back the wrong bill.
    setOnceKey(newOnceKey())
    clearDraft()
    setReceipt(null)
    setPaying(false)
    refocus()
  }

  async function takePayment(payment) {
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
        payments: [payment]
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
    <div className="till" style={s.page}>
      <header style={s.header}>
        <strong>{shop?.shop?.shopName ?? 'ScaleEzy POS'}</strong>
        <Status status={status} />
      </header>

      <main style={s.body}>
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
                  <button style={s.result} onClick={() => addItem(item)}>
                    <span>
                      {item.name}
                      {(item.colour || item.size) && <span style={s.muted}> · {[item.colour, item.size].filter(Boolean).join(', ')}</span>}
                      <span style={s.muted}> · {item.code}</span>
                    </span>
                    <span>
                      <Left qty={item.availableQty} />
                      <b style={{ marginLeft: 12 }}>{rupees(item.pricePaise)}</b>
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

        <aside style={s.right}>
          <div>
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
          onCancel={() => { setPaying(false); refocus() }}
          onConfirm={takePayment}
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

function Status({ status }) {
  if (!status) return <span style={s.muted}>Checking…</span>
  const standalone = status.mode === 'standalone'
  return (
    <span style={{ display: 'flex', gap: 16, fontSize: 13 }}>
      <span style={{ color: status.database === 'up' ? 'var(--good)' : 'var(--bad)' }}>
        {status.database === 'up' ? `Database ${status.databaseMs} ms` : 'Database unreachable'}
      </span>
      <span style={{ color: standalone ? 'var(--warn)' : 'var(--ink-soft)' }}>
        {standalone ? 'Standalone' : 'Inventory connected'}
      </span>
    </span>
  )
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  body: { flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', minHeight: 0 },
  left: { padding: 16, overflow: 'auto' },
  right: {
    borderLeft: '1px solid var(--line)', background: 'var(--panel)', padding: 16,
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  },
  empty: { color: 'var(--ink-soft)', marginTop: 24 },
  results: { listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6 },
  result: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    textAlign: 'left', fontWeight: 400, gap: 12
  },
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
  totalLabel: { fontSize: 13, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 40, fontWeight: 700, lineHeight: 1.1 },
  complete: { minHeight: 54, fontSize: 16, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
