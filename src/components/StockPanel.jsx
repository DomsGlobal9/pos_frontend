import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { moveStock, loadStockBook, messageFor } from '../lib/api.js'

/**
 * One item's stock, for a shop without Inventory (28 Oct): a parcel came in, some were damaged or found,
 * or the shelf was counted. Every change is kept with who and why, shown below as the item's stock book.
 * Sales and returns move the count by themselves; they are on their bills.
 */
const REASONS = [
  ['DAMAGED', 'Damaged'], ['LOST', 'Lost or stolen'], ['FOUND', 'Found'], ['TO_SUPPLIER', 'Sent back to the supplier'], ['OTHER', 'Other']
]
const KIND = { RECEIVED: 'Received', ADJUSTED: 'Adjusted', COUNTED: 'Counted', OPENING: 'Starting count', ITEM_FORM: 'Changed on the item form' }
const when = d => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function StockPanel({ item }) {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState('RECEIVED')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('DAMAGED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { data: book } = useQuery({ queryKey: ['stock-book', item.code], queryFn: () => loadStockBook(item.code) })
  const now = book?.qty ?? item.qty
  const n = qty.trim() === '' ? null : Number(qty)
  const valid = n !== null && Number.isInteger(n) && (kind === 'COUNTED' ? n >= 0 : n > 0) && (reason !== 'OTHER' || kind !== 'ADJUSTED' || note.trim())

  async function save(e) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      const out = await moveStock(item.code, { kind, qty: n, ...(kind === 'ADJUSTED' ? { reason } : {}), ...(note.trim() ? { note: note.trim() } : {}) })
      toast.success(`${out.name}: now ${out.qty} left (${out.delta >= 0 ? '+' : ''}${out.delta}).`)
      if (out.note) toast(out.note, { duration: 6000 })
      setQty(''); setNote('')
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['stock-book', item.code] })
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  const diff = kind === 'COUNTED' && n !== null && Number.isInteger(n) && now !== null && now !== undefined ? n - now : null

  return (
    <div style={s.wrap} role="region" aria-label={`Stock for ${item.name}`}>
      <div style={s.tabs} role="radiogroup" aria-label="What happened">
        {[['RECEIVED', 'Received'], ['ADJUSTED', 'Damaged / lost / found'], ['COUNTED', 'Counted']].map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} style={kind === k ? s.on : undefined}>{label}</button>
        ))}
      </div>
      <form onSubmit={save} style={s.form}>
        {kind === 'ADJUSTED' && (
          <label style={s.label}>
            Why
            <select value={reason} onChange={e => setReason(e.target.value)} aria-label="Why">
              {REASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
        )}
        <label style={s.label}>
          {kind === 'RECEIVED' ? 'How many came in' : kind === 'COUNTED' ? 'How many are on the shelf' : reason === 'FOUND' ? 'How many found' : 'How many pieces'}
          <input value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" aria-label="Pieces" />
        </label>
        <label style={{ ...s.label, flex: 2 }}>
          {kind === 'RECEIVED' ? 'Note (supplier, bill number)' : kind === 'ADJUSTED' && reason === 'OTHER' ? 'Why, in a few words' : 'Note'}
          <input value={note} onChange={e => setNote(e.target.value.slice(0, 200))} aria-label="Note" />
        </label>
        <button type="submit" style={s.primary} disabled={!valid || busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
      <p style={s.muted}>
        {kind === 'ADJUSTED' && (reason === 'FOUND' ? 'Found pieces are added to the count.' : 'These pieces are taken off the count.')}
        {kind === 'COUNTED' && (diff === null ? 'The till sets the count to what you counted, and keeps the difference in the book.' : diff === 0 ? 'Same as the till has.' : `That is ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than the till has (${now}).`)}
        {kind === 'RECEIVED' && `Now ${now ?? 'not counted'}${n ? `; after this, ${(now ?? 0) + n}` : ''}.`}
      </p>

      <b style={{ fontSize: 14 }}>Stock book</b>
      {!book ? <p style={s.muted}>Loading…</p> : book.moves.length === 0
        ? <p style={s.muted}>No changes by hand yet. Sales and returns move the count by themselves.</p>
        : (
          <ul style={s.book} aria-label="Stock book">
            {book.soldSinceLastChange > 0 && <li style={s.muted}>{book.soldSinceLastChange} sold since the last change below.</li>}
            {book.moves.map((m, i) => (
              <li key={i} style={s.move}>
                <span style={{ ...s.delta, color: m.delta < 0 ? 'var(--bad)' : 'var(--good, #15803d)' }}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
                <span style={{ flex: 1 }}>
                  <b>{KIND[m.kind] ?? m.kind}</b>{m.reasonLabel ? ` · ${m.reasonLabel}` : ''}{m.note ? ` · ${m.note}` : ''}
                  <div style={s.muted}>{when(m.at)} · {m.qtyBefore ?? '—'} → {m.qtyAfter}{m.by ? ` · ${m.by}` : ''}</div>
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

const s = {
  wrap: { flexBasis: '100%', display: 'grid', gap: 8, paddingTop: 8, borderTop: '1px solid var(--line)' },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  on: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  form: { display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' },
  label: { display: 'grid', gap: 4, fontSize: 13, color: 'var(--ink-soft)', flex: 1, minWidth: 140 },
  primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', minHeight: 'var(--tap)' },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 },
  book: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' },
  move: { display: 'flex', gap: 10, alignItems: 'start', fontSize: 14 },
  delta: { fontWeight: 700, minWidth: 40, textAlign: 'right' }
}
