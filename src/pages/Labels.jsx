import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Plus, X } from 'lucide-react'
import { loadItems, rupees, messageFor } from '../lib/api.js'
import { code128Svg, encodable } from '../lib/code128.js'

/**
 * Barcode labels for new stock: pick the items, say how many of each, print.
 *
 * Two sheets, because shops have one or the other: a label printer's roll (50 x 25 mm, the common
 * thermal size) or plain A4 label paper, 3 across and 8 down. The barcode is the item's own barcode
 * when it has one, else its code -- whichever the till's scan looks up. Code 128, drawn by
 * lib/code128.js and proven against the camera scanner's own reader.
 *
 * The price is printed as MRP, inclusive of all taxes, because that is how a price on a garment tag
 * has to read in India -- and it is true of all three kinds of shop: the till's prices include GST.
 */

const LAYOUTS = {
  ROLL: { label: 'Label printer (50 × 25 mm)', page: '50mm 25mm', cols: 1, w: '50mm', h: '25mm' },
  A4: { label: 'A4 sheet (3 × 8)', page: 'A4', cols: 3, w: '70mm', h: '37mm' }
}

export default function Labels() {
  const { shop } = useOutletContext() ?? {}
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState([])
  const [layout, setLayout] = useState('ROLL')

  const { data, isLoading, error } = useQuery({ queryKey: ['items', q], queryFn: () => loadItems(q), enabled: q.trim().length > 0 })

  const valueOf = (i) => (i.barcode && encodable(i.barcode) ? i.barcode : i.code)
  const add = (item) => setPicked(cur => cur.some(p => p.item.code === item.code) ? cur : [...cur, { item, qty: 1 }])
  const setQty = (code, qty) => setPicked(cur => cur.map(p => (p.item.code === code ? { ...p, qty: Math.max(0, Math.min(500, qty)) } : p)))

  const labels = useMemo(() => picked.flatMap(p => (encodable(valueOf(p.item)) ? Array.from({ length: p.qty }, () => p.item) : [])), [picked])
  const L = LAYOUTS[layout]

  return (
    <div style={s.page}>
      {/* Only the sheet prints, at the size of the paper it is going on. */}
      <style>{`
        .label svg { width: 100%; height: 100%; display: block; }
        @media print {
          @page { size: ${L.page}; margin: ${layout === 'A4' ? '10mm 5mm' : '0'}; }
          body * { visibility: hidden !important; }
          .label-sheet, .label-sheet * { visibility: visible !important; }
          .label-sheet { position: absolute; left: 0; top: 0; }
        }
      `}</style>

      <div className="no-print" style={s.head}>
        <h1 style={{ margin: 0 }}>Labels</h1>
        <Link to="/items" style={s.muted}>← Items</Link>
      </div>

      <section className="no-print" style={s.card}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find by code, name or barcode" aria-label="Find an item to label" />
        {isLoading && <p style={s.muted}>Looking…</p>}
        {error && <p style={s.bad}>{messageFor(error)}</p>}
        {data?.items?.length > 0 && (
          <ul style={s.list}>
            {data.items.slice(0, 20).map(i => (
              <li key={i.code} style={s.row}>
                <span style={{ flex: 1 }}>
                  <b>{i.name}</b>
                  <span style={s.muted}> {[i.colour, i.size, i.code].filter(Boolean).join(' · ')} · {rupees(i.pricePaise)}</span>
                </span>
                <button onClick={() => add(i)} aria-label={`Add ${i.name} to the labels`}><Plus size={14} aria-hidden="true" /> Add</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {picked.length > 0 && (
        <section className="no-print" style={s.card} aria-label="Labels to print">
          {picked.map(p => (
            <div key={p.item.code} style={s.row}>
              <span style={{ flex: 1 }}>
                <b>{p.item.name}</b> <span style={s.muted}>{valueOf(p.item)}</span>
                {!encodable(valueOf(p.item)) && <span style={s.bad}> — this code has characters a barcode cannot hold; give it a plain code in Items.</span>}
              </span>
              <label style={s.muted}>How many
                <input type="number" min="0" max="500" value={p.qty} onChange={e => setQty(p.item.code, Number(e.target.value))}
                  aria-label={`How many labels for ${p.item.name}`} style={{ width: 80, marginLeft: 6 }} />
              </label>
              <button onClick={() => setPicked(cur => cur.filter(x => x.item.code !== p.item.code))} aria-label={`Remove ${p.item.name}`}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          <div style={s.row}>
            <div role="radiogroup" aria-label="Label paper" style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              {Object.entries(LAYOUTS).map(([k, v]) => (
                <button key={k} role="radio" aria-checked={layout === k} style={layout === k ? s.primary : undefined} onClick={() => setLayout(k)}>{v.label}</button>
              ))}
            </div>
            <button style={s.primary} disabled={labels.length === 0} onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Print {labels.length} {labels.length === 1 ? 'label' : 'labels'}
            </button>
          </div>
        </section>
      )}

      {labels.length > 0 && (
        <div className="label-sheet" data-layout={layout}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${L.cols}, ${L.w})`, gap: layout === 'A4' ? '0 0' : 0, background: '#fff' }}>
          {labels.map((item, n) => (
            <div key={`${item.code}-${n}`} className="label" style={{ ...s.label, width: L.w, height: L.h }}>
              <div style={s.shopName}>{shop?.shop?.shopName ?? ''}</div>
              <div style={s.itemName}>{item.name}</div>
              <div style={s.small}>{[item.colour, item.size].filter(Boolean).join(' · ')}</div>
              <div style={s.bars} aria-label={`Barcode ${valueOf(item)}`} dangerouslySetInnerHTML={{ __html: code128Svg(valueOf(item)) }} />
              <div style={s.code}>{valueOf(item)}</div>
              <div style={s.mrp}>MRP {rupees(item.pricePaise)} <span style={s.small}>(incl. of all taxes)</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: 20, display: 'grid', gap: 14, alignContent: 'start', maxWidth: 900 },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 14, background: 'var(--panel)', border: '1px solid var(--line)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 13 },
  bad: { color: 'var(--bad)', fontSize: 13 },
  primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  label: { boxSizing: 'border-box', padding: '1.5mm 2mm', overflow: 'hidden', color: '#000', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px dashed #ccc' },
  shopName: { fontSize: '6pt', textTransform: 'uppercase', letterSpacing: '0.05em' },
  itemName: { fontSize: '8pt', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  small: { fontSize: '6pt' },
  bars: { height: '8mm', width: '100%' },
  code: { fontSize: '6.5pt', textAlign: 'center', letterSpacing: '0.04em' },
  mrp: { fontSize: '8pt', fontWeight: 700 }
}
