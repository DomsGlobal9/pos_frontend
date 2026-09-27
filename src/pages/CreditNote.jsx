import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadCreditNote, rupees, messageFor } from '../lib/api.js'

/**
 * The credit note. POS-RET-006, WF-RETURN-01 success.
 *
 * Printed on the same 80 mm paper as a bill, because it goes home with the customer the same way.
 * It carries what a GST credit note has to: the shop, its own number from its own series, the
 * original invoice it reverses, each line with its HSN and the tax taken back, and how the money
 * went back. Everything is read from what was saved -- nothing is worked out again here.
 */
const HOW = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', STORE_CREDIT: 'Store credit', EXCHANGE: 'Put towards the new bill'
}

export default function CreditNote() {
  const { id } = useParams()
  const { data: note, isLoading, isError, error } = useQuery({
    queryKey: ['credit-note', id],
    queryFn: () => loadCreditNote(id)
  })

  if (isLoading) return <p style={s.state}>Opening the credit note…</p>
  if (isError) {
    return (
      <div style={s.state}>
        <p style={s.bad}>{messageFor(error)}</p>
        <Link to="/bills" style={s.back}>Back to bills</Link>
      </div>
    )
  }

  const shop = note.shop ?? {}
  const cgst = note.lines.reduce((n, l) => n + l.cgstPaise, 0)
  const sgst = note.lines.reduce((n, l) => n + l.sgstPaise, 0)
  const igst = note.lines.reduce((n, l) => n + l.igstPaise, 0)

  return (
    <div style={s.page}>
      <style>{PRINT_CSS}</style>

      <div style={s.bar} className="no-print">
        <div>
          <b>{note.creditNoteNo}</b>
          <div style={s.soft}>
            {rupees(note.totalPaise)} back · {new Date(note.createdAt).toLocaleString('en-IN')}
          </div>
        </div>
        <button onClick={() => window.print()}>Print</button>
      </div>

      <div style={s.links} className="no-print">
        <Link to={`/bills/${note.originalSale.id}`} style={s.back}>← Bill {note.originalSale.invoiceNo}</Link>
        {note.exchangeSale && (
          <Link to={`/bills/${note.exchangeSale.id}`} style={s.newBill}>
            New bill {note.exchangeSale.invoiceNo} →
          </Link>
        )}
      </div>

      {note.customer && note.refunds.some(r => r.method === 'STORE_CREDIT') && (
        <p style={s.credit} className="no-print">
          {note.customer.name || note.customer.phoneMasked} now has {rupees(note.customer.storeCreditPaise)} of
          store credit.
        </p>
      )}

      <div style={s.sheet} className="receipt">
        <div style={s.centre}>
          <b style={{ fontSize: 14 }}>{shop.shopName ?? 'Shop'}</b>
          {shop.address && <div>{shop.address}</div>}
          {shop.gstin && <div>GSTIN {shop.gstin}</div>}
        </div>
        <Rule />
        <div style={s.centre}><b>CREDIT NOTE</b></div>
        <div style={s.line}><span>No.</span><b>{note.creditNoteNo}</b></div>
        <div style={s.line}><span>Date</span><span>{new Date(note.createdAt).toLocaleString('en-IN')}</span></div>
        <div style={s.line}><span>Against bill</span><span>{note.originalSale.invoiceNo}</span></div>
        <div style={s.line}>
          <span>Bill date</span><span>{new Date(note.originalSale.createdAt).toLocaleDateString('en-IN')}</span>
        </div>
        {note.cashier?.name && <div style={s.line}><span>By</span><span>{note.cashier.name}</span></div>}
        {note.approvedBy && <div style={s.line}><span>Approved by</span><span>{note.approvedBy}</span></div>}
        {note.customer && (
          <div style={s.line}>
            <span>Customer</span>
            <span>{note.customer.name ? `${note.customer.name} ` : ''}{note.customer.phoneMasked}</span>
          </div>
        )}
        <div>Reason: {note.reason}</div>

        <Rule />

        {note.lines.map(line => (
          <div key={line.saleLineId} style={{ marginBottom: 4 }}>
            <div>{line.description}</div>
            <div style={s.line}>
              <span style={s.soft}>
                {line.qty} returned{line.hsn ? ` · HSN ${line.hsn}` : ''} · GST {line.taxRate}%
              </span>
              <span>{rupees(line.amountPaise)}</span>
            </div>
          </div>
        ))}

        <Rule />

        <div style={s.line}><span>Taxable value</span><span>{rupees(note.totalPaise - note.roundOffPaise - note.taxPaise)}</span></div>
        {igst > 0 ? (
          <div style={s.line}><span>IGST reversed</span><span>{rupees(igst)}</span></div>
        ) : note.taxPaise > 0 && (
          <>
            <div style={s.line}><span>CGST reversed</span><span>{rupees(cgst)}</span></div>
            <div style={s.line}><span>SGST reversed</span><span>{rupees(sgst)}</span></div>
          </>
        )}
        {note.roundOffPaise !== 0 && (
          <div style={s.line}><span>Round off</span><span>{rupees(note.roundOffPaise)}</span></div>
        )}
        <Rule />
        <div style={{ ...s.line, fontSize: 15 }}><b>Total</b><b>{rupees(note.totalPaise)}</b></div>

        {note.refunds.map((r, i) => (
          <div key={i} style={s.line}>
            <span>{HOW[r.method] ?? r.method}{r.reference ? ` · ${r.reference}` : ''}</span>
            <span>{rupees(r.amountPaise)}</span>
          </div>
        ))}
        {note.exchangeSale && (
          <div style={s.soft}>New bill {note.exchangeSale.invoiceNo}</div>
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
  .receipt { width: 80mm; margin: 0; padding: 4mm 3mm; border: none; font-size: 11px; }
}
`

const s = {
  page: { height: '100%', overflow: 'auto', background: 'var(--bg)' },
  state: { padding: 16, display: 'grid', gap: 12, justifyItems: 'start' },
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 16px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
  },
  links: { padding: '10px 16px 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  back: { color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 14 },
  newBill: { color: 'var(--accent)', textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  credit: { margin: '10px 16px 0', fontSize: 14 },
  sheet: {
    width: '80mm', maxWidth: 'calc(100% - 32px)', margin: '16px auto', padding: '10px 12px', background: '#fff',
    border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.45,
    fontFamily: 'ui-monospace, Consolas, monospace', color: '#111'
  },
  centre: { textAlign: 'center' },
  line: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  soft: { color: '#555', fontSize: 11 },
  bad: { color: 'var(--bad)', margin: 0 }
}
