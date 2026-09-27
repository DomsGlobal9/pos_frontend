import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { rupees, markPrinted, messageFor } from '../lib/api.js'

/**
 * The 80 mm receipt, printed from the browser.
 *
 * No thermal driver, by decision: a shop prints from Chrome to whatever printer it has, and the
 * same bill is a PDF through the browser's own "save as PDF". That decision is settled and carried
 * over from the counter sale that ran inside Inventory.
 *
 * The print CSS is the whole trick. @page sets the paper to 80 mm with no margin, and everything
 * that is not the bill is hidden -- so what comes out of the printer is the receipt alone, at the
 * right width, with no browser headers and no screen furniture.
 *
 * WHAT IT CARRIES, because a GST invoice is not optional: shop name and GSTIN, invoice number, date
 * and time, the cashier, each line with its HSN, the CGST/SGST split, the round-off, the total, how
 * it was paid, and what they saved.
 *
 * ONE COMPONENT, TWO PLACES. This is both the screen after a sale and the bill opened from history
 * (WF-SUCCESS-01 and WF-SALE-02). Deliberately not two components: two renderings of one bill is
 * how a reprint stops matching the original, and the original is the one the customer is holding.
 * `onDone` is what differs -- present after a sale (Next sale), absent from history.
 *
 * DUPLICATES ARE MARKED. POS-RCPT-004. Copy 1 is the original; every copy after it prints
 * DUPLICATE across the top. Two identical-looking copies of one invoice is how the same saree gets
 * returned twice, and how a shop loses track of which one the accountant has.
 */
export default function Receipt({ sale, onDone }) {
  // Which copy is in the printer's hand right now. Null until Print is pressed.
  const [copyNumber, setCopyNumber] = useState(null)
  const [printing, setPrinting] = useState(false)

  // Enter starts the next sale. A cashier's hand is already on the keyboard and the next customer
  // is already at the counter. Only after a sale -- from history there is no next sale to start.
  useEffect(() => {
    if (!onDone) return
    const onKey = (event) => {
      if (event.key === 'Enter') { event.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  /**
   * Count the copy, then print.
   *
   * Counted on the way IN rather than after, because the browser gives no reliable signal that a
   * page actually reached paper. That over-counts when someone cancels the dialog, which is the
   * safe direction: a copy wrongly marked duplicate costs nothing, an unmarked duplicate in
   * circulation costs a saree.
   *
   * A failure to count does NOT block the print. A shop with a customer waiting needs the paper
   * more than we need the tally.
   */
  async function print() {
    if (printing) return
    setPrinting(true)
    try {
      const { copyNumber: n } = await markPrinted(sale.id)
      setCopyNumber(n)
      // Let the banner render before the print dialog freezes the page.
      await new Promise(resolve => setTimeout(resolve, 60))
    } catch (error) {
      toast.error(messageFor(error))
    } finally {
      setPrinting(false)
      window.print()
    }
  }

  // Before the first press, fall back to what the bill already knows: opening a bill that has been
  // printed twice should not look like a fresh original.
  const isDuplicate = (copyNumber ?? (sale.printCount ?? 0) + 1) > 1
  const shownCopy = copyNumber ?? (sale.printCount ?? 0) + 1

  const shop = sale.shop ?? {}
  /*
   * Summed from what was CHARGED, never worked out again here.
   *
   * The split is stored on each line for exactly this reason: the odd paisa of an odd tax has to
   * go to one side, and a receipt recomputing it would make a reprint disagree with the original
   * the day that rule changes. A GST invoice has to say the same thing in five years.
   */
  const cgst = sale.lines.reduce((sum, l) => sum + (l.cgstPaise ?? 0), 0)
  const sgst = sale.lines.reduce((sum, l) => sum + (l.sgstPaise ?? 0), 0)
  const igst = sale.lines.reduce((sum, l) => sum + (l.igstPaise ?? 0), 0)

  return (
    <div style={s.page}>
      <style>{PRINT_CSS}</style>

      <div style={s.bar} className="no-print">
        <div>
          <b>{onDone ? `Saved as ${sale.invoiceNo}` : sale.invoiceNo}</b>
          <div style={s.muted}>
            {rupees(sale.totalPaise)} · {new Date(sale.createdAt).toLocaleString('en-IN')}
            {(sale.printCount ?? 0) > 0 && ` · printed ${sale.printCount} ${sale.printCount === 1 ? 'time' : 'times'}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={print} disabled={printing}>
            {printing ? 'Preparing…' : (sale.printCount ?? 0) > 0 ? 'Print again' : 'Print'}
          </button>
          {onDone && <button style={s.next} onClick={onDone}>Next sale</button>}
        </div>
      </div>

      <div style={s.sheet} className="receipt">
        {isDuplicate && (
          <div style={s.duplicate}>
            DUPLICATE &middot; COPY {shownCopy}
          </div>
        )}
        <div style={s.centre}>
          <b style={{ fontSize: 14 }}>{shop.shopName ?? 'Shop'}</b>
          {shop.address && <div>{shop.address}</div>}
          {shop.gstin && <div>GSTIN {shop.gstin}</div>}
        </div>

        <Rule />

        <div style={s.line}><span>Bill</span><b>{sale.invoiceNo}</b></div>
        <div style={s.line}>
          <span>Date</span><span>{new Date(sale.createdAt).toLocaleString('en-IN')}</span>
        </div>
        {sale.cashier?.name && <div style={s.line}><span>Cashier</span><span>{sale.cashier.name}</span></div>}
        {sale.customer && (
          <div style={s.line}>
            <span>Customer</span>
            {/* Masked: the receipt goes home with the customer and is often left on the counter. */}
            <span>{sale.customer.name ?? ''} {sale.customer.phoneMasked ?? ''}</span>
          </div>
        )}

        <Rule />

        {sale.lines.map(line => (
          <div key={line.id} style={{ marginBottom: 4 }}>
            <div>{line.description}</div>
            <div style={s.line}>
              <span style={s.muted}>
                {line.qty} × {rupees(line.unitPricePaise)}
                {line.hsn ? ` · HSN ${line.hsn}` : ''}
                {line.discountPaise > 0 ? ` · −${rupees(line.discountPaise)}` : ''}
              </span>
              <b>{rupees(line.lineTotalPaise)}</b>
            </div>
          </div>
        ))}

        <Rule />

        <div style={s.line}><span>Subtotal</span><span>{rupees(sale.subtotalPaise)}</span></div>
        {sale.discountPaise > 0 && (
          <div style={s.line}><span>Discount</span><span>−{rupees(sale.discountPaise)}</span></div>
        )}
        {igst > 0 ? (
          <div style={s.line}><span>IGST</span><span>{rupees(igst)}</span></div>
        ) : sale.taxPaise > 0 && (
          <>
            <div style={s.line}><span>CGST</span><span>{rupees(cgst)}</span></div>
            <div style={s.line}><span>SGST</span><span>{rupees(sgst)}</span></div>
          </>
        )}
        {sale.roundOffPaise !== 0 && (
          <div style={s.line}><span>Round off</span><span>{rupees(sale.roundOffPaise)}</span></div>
        )}

        <Rule />

        <div style={{ ...s.line, fontSize: 15 }}><b>Total</b><b>{rupees(sale.totalPaise)}</b></div>

        {sale.payments.map(p => (
          <div key={p.id} style={s.line}>
            <span>
              {METHOD[p.method] ?? p.method}
              {/*
                * Printed on the customer's copy on purpose. If the shop is still checking whether
                * a transfer landed, the person who made it should be able to see that from their
                * own receipt rather than be telephoned about it later.
                */}
              {p.status === 'NEEDS_CHECKING' && <span style={s.pending}> (being checked)</span>}
              {p.status === 'VOID' && <span style={s.pending}> (not received)</span>}
            </span>
            <span>{rupees(p.amountPaise)}</span>
          </div>
        ))}
        {/* POS-EXC-005. The customer's copy of an exchange says what it was against. */}
        {sale.exchangedFrom && (
          <div style={s.muted}>
            Exchange against {sale.exchangedFrom.originalInvoiceNo} · credit note {sale.exchangedFrom.creditNoteNo}
          </div>
        )}
        {sale.payments.some(p => p.changePaise > 0) && (
          <div style={s.line}>
            <span>Change</span>
            <span>{rupees(sale.payments.reduce((n, p) => n + (p.changePaise ?? 0), 0))}</span>
          </div>
        )}

        {/*
          * A kept order's receipt is also the customer's claim ticket: what is being done, when to
          * come, and what they still owe. They will bring this back to collect.
          */}
        {sale.kind === 'KEPT' && (
          <>
            <Rule />
            <div style={s.centre}><b>KEPT FOR COLLECTION</b></div>
            {sale.note && <div>{sale.note}</div>}
            {sale.promisedAt && (
              <div style={s.line}>
                <span>Collect on</span>
                <span>{new Date(sale.promisedAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            )}
            {sale.owedPaise > 0 && (
              <div style={{ ...s.line, fontWeight: 700 }}>
                <span>Balance due</span><span>{rupees(sale.owedPaise)}</span>
              </div>
            )}
          </>
        )}

        {sale.savedPaise > 0 && (
          <>
            <Rule />
            {/* The cheapest loyalty tool there is, and it costs one line. */}
            <div style={s.centre}><b>You saved {rupees(sale.savedPaise)}</b></div>
          </>
        )}

        {shop.receiptFooter && (
          <>
            <Rule />
            <div style={s.centre}>{shop.receiptFooter}</div>
          </>
        )}
      </div>
    </div>
  )
}

const Rule = () => <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 0; }
  body { background: #fff; }
  .no-print { display: none !important; }
  .receipt {
    width: 80mm; margin: 0; padding: 4mm 3mm;
    border: none; box-shadow: none; font-size: 11px;
  }
  /* The till hides itself below 768px on screen. Printing is not a narrow screen, so that rule
     must not follow the receipt onto the paper. */
  .till { display: block !important; }
}
`

const METHOD = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit', EXCHANGE: 'Exchange credit' }

const s = {
  page: { height: '100%', overflow: 'auto', background: 'var(--bg)' },
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  next: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  sheet: {
    width: '80mm', margin: '16px auto', padding: '10px 12px', background: '#fff',
    border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.45,
    fontFamily: 'ui-monospace, Consolas, monospace'
  },
  centre: { textAlign: 'center' },
  duplicate: {
    textAlign: 'center', fontWeight: 700, letterSpacing: 1,
    border: '1px solid #111', padding: '3px 0', marginBottom: 6
  },
  line: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  muted: { color: '#555', fontSize: 11 },
  pending: { fontSize: 10 }
}
