import { useEffect, useRef, useState } from 'react'

/**
 * Keeping the goods for a customer: when they will collect, and what to remember. POS-ORD-004, -005.
 *
 * The step before the advance. Two fields and a customer's name at the top, so the cashier can see
 * who this is being kept for before they take any money.
 *
 * The date is optional. "She will come when the blouse is ready" is a real answer, and forcing a
 * made-up date just teaches cashiers to put tomorrow on everything -- which then makes every order
 * look overdue by Wednesday.
 */
export default function KeepSheet({ customer, onNext, onCancel }) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const noteBox = useRef(null)

  useEffect(() => { noteBox.current?.focus() }, [])

  const today = new Date()
  const min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function next(event) {
    event.preventDefault()
    onNext({
      // Midday rather than midnight, so the date survives a timezone conversion on the way to the
      // server without turning into the day before.
      ...(date ? { promisedAt: new Date(`${date}T12:00:00`).toISOString() } : {}),
      ...(note.trim() ? { note: note.trim() } : {})
    })
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label="Keep for customer">
      <form style={s.panel} onSubmit={next}>
        <div>
          <b style={s.title}>Keep for {customer?.name || customer?.phoneDisplay || 'customer'}</b>
          <p style={s.muted}>The goods stay in the shop until they come for them.</p>
        </div>

        <label style={s.label}>
          What needs doing
          <input
            ref={noteBox}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Fall and pico, blouse to be stitched…"
            maxLength={280}
            aria-label="Note"
          />
        </label>

        <label style={s.label}>
          Collect on
          <input
            type="date"
            min={min}
            value={date}
            onChange={e => setDate(e.target.value)}
            aria-label="Collection date"
          />
          <span style={s.muted}>Leave empty if they will come when it is ready.</span>
        </label>

        <div style={s.actions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.confirm}>Next: advance</button>
        </div>
      </form>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
  },
  panel: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12,
    padding: 20, width: 430, maxWidth: '100%', display: 'grid', gap: 14
  },
  title: { fontSize: 17 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  confirm: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
