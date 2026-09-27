import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  loadReturnInfo, quoteReturn, recordReturn, recordExchange, searchItems, rupees, messageFor
} from '../lib/api.js'
import { basketTotals, newOnceKey } from '../lib/basket.js'
import ApprovalSheet from '../components/ApprovalSheet.jsx'
import CustomerSheet from '../components/CustomerSheet.jsx'
import VariantSheet from '../components/VariantSheet.jsx'
import PaymentPanel from '../components/PaymentPanel.jsx'

/**
 * WF-RETURN-01 and WF-EXCHANGE-01. POS-RET-001..007, POS-EXC-001..005, POS-SALE-010, -011.
 *
 * One screen for both, because an exchange IS a return with a second half. The top is the same:
 * what is coming back, and why. A return then says how the money goes back; an exchange picks what
 * is going out instead, and settles only the difference.
 *
 * EVERYTHING THE SERVER WILL SAY IS SHOWN FIRST. Whether the bill can take a return at all, how
 * many of each line are left, whether it is past the window, whether a manager is needed and how
 * much can go back as money -- all before anyone taps a line. A screen that lets a cashier fill in a
 * whole return and then refuses it teaches them to reach for the cash drawer instead.
 *
 * THE REFUND FIGURE COMES FROM THE SERVER (quote), not from this screen's arithmetic. What each
 * piece is worth depends on its share of the bill's discount, and the cashier is about to say that
 * number out loud to a customer.
 */

const REASONS = ['Wrong size', 'Damaged', 'Colour not as expected', 'Changed mind']
const MONEY = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', STORE_CREDIT: 'Store credit' }

export default function ReturnFlow({ mode = 'RETURN' }) {
  const exchange = mode === 'EXCHANGE'
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { shop } = useOutletContext() ?? {}

  // One key for this screen. A double press, or a retry after a timeout, records one credit note.
  const [onceKey] = useState(newOnceKey)

  const [pick, setPick] = useState({})
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState(null)
  const [reference, setReference] = useState('')
  const [customer, setCustomer] = useState(null)
  const [askCustomer, setAskCustomer] = useState(false)
  const [approval, setApproval] = useState(null)
  const [approvalError, setApprovalError] = useState('')
  const [busy, setBusy] = useState(false)

  // Exchange: what is going out instead.
  const [newLines, setNewLines] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [picking, setPicking] = useState(null)
  const [paying, setPaying] = useState(false)

  const { data: info, isLoading, isError, error } = useQuery({
    queryKey: ['return-info', id],
    queryFn: () => loadReturnInfo(id)
  })

  const selection = useMemo(
    () => Object.entries(pick).filter(([, qty]) => qty > 0).map(([saleLineId, qty]) => ({ saleLineId, qty })),
    [pick]
  )

  const { data: quote, isFetching: quoting, error: quoteError } = useQuery({
    queryKey: ['return-quote', id, selection],
    queryFn: () => quoteReturn(id, selection),
    enabled: selection.length > 0 && !!info && !info.blocked,
    placeholderData: keepPreviousData
  })

  if (isLoading) return <p style={s.state}>Opening the bill…</p>
  if (isError) {
    return (
      <div style={s.state}>
        <p style={s.bad}>{messageFor(error)}</p>
        <Link to={`/bills/${id}`} style={s.muted}>Back to the bill</Link>
      </div>
    )
  }

  const back = <Link to={`/bills/${id}`} style={s.muted}>← Bill {info.invoiceNo}</Link>

  if (info.blocked) {
    return (
      <div style={s.page}>
        {back}
        <h1 style={s.title}>{exchange ? 'Exchange' : 'Return'}</h1>
        <p style={s.blocked}>{info.blocked.message}</p>
        {info.blocked.code === 'PAYMENT_BEING_CHECKED' && <Link to="/payment-checks">Open Payment checks →</Link>}
        {info.blocked.code === 'MONEY_OWED' && <Link to={`/orders/${id}`}>Open the order →</Link>}
      </div>
    )
  }

  const credit = selection.length > 0 && quote ? quote.totalPaise : 0
  const newTotal = basketTotals(newLines).totalPaise
  // Positive: the customer pays. Negative: the shop gives back. Only meaningful in an exchange.
  const difference = exchange ? newTotal - credit : -credit
  const giveBack = Math.max(0, -difference)
  const owner = info.customer ?? customer

  // --- what would stop the button, said before it is pressed -----------------------------------
  const problem = (() => {
    if (selection.length === 0) return 'Choose what is coming back.'
    if (reason.trim().length < 3) return 'Say why it is coming back.'
    if (exchange && newLines.length === 0) return 'Choose what they are taking instead.'
    if (giveBack > 0) {
      if (!method) return exchange ? `Choose how to give back ${rupees(giveBack)}.` : 'Choose how the money goes back.'
      if ((method === 'UPI' || method === 'CARD') && !reference.trim()) return `Add the ${MONEY[method]} refund reference.`
      if (method === 'STORE_CREDIT' && !owner) return 'Add the customer, so the credit has somewhere to go.'
      if (method !== 'STORE_CREDIT' && giveBack > info.moneyRefundablePaise) {
        return info.moneyRefundablePaise === 0
          ? 'Nothing on this bill was paid in money. Give it as store credit.'
          : `Only ${rupees(info.moneyRefundablePaise)} of this bill was paid in money. Give it as store credit.`
      }
    }
    return null
  })()

  function setQty(saleLineId, qty, max) {
    setPick(current => ({ ...current, [saleLineId]: Math.max(0, Math.min(max, qty)) }))
  }

  function takeEverything() {
    setPick(Object.fromEntries(info.lines.filter(l => l.remainingQty > 0).map(l => [l.saleLineId, l.remainingQty])))
  }

  function payload(extra = {}) {
    const refund = giveBack > 0 && method
      ? { method, ...(reference.trim() ? { reference: reference.trim() } : {}) }
      : undefined
    const base = {
      onceKey,
      lines: selection,
      reason: reason.trim(),
      ...(!info.customer && customer ? { customerId: customer.id } : {}),
      ...(refund ? { refund } : {})
    }
    if (!exchange) return { ...base, ...extra }
    return {
      ...base,
      newSale: {
        counterId: shop?.counters?.[0]?.id,
        lines: newLines.map(l => ({ itemId: l.id, qty: l.qty })),
        payments: extra.payments ?? []
      },
      ...(extra.approval ? { approval: extra.approval } : {})
    }
  }

  /**
   * Send it. A manager being needed is not an error: the server says so with the details, and the
   * approval sheet opens over this screen with everything the cashier chose still in place.
   */
  async function send(body) {
    setBusy(true)
    try {
      const result = exchange ? await recordExchange(id, body) : await recordReturn(id, body)
      toast.success(exchange ? 'Exchange recorded.' : 'Return recorded.')
      queryClient.invalidateQueries({ queryKey: ['bill', id] })
      queryClient.invalidateQueries({ queryKey: ['return-info', id] })
      queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      navigate(`/returns/${result.creditNote.id}`, { replace: true })
    } catch (err) {
      const details = err?.response?.data?.details
      if (details?.code === 'APPROVAL_REQUIRED' && !body.approval) {
        setApprovalError('')
        setApproval({ need: details, body })
      } else if (approval) {
        setApprovalError(messageFor(err))
      } else {
        toast.error(messageFor(err))
      }
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    if (problem || busy) return
    if (exchange && difference > 0) { setPaying(true); return }
    send(payload())
  }

  // --- exchange: finding the replacement ---------------------------------------------------------
  async function find(event) {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    try {
      const found = await searchItems(q)
      if (found.items.length === 0) toast.error(`Nothing found for "${q}"`)
      if (found.exact && found.items.length === 1) addItem(found.items[0])
      else setResults(found.items)
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  function choose(item) {
    if (item.priceFromPaise && item.variantGroup) { setPicking({ group: item.variantGroup, name: item.name }); return }
    addItem(item)
  }

  function addItem(item) {
    setNewLines(current => {
      const at = current.findIndex(l => l.id === item.id)
      if (at >= 0) return current.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l))
      return [...current, {
        id: item.id, name: item.name, colour: item.colour, size: item.size,
        pricePaise: item.pricePaise, taxRate: item.taxRate, qty: 1
      }]
    })
    setResults([])
    setQuery('')
    setPicking(null)
  }

  const changeNew = (itemId, qty) => setNewLines(current =>
    qty <= 0 ? current.filter(l => l.id !== itemId) : current.map(l => (l.id === itemId ? { ...l, qty } : l)))

  const refundChoice = giveBack > 0 && (
    <section style={s.section}>
      <h2 style={s.heading}>{exchange ? `Give back ${rupees(giveBack)} as` : 'Money goes back as'}</h2>
      <div style={s.choices} role="group" aria-label="Refund method">
        {info.refundMethods.map(m => (
          <button key={m} type="button" aria-pressed={method === m}
            style={{ ...s.choice, ...(method === m ? s.choiceOn : null) }}
            onClick={() => { setMethod(m); setReference('') }}>
            {MONEY[m]}
          </button>
        ))}
      </div>
      {(method === 'UPI' || method === 'CARD') && (
        <input value={reference} onChange={e => setReference(e.target.value)}
          placeholder={`${MONEY[method]} refund reference`} aria-label="Refund reference" />
      )}
      {method === 'STORE_CREDIT' && (
        owner
          ? <p style={s.muted}>Goes to {owner.name || owner.phoneMasked || owner.phoneDisplay}, who has {rupees(owner.storeCreditPaise ?? 0)} now.</p>
          : <button type="button" onClick={() => setAskCustomer(true)}>+ Add customer for the credit</button>
      )}
      {method && method !== 'STORE_CREDIT' && info.moneyRefundablePaise < info.totalPaise && (
        <p style={s.muted}>Up to {rupees(info.moneyRefundablePaise)} of this bill can go back as money.</p>
      )}
    </section>
  )

  return (
    <div style={s.page}>
      {back}
      <h1 style={s.title}>{exchange ? 'Exchange' : 'Return'}</h1>

      {/* POS-RET-004, -005. The window, and whether a manager will be needed, before anything else. */}
      <p style={info.window.outside ? s.warn : s.muted}>
        Sold {info.window.daysSince === 0 ? 'today' : `${info.window.daysSince} ${info.window.daysSince === 1 ? 'day' : 'days'} ago`}
        {info.window.outside
          ? ` — past the ${info.window.days}-day return window.`
          : ` · returns within ${info.window.days} days.`}
        {info.approvalNeeded && ' A manager will need to approve it.'}
      </p>

      <section style={s.section}>
        <div style={s.headRow}>
          <h2 style={s.heading}>Coming back</h2>
          <button type="button" onClick={takeEverything} style={s.small}>All of it</button>
        </div>
        <ul style={s.list}>
          {info.lines.map(line => {
            const qty = pick[line.saleLineId] ?? 0
            const none = line.remainingQty === 0
            return (
              <li key={line.saleLineId} style={s.line}>
                <div style={s.lineText}>
                  <div style={none ? s.gone : undefined}>{line.description}</div>
                  <div style={s.muted}>
                    {none
                      ? 'Already returned'
                      : line.returnedQty > 0
                        ? `${line.remainingQty} of ${line.qty} can still come back`
                        : `${line.qty} bought`}
                  </div>
                </div>
                {!none && (
                  <div style={s.stepper}>
                    <button type="button" aria-label={`One fewer ${line.description}`}
                      onClick={() => setQty(line.saleLineId, qty - 1, line.remainingQty)} disabled={qty === 0}>−</button>
                    <b style={s.qty} aria-label="Quantity coming back">{qty}</b>
                    <button type="button" aria-label={`One more ${line.description}`}
                      onClick={() => setQty(line.saleLineId, qty + 1, line.remainingQty)} disabled={qty >= line.remainingQty}>+</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {selection.length > 0 && (
          <div style={s.total}>
            <span>Worth</span>
            <b>{quoteError ? '—' : quote ? rupees(quote.totalPaise) : '…'}{quoting && quote ? ' …' : ''}</b>
          </div>
        )}
        {quoteError && <p style={s.bad}>{messageFor(quoteError)}</p>}
        {quote?.roundOffPaise ? <p style={s.muted}>Includes the bill's round-off of {rupees(quote.roundOffPaise)}.</p> : null}
      </section>

      <section style={s.section}>
        <h2 style={s.heading}>Why</h2>
        <div style={s.choices}>
          {REASONS.map(r => (
            <button key={r} type="button" aria-pressed={reason === r}
              style={{ ...s.choice, ...(reason === r ? s.choiceOn : null) }}
              onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Or type the reason" aria-label="Reason" maxLength={200} />
      </section>

      {exchange && (
        <section style={s.section}>
          <h2 style={s.heading}>Taking instead</h2>
          <form onSubmit={find} style={s.searchRow}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search or scan" aria-label="Find the replacement" />
            <button type="submit">Find</button>
          </form>
          {results.length > 0 && (
            <ul style={s.list}>
              {results.map(item => (
                <li key={item.id}>
                  <button type="button" style={s.result} onClick={() => choose(item)}>
                    <span>
                      {item.name}
                      <span style={s.muted}>
                        {' '}{item.priceFromPaise ? `${item.variantCount} colours and sizes` : [item.colour, item.size].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <b>{item.priceFromPaise ? `from ${rupees(item.priceFromPaise)}` : rupees(item.pricePaise)}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul style={s.list}>
            {newLines.map(l => (
              <li key={l.id} style={s.line}>
                <div style={s.lineText}>
                  <div>{[l.name, l.colour, l.size].filter(Boolean).join(', ')}</div>
                  <div style={s.muted}>{rupees(l.pricePaise)} each</div>
                </div>
                <div style={s.stepper}>
                  <button type="button" aria-label={`One fewer ${l.name}`} onClick={() => changeNew(l.id, l.qty - 1)}>−</button>
                  <b style={s.qty}>{l.qty}</b>
                  <button type="button" aria-label={`One more ${l.name}`} onClick={() => changeNew(l.id, l.qty + 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
          {newLines.length > 0 && (
            <div style={s.total}><span>New items</span><b>{rupees(newTotal)}</b></div>
          )}
        </section>
      )}

      {refundChoice}

      {/* The one figure the cashier says out loud. */}
      {selection.length > 0 && quote && (!exchange || newLines.length > 0) && (
        <div style={s.bottomLine}>
          {exchange
            ? difference > 0 ? <>Customer pays <b>{rupees(difference)}</b></>
              : difference < 0 ? <>Give back <b>{rupees(-difference)}</b></>
              : <>Even — nothing to pay or give back</>
            : <>Refund <b>{rupees(credit)}</b></>}
        </div>
      )}

      <div style={s.actions}>
        {problem && <p style={s.problem}>{problem}</p>}
        <button style={s.primary} disabled={!!problem || busy || quoting} onClick={submit}>
          {busy ? 'Saving…'
            : exchange ? (difference > 0 ? `Take ${rupees(difference)}` : 'Record exchange')
            : 'Record return'}
        </button>
      </div>

      {paying && (
        <PaymentPanel
          totalPaise={difference}
          heading="Difference to pay"
          enabledMethods={shop?.shop?.enabledPaymentMethods}
          creditPaise={owner?.storeCreditPaise ?? 0}
          onCancel={() => setPaying(false)}
          onConfirm={async (payments) => { await send(payload({ payments })) }}
        />
      )}

      {approval && (
        <ApprovalSheet
          need={approval.need}
          error={approvalError}
          busy={busy}
          onCancel={() => setApproval(null)}
          onApprove={(yes) => send({ ...approval.body, approval: yes })}
        />
      )}

      {askCustomer && (
        <CustomerSheet
          onPick={(c) => { setCustomer(c); setAskCustomer(false) }}
          onSkip={() => setAskCustomer(false)}
          onClose={() => setAskCustomer(false)}
        />
      )}

      {picking && (
        <VariantSheet group={picking.group} name={picking.name} onPick={addItem} onClose={() => setPicking(null)} />
      )}
    </div>
  )
}

const s = {
  page: { padding: 16, display: 'grid', gap: 14, maxWidth: 720, alignContent: 'start', paddingBottom: 96 },
  state: { padding: 16, display: 'grid', gap: 10, justifyItems: 'start' },
  title: { margin: 0, fontSize: 22 },
  heading: { margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600 },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  section: { display: 'grid', gap: 8 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 },
  line: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    minHeight: 56, padding: '6px 0', borderBottom: '1px solid var(--line)'
  },
  lineText: { minWidth: 0 },
  gone: { color: 'var(--ink-soft)', textDecoration: 'line-through' },
  stepper: { display: 'flex', alignItems: 'center', gap: 6 },
  qty: { minWidth: 24, textAlign: 'center' },
  small: { minHeight: 36, padding: '0 12px', fontWeight: 400 },
  total: { display: 'flex', justifyContent: 'space-between', fontSize: 15 },
  choices: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  choice: { minHeight: 40, padding: '0 12px', fontWeight: 400 },
  choiceOn: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  searchRow: { display: 'flex', gap: 8 },
  result: {
    width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left',
    fontWeight: 400, minHeight: 48
  },
  bottomLine: { fontSize: 18, padding: '10px 0', borderTop: '1px solid var(--line)' },
  actions: {
    position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0',
    display: 'grid', gap: 6
  },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', minHeight: 48 },
  problem: { margin: 0, color: 'var(--ink-soft)', fontSize: 13 },
  blocked: { margin: 0, padding: 12, border: '1px solid var(--line)', borderRadius: 10, color: 'var(--warn)' },
  warn: { margin: 0, color: 'var(--warn)', fontWeight: 600 },
  muted: { margin: 0, color: 'var(--ink-soft)', fontSize: 12, textDecoration: 'none' },
  bad: { color: 'var(--bad)', margin: 0 }
}
