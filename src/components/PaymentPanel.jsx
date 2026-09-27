import { useEffect, useRef, useState } from 'react'
import { rupees } from '../lib/api.js'

/**
 * Taking the money.
 *
 * Cash only for now -- UPI, card and splitting across them are step 3. What is already right here
 * is the part that loses real money when it is wrong: CHANGE DUE, calculated and shown large,
 * rather than worked out in someone's head with a queue waiting.
 *
 * The amount handed over is typed in rupees because that is what a cashier says out loud, and
 * converted to paise on the way out. Nothing downstream ever sees a rupee figure.
 */
export default function PaymentPanel({ totalPaise, onCancel, onConfirm }) {
  const [tendered, setTendered] = useState('')
  const [saving, setSaving] = useState(false)
  const box = useRef(null)

  useEffect(() => { box.current?.focus() }, [])

  const tenderedPaise = toPaise(tendered)
  const enough = tenderedPaise !== null && tenderedPaise >= totalPaise
  const change = enough ? tenderedPaise - totalPaise : 0

  async function confirm(event) {
    event.preventDefault()
    if (!enough || saving) return
    setSaving(true)
    try {
      await onConfirm({ method: 'CASH', amountPaise: totalPaise, tenderedPaise })
    } finally {
      // Stays open on failure, with the basket and the typed amount intact. A save that failed
      // must never look like a sale that happened.
      setSaving(false)
    }
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label="Take payment">
      <form style={s.panel} onSubmit={confirm}>
        <div style={s.row}>
          <span>To pay</span>
          <b style={s.big}>{rupees(totalPaise)}</b>
        </div>

        <label style={s.label}>
          Cash handed over
          <input
            ref={box}
            inputMode="decimal"
            value={tendered}
            onChange={e => setTendered(e.target.value)}
            placeholder="0"
          />
        </label>

        <div style={s.quick}>
          {quickAmounts(totalPaise).map(amount => (
            <button key={amount} type="button" onClick={() => setTendered(String(amount / 100))}>
              {rupees(amount)}
            </button>
          ))}
          <button type="button" onClick={() => setTendered(String(totalPaise / 100))}>Exact</button>
        </div>

        <div style={{ ...s.row, ...s.change }}>
          <span>Change</span>
          <b style={s.big}>{rupees(change)}</b>
        </div>

        {tendered && !enough && (
          <p style={s.short}>That is less than the bill. Take {rupees(totalPaise - (tenderedPaise ?? 0))} more.</p>
        )}

        <div style={s.actions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.confirm} disabled={!enough || saving}>
            {saving ? 'Saving…' : 'Complete sale'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Rupees typed by a person to integer paise. Null for anything that is not a number, so the
 * caller can tell "nothing typed yet" from "zero". */
function toPaise(text) {
  const trimmed = String(text).trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** The notes a customer actually hands over: the next 100, 500 and 2,000 above the bill. */
function quickAmounts(totalPaise) {
  const out = []
  for (const note of [10000, 50000, 200000]) {
    const up = Math.ceil(totalPaise / note) * note
    if (up > totalPaise && !out.includes(up)) out.push(up)
  }
  return out.slice(0, 3)
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
  },
  panel: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12,
    padding: 20, width: 420, maxWidth: '100%', display: 'grid', gap: 14
  },
  row: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  big: { fontSize: 30, fontWeight: 700 },
  change: { borderTop: '1px solid var(--line)', paddingTop: 12 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  quick: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  short: { margin: 0, color: 'var(--bad)', fontSize: 13 },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  confirm: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
