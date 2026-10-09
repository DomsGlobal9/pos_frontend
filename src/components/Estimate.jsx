import { rupees } from '../lib/api.js'
import { lineTotal, offerOn, unitPrice } from '../lib/basket.js'
import { waLink } from '../lib/whatsapp.js'
import useEscape from '../lib/useEscape.js'

/**
 * An ESTIMATE of the basket on the till -- "what would these come to?" -- on paper, before anyone
 * decides. Not a bill: no invoice number, no stock moved, no tax document, nothing saved. The same
 * prices, offers and discount the till would charge right now, and a date it is good until, because
 * prices and offers change. To keep the basket itself for later, park it; that already exists.
 *
 * Printed on the till's own receipt paper with the same print rules as a bill.
 */
const VALID_DAYS = 7

export default function Estimate({ shop, lines, totals, offers, customer, onClose }) {
  useEscape(onClose)
  const today = new Date()
  const until = new Date(today.getTime() + VALID_DAYS * 86_400_000)
  const day = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={s.backdrop} role="dialog" aria-label="Estimate">
      {/* Only the paper prints, 80 mm wide like a bill -- not the till behind it. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          .estimate-print, .estimate-print * { visibility: visible !important; }
          .estimate-print { position: absolute; left: 0; top: 0; width: 80mm; }
        }
      `}</style>
      <div style={s.panel}>
        <div className="no-print" style={s.bar}>
          <b>Estimate</b>
          <span style={{ flex: 1 }} />
          <button onClick={() => window.print()} style={s.primary}>Print</button>
          {(() => {
            const href = customer && waLink(customer.phone,
              `Estimate from ${shop?.shopName ?? 'the shop'}, valid until ${day(until)}:\n` +
              lines.map(l => `${l.qty} x ${[l.name, l.colour, l.size].filter(Boolean).join(', ')} - ${rupees(lineTotal(l, offers))}`).join('\n') +
              `\nEstimated total ${rupees(totals.totalPaise)} (incl. all taxes). Not a bill.`)
            return href ? <a href={href} target="_blank" rel="noreferrer">WhatsApp</a> : null
          })()}
          <button onClick={onClose}>Close</button>
        </div>

        <div className="receipt estimate-print" style={s.sheet}>
          <div style={s.centre}>
            <b style={{ fontSize: 14 }}>{shop?.shopName ?? 'Shop'}</b>
            {shop?.address && <div style={{ whiteSpace: 'pre-line' }}>{shop.address}</div>}
          </div>
          <hr style={s.rule} />
          <div style={{ ...s.centre, fontWeight: 700, letterSpacing: '0.04em' }}>ESTIMATE — NOT A BILL</div>
          <div style={s.line}><span>Date</span><span>{day(today)}</span></div>
          <div style={s.line}><span>Valid until</span><span>{day(until)}</span></div>
          {customer && <div style={s.line}><span>For</span><span>{customer.name || customer.phoneDisplay}</span></div>}
          <hr style={s.rule} />
          {lines.map(l => (
            <div key={l.id} style={{ marginBottom: 4 }}>
              <div>{[l.name, l.colour, l.size].filter(Boolean).join(', ')}</div>
              <div style={s.line}>
                <span style={s.muted}>
                  {l.qty} × {rupees(unitPrice(l))}{offerOn(l, offers) > 0 ? ` · offer −${rupees(offerOn(l, offers))}` : ''}
                </span>
                <b>{rupees(lineTotal(l, offers))}</b>
              </div>
            </div>
          ))}
          <hr style={s.rule} />
          {totals.offersPaise > 0 && <div style={s.line}><span>Offers</span><span>−{rupees(totals.offersPaise)}</span></div>}
          {totals.discountPaise > 0 && <div style={s.line}><span>Discount</span><span>−{rupees(totals.discountPaise)}</span></div>}
          {totals.roundOffPaise !== 0 && <div style={s.line}><span>Round off</span><span>{rupees(totals.roundOffPaise)}</span></div>}
          <div style={{ ...s.line, fontSize: 15 }}><b>Estimated total</b><b>{rupees(totals.totalPaise)}</b></div>
          <hr style={s.rule} />
          <div style={{ ...s.centre, fontSize: 11 }}>
            Prices include all taxes. This is an estimate, not a bill; prices and offers may change after {day(until)}.
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 },
  panel: { background: 'var(--panel)', borderRadius: 14, padding: 16, display: 'grid', gap: 12, maxHeight: '90vh', overflow: 'auto', width: 'min(420px, 100%)' },
  bar: { display: 'flex', gap: 8, alignItems: 'center' },
  primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  sheet: { background: '#fff', color: '#000', padding: 12, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 },
  centre: { textAlign: 'center' },
  line: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  muted: { color: '#555' },
  rule: { border: 0, borderTop: '1px dashed #999', margin: '6px 0' }
}
