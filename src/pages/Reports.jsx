import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { loadReport, rupees, messageFor } from '../lib/api.js'
import { isTouchFirst } from '../lib/useMedia.js'
import { Difference } from './Shift.jsx'

/**
 * WF-REPORTS-01. POS-RPT-001..011.
 *
 * Small, on purpose (MASTER §10 rule 10): the questions an owner actually asks, one card each.
 * Every figure comes from the server, added up from the bills themselves -- this screen does no
 * arithmetic of its own beyond the width of a bar.
 *
 * A cashier sees their own sales today and nothing about anyone else's (MASTER §8, "limited").
 */
const METHOD = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit', EXCHANGE: 'Exchange credit', STORE_CREDIT: 'Store credit', POINTS: 'Points' }

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }

const PERIODS = [
  { key: 'today', label: 'Today', range: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { key: 'yesterday', label: 'Yesterday', range: () => ({ from: daysAgo(1), to: daysAgo(1) }) },
  { key: '7', label: 'Last 7 days', range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { key: '30', label: 'Last 30 days', range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  { key: 'custom', label: 'Choose dates' }
]

export default function Reports() {
  const { device } = useOutletContext() ?? {}
  const wide = device && !isTouchFirst(device)
  const [period, setPeriod] = useState('today')
  const [custom, setCustom] = useState({ from: daysAgo(6), to: daysAgo(0) })
  const range = period === 'custom' ? custom : PERIODS.find(p => p.key === period).range()

  const { data: r, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['report', range.from, range.to],
    queryFn: () => loadReport(range),
    placeholderData: keepPreviousData
  })

  const limited = r?.scope === 'MINE_TODAY'

  return (
    <div style={s.page}>
      <header style={s.head}>
        <h1 style={{ margin: 0 }}>{limited ? 'Your sales today' : 'Reports'}</h1>
        {r && !limited && (
          <div style={s.sub}>
            {r.period.from === r.period.to ? fmt(r.period.from) : `${fmt(r.period.from)} – ${fmt(r.period.to)}`}
            {isFetching ? ' · updating…' : ''}
          </div>
        )}
      </header>

      {!limited && (
        <div style={s.periods} role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button key={p.key} aria-pressed={period === p.key} style={s.period} onClick={() => setPeriod(p.key)}>{p.label}</button>
          ))}
        </div>
      )}
      {!limited && period === 'custom' && (
        <div style={s.dates}>
          <label style={s.label}>From<input type="date" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} aria-label="From" /></label>
          <label style={s.label}>To<input type="date" value={custom.to} min={custom.from} max={daysAgo(0)} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} aria-label="To" /></label>
        </div>
      )}

      {isLoading && <p style={s.muted}>Adding it up…</p>}
      {isError && <p style={s.bad}>{messageFor(error)}</p>}

      {r && (
        <>
          {/* POS-RPT-001 */}
          <section style={s.tiles}>
            {/* Full width on a phone: a crore-sized figure does not fit half a screen. */}
            <div style={{ ...s.hero, gridColumn: wide ? 'span 1' : '1 / -1' }}>
              <div style={s.heroLabel}>Net sales</div>
              <div style={s.heroValue}>{rupees(r.sales.netPaise)}</div>
              <div style={s.heroSub}>
                {r.sales.returnsPaise > 0 ? `${rupees(r.sales.afterReturnsPaise)} after ${rupees(r.sales.returnsPaise)} of returns` : 'No returns'}
              </div>
            </div>
            <Tile label="Bills" value={String(r.sales.bills)} />
            <Tile label="Average bill" value={rupees(r.sales.averageBillPaise)} />
            <Tile label="Discounts given" value={rupees(r.sales.discountPaise - (r.sales.offersPaise ?? 0))} />
            {(r.sales.offersPaise ?? 0) > 0 && <Tile label="Offers" value={rupees(r.sales.offersPaise)} />}
          </section>

          <div style={wide ? s.twoCol : s.oneCol}>
            <div style={s.col}>
              {/* POS-RPT-002 */}
              <Card title="How it was paid">
                <Bars rows={r.paidIn.map(p => ({ label: METHOD[p.method] ?? p.method, value: p.amountPaise, note: `${p.count}` }))}
                  empty={r.beingChecked?.amountPaise ? 'Nothing confirmed yet.' : 'Nothing taken.'} />
                {/*
                  * Money that is not in the drawer and not written off. Without these two lines the
                  * screen said "Net sales Rs 24,499" beside "Nothing taken", which reads as the day's
                  * takings having vanished rather than as one bill waiting on the bank.
                  */}
                {r.beingChecked?.amountPaise > 0 && (
                  <div style={s.subhead}>
                    Still being checked · {rupees(r.beingChecked.amountPaise)}
                    {r.beingChecked.count > 1 ? ` across ${r.beingChecked.count} payments` : ''}
                    <Link to="/payment-checks" style={{ marginLeft: 8 }}>Check them →</Link>
                  </div>
                )}
                {r.neverArrived?.amountPaise > 0 && (
                  <div style={{ ...s.subhead, color: 'var(--bad)' }}>
                    Checked and never arrived · {rupees(r.neverArrived.amountPaise)} — the customer owes it again
                  </div>
                )}
                {r.writtenOff?.amountPaise > 0 && (
                  <div style={{ ...s.subhead, color: 'var(--bad)' }}>
                    Written off as never paid · {rupees(r.writtenOff.amountPaise)} ({r.writtenOff.count}) — not money taken
                  </div>
                )}
                {r.paidOut.length > 0 && (
                  <>
                    <div style={s.subhead}>Given back on returns</div>
                    <Bars rows={r.paidOut.map(p => ({ label: METHOD[p.method] ?? p.method, value: p.amountPaise }))} tone="warn" />
                  </>
                )}
              </Card>

              {/* POS-RPT-003, -004 */}
              {!limited && (
                <Card title="By cashier">
                  <Bars rows={r.byCashier.map(c => ({ label: c.name, value: c.netPaise, note: `${c.bills} bills` }))} empty="No sales." />
                </Card>
              )}
              {/* Who served the customer, for incentives: net of returns on their bills, and before GST. */}
              {!limited && r.bySalesperson?.some(p => p.name !== 'Not chosen') && (
                <Card title="By salesperson">
                  <Bars rows={r.bySalesperson.map(p => ({
                    label: p.name,
                    value: p.netPaise,
                    note: `${p.bills} bills · ${rupees(p.netBeforeGstPaise)} before GST${p.returnsPaise ? ` · ${rupees(p.returnsPaise)} returned` : ''}`
                  }))} />
                </Card>
              )}
              {!limited && r.byCounter.length > 1 && (
                <Card title="By counter">
                  <Bars rows={r.byCounter.map(c => ({ label: c.name, value: c.netPaise, note: `${c.bills} bills` }))} />
                </Card>
              )}

              {/* POS-RPT-005, -006 */}
              <Card title="Returns and discounts">
                <Line label={`Returns (${r.returns.count}${r.returns.exchanges ? `, ${r.returns.exchanges} exchanges` : ''})`} value={rupees(r.returns.totalPaise)} />
                {r.returns.reasons.length > 0 && (
                  <div style={s.chips}>{r.returns.reasons.map(x => <span key={x.reason} className="chip">{x.reason} · {x.count}</span>)}</div>
                )}
                <Line label="Discounts given" value={rupees(r.discounts.totalPaise - (r.discounts.offersPaise ?? 0))} />
                {(r.discounts.offersPaise ?? 0) > 0 && <Line label="Offers (Inventory's prices)" value={rupees(r.discounts.offersPaise)} />}
                <Line label={`Prices changed (${r.discounts.priceOverrides})`} value={r.discounts.priceOverrides ? `${rupees(r.discounts.priceOverridesGivenPaise)} below the tag` : '—'} />
                {Object.keys(r.discounts.approvals).length > 0 && (
                  <div style={s.chips}>
                    {Object.entries(r.discounts.approvals).map(([k, n]) => <span key={k} className="chip brand">{APPROVAL[k] ?? 'Other approvals'} · {n}</span>)}
                  </div>
                )}
              </Card>

              {!limited && r.topProducts?.length > 0 && (
                <Card title="Top sellers">
                  <ol style={s.top}>
                    {r.topProducts.map((t, i) => (
                      <li key={`${t.code}-${i}`} style={s.topRow}>
                        <span style={s.rank}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div style={s.ellipsis}>{t.name}</div>
                          <div style={s.muted}>{t.code}</div>
                        </span>
                        <span style={{ textAlign: 'right' }}><b>{t.qty}</b><div style={s.muted}>{rupees(t.netPaise)}</div></span>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>

            <div style={s.col}>
              {/* POS-RPT-007 */}
              <Card title="GST">
                {r.tax.length === 0 ? <p style={s.muted}>No bills.</p> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={s.table}>
                      <thead>
                        <tr><th style={s.th}>Rate</th><th style={s.thR}>Taxable</th><th style={s.thR}>CGST</th><th style={s.thR}>SGST</th><th style={s.thR}>IGST</th><th style={s.thR}>Tax</th></tr>
                      </thead>
                      <tbody>
                        {r.tax.map(t => (
                          <tr key={t.rate}>
                            <td style={s.td}><b>{t.rate}%</b></td>
                            <td style={s.tdR}>{rupees(t.net.taxable)}</td>
                            <td style={s.tdR}>{rupees(t.net.cgst)}</td>
                            <td style={s.tdR}>{rupees(t.net.sgst)}</td>
                            <td style={s.tdR}>{rupees(t.net.igst)}</td>
                            <td style={s.tdR}><b>{rupees(t.net.tax)}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p style={s.muted}>After credit notes. Charged on bills less reversed on returns, by the rate each line was billed at.</p>
              </Card>

              {/* POS-RPT-008 */}
              {!limited && (
                <Card title="Cash counts">
                  {r.cash.shifts.length === 0 ? <p style={s.muted}>No drawer was closed in this period.</p> : (
                    <>
                      <div style={s.line}><span>Total difference</span><Difference paise={r.cash.totalDifferencePaise} /></div>
                      <ul style={s.list} className="card-list">
                        {r.cash.shifts.map((x, i) => (
                          <li key={i} style={s.row}>
                            <span style={{ minWidth: 0 }}>
                              <div>{x.counter}{x.cashier ? ` · ${x.cashier}` : ''}</div>
                              <div style={s.muted}>{new Date(x.closedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{x.note ? ` · "${x.note}"` : ''}</div>
                            </span>
                            <Difference paise={x.differencePaise} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              )}

              {/* POS-RPT-009 */}
              {!limited && (
                <Card title="Money owed on kept orders">
                  <Line label={`${r.dues.count} ${r.dues.count === 1 ? 'order' : 'orders'} owing, as of now`} value={rupees(r.dues.totalPaise)} strong />
                  {r.dues.oldest.length > 0 && (
                    <ul style={s.list} className="card-list">
                      {r.dues.oldest.map(d => (
                        <li key={d.id}>
                          <Link to={`/orders/${d.id}`} style={s.rowLink}>
                            <span style={{ minWidth: 0 }}>
                              <div style={s.ellipsis}>{d.customer || 'No name'}</div>
                              <div style={s.muted}>{d.invoiceNo} · since {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                            </span>
                            <span className="chip warn">{rupees(d.owedPaise)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {/* POS-RPT-010 */}
              {!limited && (
                <Card title="Day closes">
                  {r.dayCloses.length === 0 ? <p style={s.muted}>No day was closed in this period. <Link to="/day-close">Close today</Link></p> : (
                    <ul style={s.list} className="card-list">
                      {r.dayCloses.map(c => (
                        <li key={c.date} style={s.row}>
                          <span>
                            <div>{fmt(c.date)} · {rupees(c.netPaise)}</div>
                            <div style={s.muted}>{c.closedBy ? `Closed by ${c.closedBy}` : 'Closed'}{c.openShiftsAtClose ? ` · ${c.openShiftsAtClose} shift left open` : ''}</div>
                          </span>
                          <Difference paise={c.variancePaise} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>
          </div>

          {limited && <p style={s.muted}>The full reports are for managers and the owner.</p>}
        </>
      )}
    </div>
  )
}

const APPROVAL = { DISCOUNT_OVER_LIMIT: 'Big discounts approved', PRICE_OVERRIDE: 'Price changes approved', RETURN: 'Returns approved', RETURN_OUTSIDE_WINDOW: 'Late returns approved', CASH_OUT: 'Cash out approved', PAYMENT_VOID: 'Payments marked not received', PAY_LATER: 'Sold on credit', DUPLICATE_REFERENCE: 'Repeated payment references allowed', WRITE_OFF: 'Balances written off' }

function fmt(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

const Tile = ({ label, value }) => (
  <div style={s.tile}><div style={s.tileLabel}>{label}</div><div style={s.tileValue}>{value}</div></div>
)

const Card = ({ title, children }) => (
  <section style={s.card}><h2 style={s.cardTitle}>{title}</h2>{children}</section>
)

const Line = ({ label, value, strong }) => (
  <div style={{ ...s.line, ...(strong ? { fontWeight: 700 } : null) }}><span>{label}</span><span>{value}</span></div>
)

/** A figure with a bar behind it, so the biggest reads at a glance. */
function Bars({ rows, empty, tone }) {
  if (!rows.length) return <p style={s.muted}>{empty}</p>
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div style={s.bars}>
      {rows.map(r => (
        <div key={r.label} style={s.bar}>
          <div style={s.barHead}>
            <span>{r.label}{r.note ? <span style={s.muted}> · {r.note}</span> : null}</span>
            <b>{rupees(r.value)}</b>
          </div>
          <div style={s.track}>
            <div style={{ ...s.fill, width: `${Math.max(2, (r.value / max) * 100)}%`, ...(tone === 'warn' ? s.fillWarn : null) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 16, maxWidth: 1120, alignContent: 'start' },
  head: { display: 'grid', gap: 2 },
  sub: { color: 'var(--ink-soft)', fontSize: 14 },
  periods: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 },
  period: { minHeight: 40, padding: '0 14px', fontWeight: 500, whiteSpace: 'nowrap', borderRadius: 999 },
  dates: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)', minWidth: 160 },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  hero: {
    gridColumn: 'span 1', padding: '16px 18px', borderRadius: 16, color: '#fff',
    background: 'linear-gradient(135deg, #164b1e 0%, #1f6428 100%)', boxShadow: '0 12px 30px -16px rgba(22, 75, 30, 0.55)'
  },
  heroLabel: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' },
  heroValue: { fontSize: 28, fontWeight: 800, marginTop: 4, letterSpacing: '-0.02em' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  tile: { padding: '16px 18px', borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  tileLabel: { fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' },
  tileValue: { fontSize: 24, fontWeight: 800, marginTop: 4, letterSpacing: '-0.01em' },
  oneCol: { display: 'grid', gap: 14 },
  twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' },
  col: { display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 },
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', minWidth: 0 },
  cardTitle: { margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  subhead: { fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 6 },
  bars: { display: 'grid', gap: 10 },
  bar: { display: 'grid', gap: 5 },
  barHead: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 },
  track: { height: 8, borderRadius: 99, background: 'var(--panel-soft)', border: '1px solid var(--line)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #a6d92b, #7fb51a)' },
  fillWarn: { background: 'linear-gradient(90deg, #f0b35a, #d9892b)' },
  line: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)', padding: '8px 6px', borderBottom: '1px solid var(--line)' },
  thR: { textAlign: 'right', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)', padding: '8px 6px', borderBottom: '1px solid var(--line)' },
  td: { padding: '9px 6px', borderBottom: '1px solid var(--line)' },
  tdR: { padding: '9px 6px', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', boxShadow: 'none' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  rowLink: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14, textDecoration: 'none', color: 'var(--ink)' },
  top: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  topRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  rank: { flex: 'none', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 9, background: 'var(--brand-tint)', color: 'var(--brand-deep)', fontWeight: 800, fontSize: 13 },
  ellipsis: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  muted: { color: 'var(--ink-soft)', fontSize: 12.5, margin: 0 },
  bad: { color: 'var(--bad)', margin: 0 }
}
