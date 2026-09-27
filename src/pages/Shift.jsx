import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadShift, openShift, moveCash, closeShift, rupees, messageFor } from '../lib/api.js'
import { newOnceKey } from '../lib/basket.js'
import ApprovalSheet from '../components/ApprovalSheet.jsx'

/**
 * WF-SHIFT-01 and WF-CASH-01. POS-SHIFT-001..009.
 *
 * One drawer, from counting the float in to counting the takings out.
 *
 * THE CLOSE IS A BLIND COUNT. The person closing types what they counted BEFORE the till says what
 * it expected. If it does not match, they can count again or say what happened -- but they are not
 * told the figure to aim for, because then the count is a copy. Every mismatched count is kept in
 * the audit trail, so a drawer that took five tries is visible to the owner.
 *
 * A cashier does not see the expected figure while the shift is open, for the same reason. A
 * manager does. Once a shift is closed, its difference is shown to everyone -- that is the point.
 */
export default function Shift() {
  const { shop } = useOutletContext() ?? {}
  const counter = shop?.counters?.[0]
  const queryClient = useQueryClient()
  const [cash, setCash] = useState(null)       // 'IN' | 'OUT'
  const [closing, setClosing] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['shift', counter?.id],
    queryFn: () => loadShift(counter.id),
    enabled: !!counter
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shift'] })
    queryClient.invalidateQueries({ queryKey: ['home'] })
  }

  if (!counter) return <p style={s.state}>Loading the till…</p>
  if (isLoading) return <p style={s.state}>Loading the drawer…</p>
  if (isError) return <p style={{ ...s.state, ...s.bad }}>{messageFor(error)}</p>

  const shift = data.open

  return (
    <div style={s.page}>
      <h1 style={s.title}>Shift · {data.counter.name}</h1>

      {!shift && <OpenForm counterId={counter.id} suggested={data.suggestedOpeningPaise} onOpened={refresh} />}

      {shift && (
        <>
          {shift.openSinceYesterday && (
            <p style={s.warnBox}>
              This shift has been open since {when(shift.openedAt)}. Count the drawer and close it, then open
              today's.
            </p>
          )}

          <div style={s.card}>
            <div>Open since <b>{when(shift.openedAt)}</b>{shift.openedBy ? ` · ${shift.openedBy}` : ''}</div>
            <div style={s.muted}>Float counted in: {rupees(shift.openingCashPaise)}</div>
          </div>

          {/* A manager sees the till's answer. A cashier does not, until their count is in. */}
          {shift.figures && (
            <section style={s.figures}>
              <Line label="Float" value={shift.figures.openingPaise} />
              <Line label="Cash sales" value={shift.figures.cashSalesPaise} />
              <Line label="Cash refunds" value={-shift.figures.cashRefundsPaise} />
              <Line label="Cash in" value={shift.figures.cashInPaise} />
              <Line label="Cash out" value={-shift.figures.cashOutPaise} />
              <div style={{ ...s.line, ...s.total }}>
                <span>Should be in the drawer</span><b>{rupees(shift.figures.expectedPaise)}</b>
              </div>
            </section>
          )}

          <div style={s.actions}>
            <button onClick={() => setCash('IN')}>Cash in</button>
            <button onClick={() => setCash('OUT')}>Cash out</button>
            {shift.mayClose && <button style={s.primary} onClick={() => setClosing(true)}>Close shift</button>}
          </div>

          {shift.movements.length > 0 && (
            <section>
              <h2 style={s.heading}>Cash in and out</h2>
              <ul style={s.list}>
                {shift.movements.map(m => (
                  <li key={m.id} style={s.row}>
                    <span>
                      {m.reason}
                      <span style={s.muted}> · {time(m.createdAt)}{m.by ? ` · ${m.by}` : ''}</span>
                    </span>
                    <b>{m.direction === 'IN' ? '+' : '−'}{rupees(m.amountPaise)}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {data.recent.length > 0 && (
        <section>
          <h2 style={s.heading}>Recent shifts</h2>
          <ul style={s.list}>
            {data.recent.map(r => (
              <li key={r.id} style={s.row}>
                <span>
                  {when(r.closedAt)}
                  <span style={s.muted}>
                    {' · '}counted {rupees(r.countedCashPaise)}{r.closedBy ? ` · ${r.closedBy}` : ''}
                    {r.closingNote ? ` · "${r.closingNote}"` : ''}
                  </span>
                </span>
                <Difference paise={r.differencePaise} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cash && shift && (
        <CashSheet
          direction={cash}
          counterId={counter.id}
          onDone={() => { setCash(null); refresh() }}
          onCancel={() => setCash(null)}
        />
      )}

      {closing && shift && (
        <CloseSheet
          shiftId={shift.id}
          onDone={() => { setClosing(false); refresh() }}
          onCancel={() => setClosing(false)}
        />
      )}
    </div>
  )
}

/** POS-SHIFT-001. The float, prefilled with what the last shift on this counter was counted at. */
function OpenForm({ counterId, suggested, onOpened }) {
  const [amount, setAmount] = useState(suggested != null ? String(suggested / 100) : '')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const paise = toPaise(amount)
    if (paise === null || busy) return
    setBusy(true)
    try {
      await openShift({ counterId, openingCashPaise: paise })
      toast.success('Shift open.')
      onOpened()
    } catch (err) {
      toast.error(messageFor(err))
      onOpened()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form style={s.card} onSubmit={submit}>
      <p style={{ margin: 0 }}>No shift is open. Count the cash in the drawer and open one.</p>
      <label style={s.label}>
        Cash in the drawer now
        <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Opening cash" autoFocus />
      </label>
      {suggested != null && <p style={s.muted}>The last shift here was counted at {rupees(suggested)}.</p>}
      <button type="submit" style={s.primary} disabled={toPaise(amount) === null || busy}>
        {busy ? 'Opening…' : 'Open shift'}
      </button>
    </form>
  )
}

const REASONS = {
  IN: ['Change float top-up', 'Owner added cash'],
  OUT: ['Courier', 'Tea and snacks', 'Bank deposit', 'Supplier paid']
}

/**
 * WF-CASH-01. POS-SHIFT-003, -004. Amount, reason -- the person is whoever is signed in.
 * A cashier's cash OUT opens the manager sheet, in place, exactly like a big discount.
 */
function CashSheet({ direction, counterId, onDone, onCancel }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [need, setNeed] = useState(null)
  const [approvalError, setApprovalError] = useState('')
  // One key per opening of the sheet: a double press records the cash once.
  const [onceKey] = useState(newOnceKey)
  const box = useRef(null)
  useEffect(() => { box.current?.focus() }, [])

  const paise = toPaise(amount)
  const ready = paise !== null && paise > 0 && reason.trim().length >= 3

  async function send(approval) {
    setBusy(true)
    try {
      await moveCash({ counterId, direction, amountPaise: paise, reason: reason.trim(), onceKey, ...(approval ? { approval } : {}) })
      toast.success(direction === 'IN' ? `${rupees(paise)} in, recorded.` : `${rupees(paise)} out, recorded.`)
      onDone()
    } catch (err) {
      const details = err?.response?.data?.details
      if (details?.code === 'APPROVAL_REQUIRED' && !approval) { setApprovalError(''); setNeed(details) }
      else if (approval) setApprovalError(messageFor(err))
      else toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label={direction === 'IN' ? 'Cash in' : 'Cash out'}>
      <form style={s.sheet} onSubmit={e => { e.preventDefault(); if (ready && !busy) send() }}>
        <b style={{ fontSize: 17 }}>{direction === 'IN' ? 'Cash into the drawer' : 'Cash out of the drawer'}</b>
        <label style={s.label}>
          Amount
          <input ref={box} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" />
        </label>
        <div style={s.chips}>
          {REASONS[direction].map(r => (
            <button type="button" key={r} aria-pressed={reason === r}
              style={{ ...s.chip, ...(reason === r ? s.chipOn : null) }} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="What for" aria-label="What for" maxLength={200} />
        {direction === 'OUT' && paise > 0 && (
          <p style={s.muted}>The drawer should then hold {rupees(paise)} less.</p>
        )}
        <div style={s.sheetActions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.primary} disabled={!ready || busy}>{busy ? 'Saving…' : 'Record'}</button>
        </div>
      </form>

      {need && (
        <ApprovalSheet need={need} error={approvalError} busy={busy}
          onCancel={() => setNeed(null)} onApprove={(yes) => send(yes)} />
      )}
    </div>
  )
}

/**
 * POS-SHIFT-006..008. Count first. The expected figure appears only after the shift is closed.
 * A mismatch opens a note box and leaves the amount editable -- counting again is allowed and
 * normal; the attempt is on the audit trail either way.
 */
function CloseSheet({ shiftId, onDone, onCancel }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [askNote, setAskNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const box = useRef(null)
  useEffect(() => { box.current?.focus() }, [])

  const paise = toPaise(amount)

  async function submit(event) {
    event.preventDefault()
    if (paise === null || busy) return
    setBusy(true)
    try {
      const closed = await closeShift(shiftId, { countedCashPaise: paise, ...(note.trim() ? { note: note.trim() } : {}) })
      setResult(closed)
    } catch (err) {
      if (err?.response?.data?.details?.code === 'COUNT_MISMATCH') setAskNote(true)
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div style={s.backdrop} role="dialog" aria-label="Shift closed">
        <div style={s.sheet}>
          <b style={{ fontSize: 17 }}>Shift closed</b>
          <div style={s.line}><span>Counted</span><b>{rupees(result.countedCashPaise)}</b></div>
          <div style={s.line}><span>The till expected</span><b>{rupees(result.expectedPaise)}</b></div>
          <div style={{ ...s.line, ...s.total }}><span>Difference</span><Difference paise={result.differencePaise} /></div>
          <button style={s.primary} onClick={onDone}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.backdrop} role="dialog" aria-label="Close shift">
      <form style={s.sheet} onSubmit={submit}>
        <b style={{ fontSize: 17 }}>Count the drawer</b>
        <p style={{ ...s.muted, margin: 0 }}>Count every note and coin, then type the total. The till tells you what it expected after.</p>
        <label style={s.label}>
          Counted
          <input ref={box} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Counted cash" />
        </label>
        {askNote && (
          <label style={s.label}>
            It doesn't match. Count again, or say what happened
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Gave too much change, float was short…" aria-label="What happened" maxLength={280} />
          </label>
        )}
        <div style={s.sheetActions}>
          <button type="button" onClick={onCancel}>Back</button>
          <button type="submit" style={s.primary} disabled={paise === null || busy}>{busy ? 'Closing…' : 'Close shift'}</button>
        </div>
      </form>
    </div>
  )
}

export function Difference({ paise }) {
  if (paise === null || paise === undefined) return <span style={s.muted}>—</span>
  if (paise === 0) return <b>Exact</b>
  return <b style={{ color: 'var(--warn)' }}>{rupees(Math.abs(paise))} {paise < 0 ? 'short' : 'over'}</b>
}

const Line = ({ label, value }) => (
  <div style={s.line}><span>{label}</span><span>{value < 0 ? `−${rupees(-value)}` : rupees(value)}</span></div>
)

function toPaise(text) {
  const t = String(text ?? '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

const time = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
function when(at) {
  const d = new Date(at)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? time(at)
    : `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time(at)}`
}

const s = {
  page: { padding: 16, display: 'grid', gap: 14, maxWidth: 640, alignContent: 'start' },
  state: { padding: 16 },
  title: { margin: 0, fontSize: 22 },
  heading: { margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 },
  card: { display: 'grid', gap: 10, padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--panel)' },
  warnBox: { margin: 0, padding: 12, border: '1px solid var(--line)', borderRadius: 10, color: 'var(--bad)', fontWeight: 600 },
  figures: { display: 'grid', gap: 4, padding: 14, border: '1px solid var(--line)', borderRadius: 12 },
  line: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  total: { borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 4, fontSize: 16 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { minHeight: 40, padding: '0 12px', fontWeight: 400 },
  chipOn: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 5
  },
  sheet: {
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: 20,
    width: 420, maxWidth: '100%', display: 'grid', gap: 12
  },
  sheetActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  muted: { color: 'var(--ink-soft)', fontSize: 12, margin: 0 },
  bad: { color: 'var(--bad)' }
}
