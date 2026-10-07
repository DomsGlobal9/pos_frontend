import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadDay, closeTheDay, rupees, messageFor } from '../lib/api.js'
import { Difference } from './Shift.jsx'
import { askYesNo } from '../components/Ask.jsx'

/**
 * WF-DAY-01. POS-DAY-001..005.
 *
 * One page an owner reads at night. What was sold and how it was paid; what went back; what the
 * drawers should hold and what they were counted at; and anything still unsettled.
 *
 * A CLOSED DAY IS FROZEN. Its figures are the ones read at the moment it was closed. Anything that
 * lands on the day afterwards shows on its own "since closing" line rather than quietly changing
 * the closed numbers.
 */
const METHOD = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit', EXCHANGE: 'Exchange credit', STORE_CREDIT: 'Store credit', POINTS: 'Points' }

const today = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function DayClose() {
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['day', date],
    queryFn: () => loadDay(date),
    enabled: !!date
  })

  async function close(acceptOpenShifts = false) {
    setBusy(true)
    try {
      await closeTheDay(date, acceptOpenShifts ? { acceptOpenShifts: true } : {})
      toast.success('Day closed.')
      queryClient.invalidateQueries({ queryKey: ['day', date] })
    } catch (err) {
      const details = err?.response?.data?.details
      if (details?.code === 'OPEN_SHIFTS' && !acceptOpenShifts) {
        // The warning is the refusal. Closing anyway is a decision someone makes, in so many words.
        const yes = await askYesNo('Close the day anyway?', {
          note: `${messageFor(err)} The open shifts will be noted on it.`,
          confirmLabel: 'Close the day'
        })
        if (yes) await close(true)
      } else {
        toast.error(messageFor(err))
      }
    } finally {
      setBusy(false)
    }
  }

  // Frozen figures when closed, live ones otherwise.
  const f = data?.closed?.figures ?? data?.live

  return (
    <div style={s.page}>
      <h1 style={s.title}>Close the day</h1>

      <label style={s.label}>
        Day
        <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} aria-label="Day" />
      </label>

      {isLoading && <p style={s.muted}>Adding it up…</p>}
      {isError && <p style={s.bad}>{messageFor(error)}</p>}

      {data && f && (
        <>
          {data.closed ? (
            <p style={s.closed}>
              Closed{data.closed.closedBy ? ` by ${data.closed.closedBy}` : ''} at{' '}
              {new Date(data.closed.closedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.
              {' '}These figures are as they were then.
              {data.closed.openShiftsAtClose > 0 && ` ${data.closed.openShiftsAtClose} shift${data.closed.openShiftsAtClose === 1 ? ' was' : 's were'} still open.`}
              {data.closed.note && <><br />Note: {data.closed.note}</>}
            </p>
          ) : null}

          {data.closed?.since && (
            <p style={s.warn}>
              Since closing: {data.closed.since.bills} more bill{data.closed.since.bills === 1 ? '' : 's'},{' '}
              {rupees(data.closed.since.netPaise)}
              {data.closed.since.returnsPaise ? `, ${rupees(data.closed.since.returnsPaise)} returned` : ''}.
            </p>
          )}

          {/* Closed already, and a till is still holding sales: they arrive after the close. POS-DAY-004. */}
          {data.closed && data.isToday && data.live?.pendingSync > 0 && (
            <section style={s.attention}>
              <Link to="/sync" style={s.warnLink}>
                {data.live.pendingSync} sale{data.live.pendingSync === 1 ? ' is' : 's are'} still waiting to send from a till. They will show under "since closing" once sent →
              </Link>
            </section>
          )}

          {/* Things that need someone, before the figures. */}
          {!data.closed && (data.openShifts.length > 0 || f.paymentsToCheck > 0 || f.pendingSync > 0) && (
            <section style={s.attention}>
              {data.openShifts.map(sh => (
                <div key={sh.id}>
                  <Link to="/shift" style={s.warnLink}>
                    {sh.counterName} is still open{sh.openedBy ? `, opened by ${sh.openedBy}` : ''}{sh.openSinceYesterday ? ' — since yesterday' : ''} →
                  </Link>
                </div>
              ))}
              {f.paymentsToCheck > 0 && (
                <div><Link to="/payment-checks" style={s.warnLink}>{f.paymentsToCheck} payment{f.paymentsToCheck === 1 ? '' : 's'} still to check →</Link></div>
              )}
              {f.pendingSync > 0 && (
                <div>
                  <Link to="/sync" style={s.warnLink}>
                    {f.pendingSync} sale{f.pendingSync === 1 ? ' is' : 's are'} still waiting to send from a till. They are not in these figures yet →
                  </Link>
                </div>
              )}
            </section>
          )}

          <section style={s.block}>
            <h2 style={s.heading}>Sales</h2>
            <Line label={`Bills (${f.bills.count})`} value={f.bills.grossPaise} />
            <Line label="Discounts" value={-f.bills.discountPaise} />
            <Line label="Includes GST" value={f.bills.taxPaise} muted />
            <Line label="Net sales" value={f.bills.netPaise} strong />
            <Line label={`Returns (${f.returns.count})`} value={-f.returns.totalPaise} />
          </section>

          <section style={s.block}>
            <h2 style={s.heading}>Paid in</h2>
            {Object.keys(f.paidIn).length === 0 && <p style={s.muted}>Nothing.</p>}
            {Object.entries(f.paidIn).map(([m, v]) => <Line key={m} label={METHOD[m] ?? m} value={v} />)}
            {Object.keys(f.paidOut).length > 0 && <h2 style={{ ...s.heading, marginTop: 10 }}>Given back</h2>}
            {Object.entries(f.paidOut).map(([m, v]) => <Line key={m} label={METHOD[m] ?? m} value={-v} />)}
          </section>

          <section style={s.block}>
            <h2 style={s.heading}>Cash</h2>
            <Line label="Floats counted in" value={f.cash.openingPaise} />
            <Line label="Cash sales" value={f.cash.salesPaise} />
            <Line label="Cash refunds" value={-f.cash.refundsPaise} />
            <Line label="Cash in" value={f.cash.inPaise} />
            <Line label="Cash out" value={-f.cash.outPaise} />
            <Line label="Should be in the drawers" value={f.cash.positionPaise} strong />
            {f.cash.unattributedPaise !== 0 && (
              <p style={s.warn}>{rupees(f.cash.unattributedPaise)} of that was taken with no shift open, so no drawer counts it.</p>
            )}
            {f.cash.countedPaise !== null ? (
              <>
                <Line label={`Counted (${f.cash.shiftsClosed} shift${f.cash.shiftsClosed === 1 ? '' : 's'})`} value={f.cash.countedPaise} />
                <div style={s.line}><span>Difference</span><Difference paise={f.cash.variancePaise} /></div>
              </>
            ) : <p style={s.muted}>No shift has been counted for this day yet.</p>}
          </section>

          {!data.closed && (
            data.mayClose
              ? <button style={s.primary} disabled={busy} onClick={() => close(false)}>{busy ? 'Closing…' : 'Close the day'}</button>
              : <p style={s.muted}>Only a manager or the owner can close the day.</p>
          )}
        </>
      )}
    </div>
  )
}

const Line = ({ label, value, strong, muted }) => (
  <div style={{ ...s.line, ...(strong ? s.strong : null), ...(muted ? s.soft : null) }}>
    <span>{label}</span><span>{value < 0 ? `−${rupees(-value)}` : rupees(value)}</span>
  </div>
)

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)', maxWidth: 220 },
  heading: { margin: '0 0 4px', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  block: { display: 'grid', gap: 4, padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)', boxShadow: 'var(--shadow)' },
  line: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  strong: { fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 2 },
  soft: { color: 'var(--ink-soft)', fontSize: 13 },
  attention: { display: 'grid', gap: 8, padding: '14px 16px', borderRadius: 14, background: 'var(--warn-tint)' },
  warnLink: { color: 'var(--warn)', fontWeight: 600, textDecoration: 'none' },
  closed: { margin: 0, padding: '14px 16px', borderRadius: 14, background: 'var(--brand-tint)', color: 'var(--brand-deep)' },
  warn: { margin: 0, color: 'var(--warn)', fontSize: 14 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', minHeight: 48 },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 },
  bad: { color: 'var(--bad)', margin: 0 }
}
