import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { loadInventoryLink, connectInventory, disconnectInventory, retryInventory, syncInventoryItems, setInventoryWhenDown, messageFor } from '../lib/api.js'

/**
 * The owner's Inventory link. POS-INV-001, -009, POS-SYNC-006.
 *
 * Everything about the integration lives here and nowhere a cashier works (MASTER §2 rule 9). A
 * problem is said in one sentence with what to do about it -- "An item on this bill is not in
 * Inventory" and a Retry button -- never a status code or a queue term.
 */
export default function InventoryLink() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['inventory-link'], queryFn: loadInventoryLink, refetchInterval: 15_000 })
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory-link'] })

  async function act(fn, done) {
    setBusy(true)
    try { const result = await fn(); if (done) toast.success(typeof done === 'function' ? done(result) : done); refresh() }
    catch (err) { toast.error(messageFor(err)) }
    finally { setBusy(false) }
  }

  if (isLoading) return <p style={s.page}>Loading…</p>
  if (isError) return <p style={{ ...s.page, ...s.bad }}>{messageFor(error)}</p>

  const connected = data.mode === 'CONNECTED'
  const manage = data.mayManage

  return (
    <div style={s.page}>
      <h1 style={s.title}>Inventory link</h1>

      <p style={s.lead}>
        {connected
          ? 'This till sells from your Inventory items and sends every sale and return back, so stock stays right.'
          : data.mode === 'DISCONNECTED'
            ? 'Disconnected. The till sells from its own item list; sales made now are sent when you connect again.'
            : 'Not connected. The till uses its own item list.'}
      </p>

      {!data.deploymentHasInventory && data.mode === 'STANDALONE' && (
        <p style={s.muted}>This till is not set up to reach an Inventory. Ask ScaleEzy support if you use Inventory.</p>
      )}

      {data.blocked && (
        <section style={s.alert}>
          <b>Sending to Inventory has stopped</b>
          <div>{data.blocked.message}</div>
          {data.blocked.document && <div style={s.muted}>At {data.blocked.document}. Everything after it is waiting, safely.</div>}
          {manage && <button disabled={busy} onClick={() => act(retryInventory, (r) => `Sent ${r.sent?.sent ?? 0}.`)}>I've fixed it — try again</button>}
        </section>
      )}

      {data.mode !== 'STANDALONE' && (
        <section style={s.card}>
          <Row label="Status" value={connected ? 'Connected' : 'Disconnected'} />
          <Row label="Key" value={`${data.keyPrefix}…`} />
          <Row label="Waiting to send" value={String(data.waiting)} />
          <Row label="Last sent" value={data.lastDeliveredAt ? new Date(data.lastDeliveredAt).toLocaleString('en-IN') : 'Nothing yet'} />
          {data.lastError && !data.blocked && <p style={s.warn}>{data.lastError} It will try again by itself.</p>}
          <Row label="Items last refreshed" value={data.catalogueSyncedAt ? new Date(data.catalogueSyncedAt).toLocaleString('en-IN') : 'Never'} />
        </section>
      )}

      {connected && (
        <button style={s.primary} disabled={busy}
          onClick={() => act(syncInventoryItems, (r) => `${r.added} added, ${r.updated} updated${r.switchedOff ? `, ${r.switchedOff} switched off` : ''}.`)}>
          {busy ? 'Working…' : 'Refresh items from Inventory'}
        </button>
      )}

      {/* Bills Inventory ACCEPTED but flagged -- a GST rate that differs, stock it thought it did not
          have. Nothing stopped; somebody should settle it in Inventory or at the next count. */}
      {data.warnings?.length > 0 && (
        <section>
          <h2 style={s.heading}>Notes from Inventory</h2>
          <ul style={s.notes} className="card-list">
            {data.warnings.map((w, i) => (
              <li key={i} style={s.note}>
                <span className="chip warn" style={{ justifySelf: 'start' }}>{w.document ?? 'A bill'}</span>
                <span>{w.text}</span>
                <span style={s.muted}>{new Date(w.at).toLocaleString('en-IN')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.catalogueProblems?.length > 0 && (
        <section>
          <h2 style={s.heading}>Items that need a look in Inventory</h2>
          <ul style={s.list}>{data.catalogueProblems.map((p, i) => <li key={i} style={s.problem}>{p}</li>)}</ul>
        </section>
      )}

      {manage && data.deploymentHasInventory && (
        <section style={s.card}>
          <h2 style={s.heading}>{connected ? 'Use a new key' : 'Connect'}</h2>
          <label style={s.label}>
            Connection key from Inventory
            <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} aria-label="Connection key" />
          </label>
          <button style={s.primary} disabled={busy || key.trim().length < 16}
            onClick={() => act(async () => { await connectInventory({ key: key.trim() }); setKey('') }, 'Connected.')}>
            {connected ? 'Replace key' : 'Connect'}
          </button>
        </section>
      )}

      {manage && data.mode !== 'STANDALONE' && (
        <section style={s.card}>
          <h2 style={s.heading}>When Inventory can't be reached</h2>
          {[['SELL', 'Keep selling', 'Sales are saved and sent when Inventory is back. The last piece might already be gone.'],
            ['CHECK_SHELF', 'Ask the cashier to check the shelf', 'For the last few pieces only. Everything else keeps selling.']].map(([v, label, hint]) => (
            <label key={v} style={s.radio}>
              <input type="radio" name="whenDown" checked={data.whenDown === v} disabled={busy}
                onChange={() => act(() => setInventoryWhenDown(v), 'Saved.')} />
              <span><b>{label}</b><div style={s.muted}>{hint}</div></span>
            </label>
          ))}
        </section>
      )}

      {manage && connected && (
        <button disabled={busy} onClick={() => { if (window.confirm('Disconnect from Inventory? The till keeps selling from its own list.')) act(disconnectInventory, 'Disconnected.') }}>
          Disconnect
        </button>
      )}

      {!manage && <p style={s.muted}>Only the owner can change the Inventory link.</p>}
    </div>
  )
}

const Row = ({ label, value }) => (
  <div style={s.row}><span style={s.muted}>{label}</span><span>{value}</span></div>
)

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  title: { margin: 0, fontSize: 22 },
  lead: { margin: 0 },
  heading: { margin: '0 0 6px', fontSize: 13, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  card: { display: 'grid', gap: 8, padding: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)', boxShadow: 'var(--shadow)' },
  alert: { display: 'grid', gap: 8, padding: 14, border: '1px solid var(--line)', borderRadius: 12, color: 'var(--bad)' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  radio: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 },
  list: { margin: 0, paddingLeft: 18, display: 'grid', gap: 4 },
  problem: { fontSize: 13 },
  notes: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  note: { display: 'grid', gap: 4, padding: '12px 0', borderBottom: '1px solid var(--line)', fontSize: 14 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  warn: { margin: 0, color: 'var(--warn)', fontSize: 13 },
  muted: { color: 'var(--ink-soft)', fontSize: 12, margin: 0 },
  bad: { color: 'var(--bad)' }
}
