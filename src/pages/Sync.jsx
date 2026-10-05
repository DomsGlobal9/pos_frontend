import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { rupees } from '../lib/api.js'
import { useOutbox, flush, removeFromOutbox, storageAvailable } from '../lib/outbox.js'
import { loadDraft } from '../lib/basket.js'
import { checkIn } from '../lib/device.js'
import { askYesNo } from '../components/Ask.jsx'

/**
 * WF-SYNC-01. What this till is holding that the server has not got. POS-SYNC-003, -004.
 *
 * Plain words only: "waiting to send", "needs a look" -- never "outbox", "queue", "hold" or a status
 * code (POS-SYNC-006's rule). A cashier should be able to read this out to the owner on the phone.
 *
 * Three things can be done with a sale here, and each is safe:
 *   Send now      tries again straight away (it also happens on its own every few seconds)
 *   Open in till  puts the basket back on the Sell screen with its own key, to change and complete
 *   Remove        drops it from this till, after saying plainly what that means
 */
const METHOD = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CREDIT: 'Store credit' }
const time = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Sync() {
  const { items, sent } = useOutbox()
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const waiting = items.filter(i => i.state !== 'needs_attention')
  const attention = items.filter(i => i.state === 'needs_attention')

  async function sendNow(includeAttention = false) {
    setBusy(true)
    try {
      const went = await flush({ includeAttention })
      if (went > 0) {
        queryClient.invalidateQueries()
        checkIn()
        toast.success(went === 1 ? '1 sale sent.' : `${went} sales sent.`)
      } else if (!navigator.onLine) {
        toast.error('Still no connection. The sales stay safe on this till.')
      }
    } finally {
      setBusy(false)
    }
  }

  function openInTill(entry) {
    if (loadDraft().lines.length > 0) {
      toast.error('The Sell screen has a sale in progress. Finish or park it first.')
      return
    }
    removeFromOutbox(entry.onceKey)
    checkIn()
    navigate('/sell', { state: { restore: entry.restore } })
  }

  async function remove(entry) {
    const ok = await askYesNo('Remove this sale from the till?', {
      note: 'It will not be sent, so there will be no bill for it. If the customer paid, that money '
          + 'is in the drawer with no bill to match.',
      // Not plain 'Remove': the row behind it already has a Remove, and two buttons with one
      // name is a coin-flip for a screen reader and for anyone glancing at a half-covered screen.
      confirmLabel: 'Remove from this till',
      danger: true
    })
    if (!ok) return
    removeFromOutbox(entry.onceKey)
    checkIn()
    toast('Removed from this till.')
  }

  return (
    <div style={s.page}>
      <h1 style={s.title}>Waiting to sync</h1>

      {!storageAvailable() && (
        <p className="chip bad" style={s.notice}>
          This browser is not letting the till save anything. Sales kept here are lost if this tab closes.
        </p>
      )}

      {items.length === 0 ? (
        <section style={s.empty}>
          <CheckCircle2 size={28} aria-hidden="true" style={{ color: 'var(--good)' }} />
          <div style={s.big}>Everything is sent</div>
          <div style={s.muted}>No sales are waiting on this till.</div>
        </section>
      ) : (
        <section style={s.summary}>
          <div>
            <div style={s.big}>{items.length === 1 ? '1 sale' : `${items.length} sales`} on this till</div>
            <div style={s.muted}>
              {waiting.length > 0 && 'Sent on their own when the connection is back. The bill number comes then. '}
              {attention.length > 0 && `${attention.length === 1 ? '1 needs' : `${attention.length} need`} a look.`}
            </div>
          </div>
          {waiting.length > 0 && (
            <button style={s.primary} onClick={() => sendNow(false)} disabled={busy}>
              <RefreshCw size={16} aria-hidden="true" /> {busy ? 'Sending…' : 'Send now'}
            </button>
          )}
        </section>
      )}

      {attention.length > 0 && (
        <>
          <h2 style={s.heading}>Needs a look</h2>
          <ul className="card-list" style={s.list}>
            {attention.map(entry => (
              <Entry key={entry.onceKey} entry={entry}>
                <p style={s.why}>{entry.message}</p>
                <div style={s.actions}>
                  <button style={s.primary} onClick={() => openInTill(entry)}>Open in till</button>
                  <button style={s.secondary} onClick={() => sendNow(true)} disabled={busy}>Try again</button>
                  <button style={s.danger} onClick={() => remove(entry)}>Remove</button>
                </div>
              </Entry>
            ))}
          </ul>
        </>
      )}

      {waiting.length > 0 && (
        <>
          <h2 style={s.heading}>Waiting to send</h2>
          <ul className="card-list" style={s.list}>
            {waiting.map(entry => (
              <Entry key={entry.onceKey} entry={entry}>
                <div style={s.actions}>
                  <button style={s.secondary} onClick={() => openInTill(entry)}>Open in till</button>
                  <button style={s.danger} onClick={() => remove(entry)}>Remove</button>
                </div>
              </Entry>
            ))}
          </ul>
        </>
      )}

      {sent.length > 0 && (
        <>
          <h2 style={s.heading}>Sent from this till</h2>
          <ul className="card-list" style={s.list}>
            {sent.slice(0, 10).map(x => (
              <li key={x.onceKey} style={s.sentRow}>
                <div style={{ minWidth: 0 }}>
                  <Link to={`/bills/${x.saleId}`} style={s.bill}>{x.invoiceNo}</Link>
                  <div style={s.muted}>Made {time(x.madeAt)} · sent {time(x.sentAt)}</div>
                </div>
                <b>{rupees(x.totalPaise)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Entry({ entry, children }) {
  const m = entry.summary ?? {}
  const state = entry.state === 'sending'
    ? <span className="chip brand">Sending…</span>
    : entry.state === 'needs_attention'
      ? <span className="chip bad">Needs a look</span>
      : <span className="chip warn">Waiting</span>
  return (
    <li style={s.entry} data-once-key={entry.onceKey}>
      <div style={s.entryTop}>
        <div style={{ minWidth: 0 }}>
          <div style={s.label}>
            {m.first}{m.more ? ` + ${m.more} more` : ''}
          </div>
          <div style={s.muted}>
            {m.pieces} {m.pieces === 1 ? 'piece' : 'pieces'} · {(m.paidBy ?? []).map(p => METHOD[p] ?? p).join(' + ')}
            {m.customerName ? ` · ${m.customerName}` : ''}{m.kept ? ' · kept order' : ''}
          </div>
          <div style={s.muted}>Made {time(entry.createdAt)}</div>
        </div>
        <div style={s.right}>
          <b style={s.amount}>{rupees(m.totalPaise ?? 0)}</b>
          {state}
        </div>
      </div>
      {children}
    </li>
  )
}

const button = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 44, padding: '0 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: 14, cursor: 'pointer'
}
const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  heading: { margin: '6px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  notice: { margin: 0, padding: '10px 12px', borderRadius: 'var(--radius-sm)', whiteSpace: 'normal' },
  empty: {
    display: 'grid', justifyItems: 'center', gap: 6, padding: '32px 20px', textAlign: 'center',
    background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)'
  },
  summary: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: 16, background: 'var(--warn-tint)', borderRadius: 'var(--radius)'
  },
  big: { fontSize: 17, fontWeight: 700 },
  muted: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  entry: { display: 'grid', gap: 10, padding: '14px 0', borderBottom: '1px solid var(--line)' },
  entryTop: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  label: { fontWeight: 600, overflowWrap: 'anywhere' },
  right: { display: 'grid', justifyItems: 'end', gap: 6, flexShrink: 0 },
  amount: { fontSize: 16 },
  why: { margin: 0, padding: '8px 10px', background: 'var(--bad-tint)', color: 'var(--bad)', borderRadius: 'var(--radius-sm)', fontSize: 14, lineHeight: 1.45 },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  primary: { ...button, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
  secondary: { ...button, background: 'var(--panel)', color: 'var(--ink)', border: '1px solid var(--line-strong)' },
  danger: { ...button, background: 'var(--panel)', color: 'var(--bad)', border: '1px solid var(--line-strong)' },
  sentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' },
  bill: { fontWeight: 700, color: 'var(--accent)' }
}
