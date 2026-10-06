import { cloneElement, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { loadItems, saveItem, rupees, messageFor } from '../lib/api.js'

/**
 * The owner's item list, and the form that adds to it. POS-STAND-003.
 *
 * A shop that does not use Inventory had no way to put an item in the till except a spreadsheet,
 * which is a strange thing to ask of someone who wants to sell one saree. This is that spreadsheet,
 * one row at a time, and it goes through the same checks -- so a price typed here and a price
 * uploaded cannot be validated differently.
 *
 * ONE CODE, ONE ITEM. Typing a code that is already there corrects it rather than being refused:
 * correcting a price is the second most common reason to open this screen, and sending someone to
 * a spreadsheet to fix a typo is how they stop using the till.
 *
 * SWITCHED-OFF ITEMS ARE SHOWN. They are the ones somebody came here to fix. The sell screen is the
 * place that hides them.
 */

const EMPTY = { code: '', name: '', price: '', gst: '5', hsn: '', barcode: '', qty: '', colour: '', size: '' }

export default function Items() {
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['items', q],
    queryFn: () => loadItems(q)
  })

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const saved = await saveItem({
        ...form,
        // Blank means "not given", not "empty": the server leaves out what it was not sent, so a
        // correction that mentions only the price keeps the HSN and the barcode.
        ...Object.fromEntries(Object.entries(form).filter(([, v]) => String(v).trim() !== ''))
      })
      toast.success(saved.added ? `${saved.item.name} added.` : `${saved.item.name} updated.`)
      ;(saved.notes ?? []).forEach(n => toast(n, { duration: 6000 }))
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['items'] })
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p style={s.muted}>Loading…</p>
  if (isError) return <p style={s.bad}>{messageFor(error)}</p>

  /*
   * A shop connected to Inventory gets its items from there. Showing a form that can only ever be
   * refused is worse than showing none, so this says where to go instead.
   */
  if (data.fromInventory) {
    return (
      <div style={s.page}>
        <h1>Items</h1>
        <p style={s.muted}>
          This shop’s items come from Inventory. Add and price them there, then press{' '}
          <Link to="/inventory-link">Refresh items from Inventory</Link>.
        </p>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.head}>
        <h1>Items</h1>
        {!form && (
          <button style={s.primary} onClick={() => setForm({ ...EMPTY })}>
            <Plus size={16} aria-hidden="true" /> Add item
          </button>
        )}
      </div>
      <p style={s.muted}>
        What this till can sell. {data.total} in all{data.shown < data.total ? `, showing ${data.shown}` : ''}.
        A code that is already here is corrected, not added twice.
      </p>

      {form && (
        <form onSubmit={submit} style={s.form} aria-label="Add item">
          <Field label="Code" hint="On the tag. A scan looks this up.">
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} autoFocus required />
          </Field>
          <Field label="Name" hint="As it should read on the bill.">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Price" hint="What the customer pays, tax included.">
            <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} inputMode="decimal" placeholder="1299" required />
          </Field>
          <Field label="GST %" hint="As your accountant has it. 5 for 5%.">
            <input value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} inputMode="numeric" required />
          </Field>
          <Field label="HSN" hint="Printed on every bill line.">
            <input value={form.hsn} onChange={e => setForm({ ...form, hsn: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="Barcode" hint="If the tag has one. It must be this shop’s own.">
            <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="How many" hint="A count to start from. The till takes pieces off as they sell.">
            <input value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="Colour"><input value={form.colour} onChange={e => setForm({ ...form, colour: e.target.value })} /></Field>
          <Field label="Size"><input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} /></Field>
          <div style={s.actions}>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button>
          </div>
        </form>
      )}

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Find by code, name or barcode"
        aria-label="Find an item"
        style={s.find}
      />

      {data.items.length === 0
        ? <p style={s.muted}>{q ? 'Nothing matches that.' : 'No items yet. Add one, or import a list on Connections.'}</p>
        : (
          <ul style={s.list} className="card-list">
            {data.items.map(i => (
              <li key={i.code} style={s.row}>
                <div style={s.detail}>
                  <b>{i.name}</b>
                  <span style={s.muted}>
                    {[i.code, i.colour, i.size].filter(Boolean).join(' · ')}
                    {i.hsn ? ` · HSN ${i.hsn}` : ''}
                    {i.barcode ? ` · ${i.barcode}` : ''}
                  </span>
                </div>
                <div style={s.right}>
                  <b>{rupees(i.pricePaise)}</b>
                  <span style={s.muted}>
                    {i.taxRate}% GST{i.qty === null || i.qty === undefined ? '' : ` · ${i.qty} left`}
                  </span>
                </div>
                {!i.active && <span className="chip warn">not on sale</span>}
                <button
                  style={s.small}
                  onClick={() => setForm({
                    ...EMPTY, ...i,
                    price: String(i.pricePaise / 100), gst: String(i.taxRate),
                    hsn: i.hsn ?? '', barcode: i.barcode ?? '', qty: i.qty ?? '',
                    colour: i.colour ?? '', size: i.size ?? ''
                  })}
                >
                  Change
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

/*
 * The hint is DESCRIBED, not part of the name. Inside the label it became part of the field's
 * accessible name -- "Code On the tag. A scan looks this up." -- which is a mouthful for anyone
 * using a screen reader and ambiguous for anything matching on names.
 */
function Field({ label, hint, children }) {
  const id = `f-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`
  return (
    <div style={s.field}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })}
      {hint && <span id={`${id}-hint`} style={s.hint}>{hint}</span>}
    </div>
  )
}

const s = {
  page: { padding: 16, display: 'grid', gap: 12, alignContent: 'start' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  muted: { color: 'var(--ink-soft)', fontSize: 14, margin: 0 },
  bad: { color: 'var(--bad)', margin: 16 },
  hint: { color: 'var(--ink-soft)', fontSize: 12 },
  form: {
    display: 'grid', gap: 12, padding: 16, background: 'var(--panel)',
    border: '1px solid var(--line)', borderRadius: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))'
  },
  field: { display: 'grid', gap: 4, fontSize: 14, fontWeight: 600 },
  actions: { gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' },
  primary: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  find: { width: '100%' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    padding: 12, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10
  },
  detail: { display: 'grid', gap: 2, flex: 1, minWidth: 180 },
  right: { display: 'grid', justifyItems: 'end', gap: 2 },
  small: { minHeight: 'var(--tap)' }
}
