import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery } from '../lib/query.js'
import toast from 'react-hot-toast'
import { loadInventoryLink, connectInventory, disconnectInventory, retryInventory, leaveOutOfInventory, syncInventoryItems, setInventoryWhenDown, resendInventoryFrom, messageFor } from '../lib/api.js'
import { askYesNo } from '../components/Ask.jsx'
import { BackButton } from '../components/NavLinks.jsx'

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
  // Leaving the stopped bill out: opened on purpose, with a reason, never one click.
  const [leaving, setLeaving] = useState(false)
  const [why, setWhy] = useState('')
  const [resendDoc, setResendDoc] = useState('')
  // A repair tool, not a daily one: closed until someone needs it (17 Nov, owner: "what's this for?").
  const [resendOpen, setResendOpen] = useState(false)

  // The shop too: the header's "Inventory connected" comes from it, and it is otherwise kept for good.
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['inventory-link'] }); queryClient.invalidateQueries({ queryKey: ['shop'] }) }

  async function act(fn, done) {
    setBusy(true)
    try { const result = await fn(); if (done) toast.success(typeof done === 'function' ? done(result) : done); refresh() }
    catch (err) { toast.error(messageFor(err)) }
    finally { setBusy(false) }
  }

  /*
   * A key for another shop in Inventory is refused (12 Nov: Swathy's key went into sphl's till). The
   * owner is asked once, plainly; only "it has moved" connects it, and the items start afresh.
   */
  async function useKey() {
    setBusy(true)
    try {
      try { await connectInventory({ key: key.trim() }) }
      catch (err) {
        const d = err?.response?.data?.details
        if (d?.code !== 'SHOP_CHANGED') throw err
        const name = d.nowName ? `${d.nowName} (${d.now})` : d.now
        const moved = await askYesNo(`This key is for ${name}, not ${d.was}`, {
          note: `This till sends to ${d.was}. If the key was made in the wrong shop, choose Cancel and make one while in ${d.was} in Inventory. Only if this till has really moved to ${name}, connect it there.`,
          confirmLabel: `Move till to ${d.now}`, danger: true
        })
        if (!moved) return
        await connectInventory({ key: key.trim(), moveTo: d.now })
      }
      setKey('')
      toast.success('Connected.')
      refresh()
    } catch (err) { toast.error(messageFor(err)) }
    finally { setBusy(false) }
  }

  if (isLoading) return <p style={s.page}>Loading…</p>
  if (isError) return <p style={{ ...s.page, ...s.bad }}>{messageFor(error)}</p>

  const connected = data.mode === 'CONNECTED'
  const manage = data.mayManage

  return (
    <div style={s.page}><BackButton />
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
          {manage && data.blocked.mayLeaveOut && data.blocked.document && !leaving && (
            <button style={s.quiet} disabled={busy} onClick={() => { setWhy(''); setLeaving(true) }}>
              It can't be fixed — leave this bill out of Inventory
            </button>
          )}
          {manage && leaving && (
            <div style={s.leave}>
              <b style={s.ink}>Leave {data.blocked.document} out of Inventory?</b>
              <p style={s.inkSmall}>
                Only when it can't be fixed in Inventory (for example, the item was deleted there for good).
                The bills waiting behind it are sent straight away. The items on this bill stay counted in
                Inventory's stock, so fix that there by hand. Inventory will be told the bill number, your reason
                and your name.
              </p>
              <label style={s.label}>
                Why
                <textarea rows={2} value={why} onChange={e => setWhy(e.target.value)} aria-label="Why leave it out"
                  placeholder="The saree was deleted in Inventory and can't be brought back" />
              </label>
              <div style={s.buttons}>
                <button type="button" disabled={busy} onClick={() => setLeaving(false)}>Back</button>
                <button type="button" style={s.danger} disabled={busy || why.trim().length < 10}
                  onClick={() => act(async () => { const r = await leaveOutOfInventory(data.blocked.document, why.trim()); setLeaving(false); return r },
                    (r) => `Left out. ${r.sent?.sent ?? 0} waiting bills sent.`)}>
                  {busy ? 'Working…' : 'Leave it out'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {data.mode !== 'STANDALONE' && (
        <section style={s.card}>
          <Row label="Status" value={connected ? 'Connected' : 'Disconnected'} />
          <Row label="Key" value={`${data.keyPrefix}…`} />
          {/* Which shop in Inventory the bills go to: a key from another shop shows at once (12 Nov). */}
          <Row label="Inventory shop" value={data.inventoryShop ?? 'Not known yet'} />
          {/* 12 Nov: Inventory tells the till the moment items, stock or settings change. */}
          <Row label="Instant updates from Inventory" value={!data.pushes?.on
            ? 'Not set up yet -- the till checks every 30 seconds'
            : data.pushes.lastAt ? `On · last ${new Date(data.pushes.lastAt).toLocaleString('en-IN')}` : 'On · none yet'} />
          {/* 12 Nov: people erased in Inventory are forgotten here too. Checked every five minutes. */}
          <Row label="Erased in Inventory, checked" value={data.erasures?.checkedAt
            ? `${new Date(data.erasures.checkedAt).toLocaleString('en-IN')} · ${data.erasures.forgotten} forgotten here`
            : 'Not yet'} />
          <Row label="Waiting to send" value={String(data.waiting)} />
          {/* Taken in by Inventory, which applies them a few seconds later. */}
          <Row label="Being applied in Inventory" value={String(data.settling ?? 0)} />
          <Row label="Last sent" value={data.lastDeliveredAt ? new Date(data.lastDeliveredAt).toLocaleString('en-IN') : 'Nothing yet'} />
          {data.lastError && !data.blocked && <p style={s.warn}>{data.lastError} It will try again by itself.</p>}
          <Row label="Items last refreshed" value={data.catalogueSyncedAt ? new Date(data.catalogueSyncedAt).toLocaleString('en-IN') : 'Never'} />
        </section>
      )}

      {/* 28 Oct: customers made or changed at the counter, and consent ticked there, go to ScaleEzy CRM. */}
      {/* 20 Nov (the owner): a module's screens only when the shop uses it. CRM has taken this shop's customers before. */}
      {connected && data.crm?.configured && !data.crm.notOnCrm && (data.crm.lastSentAt || data.crm.setAside > 0) && (
        <section style={s.card} aria-label="Customers to CRM">
          <Row label="Customers to CRM, waiting" value={String(data.crm.waiting)} />
          <Row label="Last sent to CRM" value={data.crm.lastSentAt ? new Date(data.crm.lastSentAt).toLocaleString('en-IN') : 'Nothing yet'} />
          {data.crm.setAside > 0 && <p style={s.warn}>{data.crm.setAside} could not be taken by CRM. Ask ScaleEzy support.</p>}
          {data.crm.problem && <p style={s.warn}>{data.crm.problem} It will try again by itself.</p>}
        </section>
      )}

      {/* 19 Nov: ScaleEzy CRM owns who a customer is; the till links each of its customers to CRM's one person. */}
      {connected && data.crmLink?.on && (
        <section style={s.card} aria-label="Customers linked to CRM">
          <h2 style={s.heading}>Customers in ScaleEzy CRM</h2>
          <Row label="Linked" value={String(data.crmLink.linked)} />
          <Row label="Waiting to link" value={String(data.crmLink.waiting)} />
          <Row label="Last linked" value={data.crmLink.lastLinkedAt ? shortWhen(data.crmLink.lastLinkedAt) : 'Not yet'} />
          <Row label="Last from CRM" value={!data.crmLink.eventsOn ? 'Not set up yet' : data.crmLink.lastEventAt ? shortWhen(data.crmLink.lastEventAt) : 'None yet'} />
          {data.crmLink.problem && <p style={s.muted}>{data.crmLink.problem} It tries again by itself; selling is never held up.</p>}
        </section>
      )}

      {/* 20 Nov: whether Inventory links a boutique (the Boutique app billing here), and when POS last asked. */}
      {connected && data.boutique?.tenant && (
        <section style={s.card} aria-label="The Boutique app">
          <h2 style={s.heading}>The Boutique app</h2>
          <Row label="Boutique" value={`${data.boutique.tenant}${data.boutique.paused ? ' (paused)' : ''}`} />
          <Row label="Last checked" value={data.boutique.lastCheckedAt ? shortWhen(data.boutique.lastCheckedAt) : 'Not yet'} />
          {data.boutique.lastAnswer && <p style={s.muted}>{data.boutique.lastAnswer}</p>}
        </section>
      )}

      {/* 25 Nov (owner: "everything should load automatically"): items, prices and stock come in by
          themselves -- Inventory tells the till within seconds, and the till checks every 30 seconds
          besides. So no big button that suggests otherwise: a quiet one for when someone wants to be sure. */}
      {connected && (
        <div style={s.auto}>
          <p style={s.inkSmall}>Items, prices and stock come in from Inventory by themselves, within seconds of a change there.</p>
          <button type="button" style={s.quiet} disabled={busy}
            onClick={() => act(syncInventoryItems, (r) => (r.added || r.updated || r.switchedOff)
              ? `${r.added} added, ${r.updated} updated${r.switchedOff ? `, ${r.switchedOff} switched off` : ''}.`
              : 'Up to date. Nothing new in Inventory.')}>
            {busy ? 'Checking…' : 'Check Inventory now'}
          </button>
        </div>
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

      {/* Kept on the screen for good: a gap in Inventory that somebody chose, and why. */}
      {data.leftOut?.length > 0 && (
        <section>
          <h2 style={s.heading}>Left out of Inventory</h2>
          <ul style={s.notes} className="card-list">
            {data.leftOut.map((x, i) => (
              <li key={i} style={s.note}>
                <span className="chip warn" style={{ justifySelf: 'start' }}>{x.document}</span>
                <span>{x.reason}</span>
                <span style={s.muted}>
                  {x.skippedBy ?? 'Someone'} · {new Date(x.skippedAt).toLocaleString('en-IN')}
                  {x.refusedText ? ` · Inventory had said: ${x.refusedText}` : ''}
                  {x.reportedAt ? ' · Inventory told' : ' · Inventory not told yet'}
                </span>
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
            <span style={s.muted}>In Inventory: Settings → Money → POS (billing counter) → Create key. It is shown once -- copy it straight here.</span>
          </label>
          <button style={s.primary} disabled={busy || key.trim().length < 16} onClick={useKey}>
            {connected ? 'Replace key' : 'Connect'}
          </button>
        </section>
      )}

      {/* 12 Nov: two bills went to another shop under a wrong key. Send them again to this one. */}
      {manage && connected && !resendOpen && (
        <p style={{ margin: 0 }}>
          <button type="button" className="btn-quiet" onClick={() => setResendOpen(true)}>Bills went to the wrong shop in Inventory?</button>
        </p>
      )}
      {manage && connected && resendOpen && (
        <section style={s.card}>
          <h2 style={s.heading}>Send bills again</h2>
          <label style={s.label}>
            From bill or credit note
            <input value={resendDoc} onChange={e => setResendDoc(e.target.value)} placeholder="For example INV/2026-27/0004" aria-label="Send again from" autoFocus />
            <span style={s.muted}>Only when bills went to the wrong shop in Inventory. That one and everything after it go again to {data.inventoryShop ?? 'this shop'}; what Inventory already has is skipped.</span>
          </label>
          <button disabled={busy || !resendDoc.trim()} onClick={async () => {
            if (await askYesNo(`Send again from ${resendDoc.trim()}?`, { note: `To ${data.inventoryShop ?? 'the shop this till is connected to'} in Inventory.`, confirmLabel: 'Send again' })) {
              act(async () => { const r = await resendInventoryFrom(resendDoc.trim()); setResendDoc(''); return r }, r => (r.resent ? `${r.resent} sent again.` : 'Not sent yet -- it goes by itself.'))
            }
          }}>Send again</button>
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
        <button disabled={busy} onClick={async () => { if (await askYesNo('Disconnect from Inventory?', { note: 'The till keeps selling from its own list.', confirmLabel: 'Disconnect', danger: true })) act(disconnectInventory, 'Disconnected.') }}>
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

/** A day and a time, short enough for one line on a phone: 19 Nov, 3:50 pm. */
const shortWhen = (at) => new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

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
  bad: { color: 'var(--bad)' },
  quiet: { justifySelf: 'start', color: 'var(--ink-soft)' },
  auto: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  leave: { display: 'grid', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel)' },
  ink: { color: 'var(--ink)' },
  inkSmall: { margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.5 },
  buttons: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  danger: { background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' }
}
