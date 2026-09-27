import { useEffect, useMemo, useRef, useState } from 'react'
import { rupees } from '../lib/api.js'
import UpiQr from './UpiQr.jsx'

/**
 * WF-PAY-01. POS-PAY-001..010.
 *
 * Taking the money: cash, UPI, card, or any split across them.
 *
 * THE ONE THING THIS SCREEN MUST NOT DO is make a cashier ask a customer to pay twice. A UPI
 * transfer that has not reached the shop's phone yet may well have arrived, and a till with only
 * "paid" and "not paid" forces the cashier to either wave them off or ask again -- and asking
 * again is what makes a shop look like it is trying it on.
 *
 * So there is a third answer: "not confirmed yet". The sale completes, the customer leaves with
 * their saree, and the payment goes on a list to settle against the bank. Cash is deliberately
 * excluded from it -- cash is in the drawer or it is not, and the person holding it is standing
 * right there.
 *
 * The remaining figure drives everything. It starts as the whole bill, each row eats into it, and
 * Complete stays disabled until it is right -- the server checks the same thing, so this is a
 * courtesy rather than the control.
 *
 * THREE MODES, matching the server's:
 *
 *   EXACT    a normal sale: the whole bill, to the paisa
 *   ADVANCE  keeping goods for a customer: anything from nothing up to the bill (POS-ORD-002)
 *   COLLECT  money coming in later against a kept order: something, never more than is owed
 */
const LABELS = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit' }
const NEEDS_REFERENCE = ['UPI', 'CARD']

const COPY = {
  EXACT: { heading: 'To pay', confirm: 'Complete sale', remaining: 'Still to pay' },
  ADVANCE: { heading: 'Bill', confirm: 'Keep for customer', remaining: 'Balance they will owe' },
  COLLECT: { heading: 'Owed', confirm: 'Take payment', remaining: 'Still owed after this' }
}

export default function PaymentPanel({ totalPaise, enabledMethods, onCancel, onConfirm, mode = 'EXACT', creditPaise = 0, heading, upi }) {
  // POS-PAY-016. Store credit is offered only when this customer has some. The server takes it
  // from their live balance, so this figure is a guide and the server has the last word.
  const methods = [
    ...(enabledMethods?.length ? enabledMethods : ['CASH', 'UPI', 'CARD']).filter(m => LABELS[m] && m !== 'CREDIT'),
    ...(creditPaise > 0 ? ['CREDIT'] : [])
  ]
  const copy = COPY[mode] ?? COPY.EXACT

  // An advance starts EMPTY -- the cashier types what the customer is paying now. Defaulting it to
  // the whole bill would make a kept order silently fully paid whenever nobody noticed the field.
  const [rows, setRows] = useState(() => [blank(methods[0] ?? 'CASH', mode === 'ADVANCE' ? 0 : totalPaise)])
  const [saving, setSaving] = useState(false)
  const firstBox = useRef(null)

  useEffect(() => { firstBox.current?.focus() }, [])

  const allocated = rows.reduce((sum, r) => sum + (toPaise(r.amount) ?? 0), 0)
  const remaining = totalPaise - allocated

  // In ADVANCE mode a row left completely empty is simply "nothing paid now", not a mistake.
  const counted = mode === 'ADVANCE' ? rows.filter(r => String(r.amount ?? '').trim() !== '') : rows
  const creditUsed = rows.filter(r => r.method === 'CREDIT').reduce((sum, r) => sum + (toPaise(r.amount) ?? 0), 0)
  const problems = useMemo(() => rows.map(row => (
    mode === 'ADVANCE' && String(row.amount ?? '').trim() === '' ? null
      : row.method === 'CREDIT' && creditUsed > creditPaise
        ? `Only ${rupees(creditPaise)} of store credit is available.`
        : rowProblem(row)
  )), [rows, mode, creditUsed, creditPaise])

  const amountsFit =
    mode === 'EXACT' ? remaining === 0
    : mode === 'ADVANCE' ? remaining >= 0
    : allocated > 0 && remaining >= 0
  const canComplete = amountsFit && problems.every(p => !p) && !saving

  const update = (index, patch) =>
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  function addRow() {
    // A second row starts on a different method from the first, because a split across two cash
    // payments is not a thing anyone does.
    const used = new Set(rows.map(r => r.method))
    const next = methods.find(m => !used.has(m)) ?? methods[0]
    const amount = next === 'CREDIT' ? Math.min(Math.max(0, remaining), creditPaise) : Math.max(0, remaining)
    setRows(current => [...current, blank(next, amount)])
  }

  const removeRow = (index) => setRows(current => current.filter((_, i) => i !== index))

  async function confirm(event) {
    event.preventDefault()
    if (!canComplete) return
    setSaving(true)
    try {
      await onConfirm(counted.map(toPayment))
    } finally {
      // Stays open on failure, with everything typed still there. A save that failed must never
      // look like a sale that happened.
      setSaving(false)
    }
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label="Take payment">
      <form style={s.panel} onSubmit={confirm}>
        <div style={s.row}>
          <span>{heading ?? copy.heading}</span>
          <b style={s.big}>{rupees(totalPaise)}</b>
        </div>
        {mode === 'ADVANCE' && (
          <p style={s.muted}>
            Take whatever they are paying now — nothing is fine too. The rest is collected when they
            come for it.
          </p>
        )}

        {rows.map((row, index) => (
          <div key={index} style={s.block}>
            {rows.length > 1 && (
              <div style={s.blockHead}>
                <span style={s.muted}>Payment {index + 1}</span>
                <button type="button" style={s.remove} onClick={() => removeRow(index)}>Remove</button>
              </div>
            )}

            <div style={s.methods} role="group" aria-label="Payment method">
              {methods.map(method => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={row.method === method}
                  style={{ ...s.method, ...(row.method === method ? s.methodOn : null) }}
                  onClick={() => update(index, { method, unconfirmed: false, reference: '', tendered: '' })}
                >
                  {LABELS[method]}
                </button>
              ))}
            </div>

            <label style={s.label}>
              Amount
              <input
                ref={index === 0 ? firstBox : undefined}
                inputMode="decimal"
                value={row.amount}
                onChange={e => update(index, { amount: e.target.value })}
                aria-label={`Amount for payment ${index + 1}`}
              />
            </label>

            {row.method === 'CASH' && (
              <>
                <label style={s.label}>
                  Cash handed over
                  <input
                    inputMode="decimal"
                    value={row.tendered}
                    onChange={e => update(index, { tendered: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
                <div style={s.quick}>
                  {notesAbove(toPaise(row.amount) ?? 0).map(amount => (
                    <button key={amount} type="button"
                      onClick={() => update(index, { tendered: String(amount / 100) })}>
                      {rupees(amount)}
                    </button>
                  ))}
                  <button type="button" onClick={() => update(index, { tendered: row.amount })}>
                    Exact
                  </button>
                </div>
                {changeFor(row) > 0 && (
                  <div style={{ ...s.row, ...s.change }}>
                    <span>Change</span>
                    <b style={s.big}>{rupees(changeFor(row))}</b>
                  </div>
                )}
              </>
            )}

            {/* POS-PAY-012. With the shop's UPI ID set, a QR for exactly this row's amount. */}
            {row.method === 'UPI' && upi?.upiId && !row.unconfirmed && (
              <UpiQr upiId={upi.upiId} name={upi.name} amountPaise={toPaise(row.amount) ?? 0} note={upi.note} />
            )}

            {row.method === 'CREDIT' && (
              <p style={s.muted}>{rupees(creditPaise)} available. It comes off their balance when the sale is saved.</p>
            )}

            {NEEDS_REFERENCE.includes(row.method) && (
              <>
                <label style={s.label}>
                  {LABELS[row.method]} reference
                  <input
                    value={row.reference}
                    onChange={e => update(index, { reference: e.target.value })}
                    placeholder={row.unconfirmed ? 'Add it later' : 'Transaction or approval number'}
                    disabled={row.unconfirmed}
                  />
                </label>
                {/* The whole reason this phase exists. */}
                <label style={s.check}>
                  <input
                    type="checkbox"
                    checked={row.unconfirmed}
                    onChange={e => update(index, { unconfirmed: e.target.checked, reference: '' })}
                    style={s.checkbox}
                  />
                  <span>
                    <b>Not confirmed yet</b>
                    <div style={s.muted}>
                      The sale is saved and the customer can go. It goes on a list to check against
                      the bank — never ask them to pay again.
                    </div>
                  </span>
                </label>
              </>
            )}

            {problems[index] && <p style={s.problem}>{problems[index]}</p>}
          </div>
        ))}

        {remaining !== 0 && (
          <div style={{ ...s.row, ...s.remaining }}>
            <span>{remaining > 0 ? copy.remaining : 'Over by'}</span>
            <b>{rupees(Math.abs(remaining))}</b>
          </div>
        )}

        {remaining > 0 && rows.length < methods.length && (
          <button type="button" onClick={addRow}>Split — add another payment</button>
        )}

        <div style={s.actions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.confirm} disabled={!canComplete}>
            {saving ? 'Saving…' : copy.confirm}
          </button>
        </div>
      </form>
    </div>
  )
}

const blank = (method, amountPaise) => ({
  method,
  amount: amountPaise > 0 ? String(amountPaise / 100) : '',
  reference: '',
  tendered: '',
  unconfirmed: false
})

/** One sentence naming what is wrong with this row, or null. Mirrors the server's rules so the
 * cashier finds out before pressing Complete, not after. */
function rowProblem(row) {
  const amount = toPaise(row.amount)
  if (amount === null || amount <= 0) return 'Enter an amount.'
  if (row.method === 'CASH') {
    const tendered = toPaise(row.tendered)
    if (tendered !== null && tendered < amount) return 'That is less than the amount being paid.'
    return null
  }
  if (row.method === 'CREDIT') return null
  if (!row.unconfirmed && !row.reference.trim()) {
    return `Add the ${LABELS[row.method]} reference, or tick "not confirmed yet".`
  }
  return null
}

function toPayment(row) {
  const amountPaise = toPaise(row.amount) ?? 0
  const tenderedPaise = toPaise(row.tendered)
  return {
    method: row.method,
    amountPaise,
    ...(row.method === 'CASH' && tenderedPaise !== null ? { tenderedPaise } : {}),
    ...(NEEDS_REFERENCE.includes(row.method) && row.reference.trim() ? { reference: row.reference.trim() } : {}),
    ...(NEEDS_REFERENCE.includes(row.method) && row.unconfirmed ? { unconfirmed: true } : {})
  }
}

function changeFor(row) {
  const amount = toPaise(row.amount)
  const tendered = toPaise(row.tendered)
  if (amount === null || tendered === null) return 0
  return Math.max(0, tendered - amount)
}

/** Rupees typed by a person to integer paise. Null for anything that is not a number, so the
 * caller can tell "nothing typed yet" from "zero". */
function toPaise(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** The notes a customer actually hands over: the next 100, 500 and 2,000 above the amount. */
function notesAbove(amountPaise) {
  const out = []
  for (const note of [10000, 50000, 200000]) {
    const up = Math.ceil(amountPaise / note) * note
    if (up > amountPaise && !out.includes(up)) out.push(up)
  }
  return out.slice(0, 3)
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(16,24,14,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    // Long splits on a short phone must still reach the Complete button.
    overflow: 'auto'
  },
  panel: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20, boxShadow: 'var(--shadow-lift)',
    padding: 20, width: 430, maxWidth: '100%', maxHeight: '100%', overflow: 'auto',
    display: 'grid', gap: 12, alignContent: 'start'
  },
  row: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  big: { fontSize: 28, fontWeight: 700 },
  block: {
    display: 'grid', gap: 10, padding: 12, border: '1px solid var(--line)', borderRadius: 10
  },
  blockHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  remove: { minHeight: 36, padding: '0 10px', fontSize: 13, fontWeight: 400 },
  methods: { display: 'flex', gap: 6 },
  method: { flex: 1, minHeight: 48 },
  methodOn: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  quick: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  change: { borderTop: '1px solid var(--line)', paddingTop: 10 },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' },
  checkbox: { width: 22, height: 22, minHeight: 22, marginTop: 2, flex: '0 0 auto' },
  remaining: { color: 'var(--warn)', fontWeight: 600 },
  problem: { margin: 0, color: 'var(--bad)', fontSize: 13 },
  muted: { color: 'var(--ink-soft)', fontSize: 12, fontWeight: 400 },
  /*
   * STICKY. A three-way split on a phone makes the panel taller than the screen, and measuring it
   * showed Complete sitting below the fold -- a cashier scrolls looking for the button and, worse,
   * may decide the till is stuck. MASTER.md §19 asks for a sticky primary action on phone; it
   * costs nothing on a counter machine where the panel never scrolls anyway.
   */
  actions: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    position: 'sticky', bottom: -20, background: 'var(--panel)',
    paddingTop: 10, marginTop: -2,
    borderTop: '1px solid var(--line)'
  },
  confirm: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
}
