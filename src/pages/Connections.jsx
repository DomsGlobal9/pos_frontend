import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, Send, FileSpreadsheet, ReceiptIndianRupee, Download, Upload, Copy } from 'lucide-react'
import {
  loadApiKeys, createApiKey, revokeApiKey, loadWebhooks, createWebhook, updateWebhook, removeWebhook,
  testWebhook, loadDeliveries, resendDelivery, importItems, download, messageFor
} from '../lib/api.js'
import { askYesNo } from '../components/Ask.jsx'

/**
 * WF-INTEGRATIONS-01. Connections, for the owner. Approved layout 27 Sep: one page, four sections.
 *
 *   Your other software            API keys (shown once), what each may do, stop a key   POS-API-001
 *   Send updates to your software  addresses told about each sale / day close           POS-WEB-001, -006
 *   Import items from Excel        check first, nothing saved until every row is right  POS-EXP-001
 *   Sales for your accountant      CSV or Excel for a date range                        POS-EXP-002
 *
 * Plain words throughout (MASTER §2 rule 5): "key", "address", "update" -- never "webhook",
 * "endpoint", "idempotency" or a status code on its own.
 */
const SCOPES = [
  ['sales:read', 'Read sales and bills'],
  ['day:read', 'Read day totals'],
  ['customers:read', 'Look up customers by phone'],
  ['items:write', 'Send items and prices']
]
const EVENTS = [
  ['sale.completed', 'Sales'],
  ['sale.returned', 'Returns'],
  ['sale.exchanged', 'Exchanges'],
  ['payment.updated', 'Money after the bill'],
  ['day.closed', 'Day close']
]
const when = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''

export default function Connections() {
  const { shop } = useOutletContext() ?? {}
  const perms = shop?.permissions ?? []
  const owner = perms.includes('integration:manage')
  const reports = perms.includes('report:view')

  return (
    <div style={s.page}>
      <h1 style={{ margin: 0 }}>Connections</h1>
      {!owner && <p style={s.muted}>Only the owner can set up connections to other software.{reports ? ' You can still download sales for the accountant below.' : ''}</p>}
      {owner && <Keys />}
      {owner && <Updates />}
      {owner && <Import />}
      {reports && <Export />}
    </div>
  )
}

function Section({ Icon, title, hint, action, children }) {
  return (
    <section style={s.card}>
      <div style={s.headRow}>
        <div style={s.head}>
          <span style={s.icon}><Icon size={18} aria-hidden="true" /></span>
          <div style={{ minWidth: 0 }}>
            <h2 style={s.h2}>{title}</h2>
            <p style={s.muted}>{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Shown({ label, value, onDone }) {
  return (
    <div style={s.shown} role="status">
      <div>{label} Copy it now — it won't be shown again.</div>
      <code style={s.code} data-secret>{value}</code>
      <div style={s.actions}>
        <button style={s.primary} onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success('Copied.'), () => toast.error('Copy it by hand.'))}>
          <Copy size={15} aria-hidden="true" /> Copy
        </button>
        <button onClick={onDone}>Done</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
function Keys() {
  const queryClient = useQueryClient()
  const { data: keys = [] } = useQuery({ queryKey: ['api-keys'], queryFn: loadApiKeys })
  const [form, setForm] = useState(null)
  const [made, setMade] = useState(null)
  const [busy, setBusy] = useState(false)

  async function make(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await createApiKey({ name: form.name.trim(), scopes: form.scopes })
      setMade(r.key)
      setForm(null)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    } catch (err) { toast.error(messageFor(err)) } finally { setBusy(false) }
  }
  async function stop(k) {
    if (!await askYesNo(`Stop "${k.name}"?`, { note: 'Software using it stops working at once. This cannot be undone -- make a new key instead.', confirmLabel: 'Stop the key', danger: true })) return
    try {
      await revokeApiKey(k.id)
      toast('Key stopped.')
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    } catch (err) { toast.error(messageFor(err)) }
  }
  const live = keys.filter(k => !k.revokedAt)

  return (
    <Section Icon={KeyRound} title="Your other software" hint="Keys that let your accounts or website software read sales and send items."
      action={!form && <button onClick={() => setForm({ name: '', scopes: ['sales:read', 'day:read'] })}>New key</button>}>
      {made && <Shown label="New key made." value={made} onDone={() => setMade(null)} />}
      {form && (
        <form onSubmit={make} style={s.form}>
          <label style={s.label}>Name it after the software<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tally sync" aria-label="Key name" autoFocus /></label>
          <fieldset style={s.fieldset}>
            <legend style={s.legend}>It may</legend>
            {SCOPES.map(([v, label]) => (
              <label key={v} style={s.check}>
                <input type="checkbox" checked={form.scopes.includes(v)} onChange={e => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, v] : form.scopes.filter(x => x !== v) })} />
                {label}
              </label>
            ))}
          </fieldset>
          <div style={s.actions}>
            <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Making…' : 'Make key'}</button>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      {live.length === 0 && !form && !made && <p style={s.muted}>No keys yet.</p>}
      {live.length > 0 && (
        <ul style={s.list}>
          {live.map(k => (
            <li key={k.id} style={s.row}>
              <div style={{ minWidth: 0 }}>
                <div style={s.name}>{k.name} <span style={s.mono}>{k.keyPrefix}…</span></div>
                <div style={s.muted}>
                  {k.scopes.map(sc => SCOPES.find(x => x[0] === sc)?.[1] ?? sc).join(', ')} · {k.lastUsedAt ? `used ${when(k.lastUsedAt)}` : 'never used'}
                </div>
              </div>
              <button style={s.danger} onClick={() => stop(k)}>Stop this key</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ------------------------------------------------------------------------------------------------
function Updates() {
  const queryClient = useQueryClient()
  const { data: hooks = [] } = useQuery({ queryKey: ['webhooks'], queryFn: loadWebhooks, refetchInterval: 30_000 })
  const [form, setForm] = useState(null)
  const [made, setMade] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] })

  async function add(e) {
    e.preventDefault()
    if (form.events.length === 0) { toast.error('Choose at least one kind of update.'); return }
    setBusy(true)
    try {
      const r = await createWebhook({ name: form.name.trim(), url: form.url.trim(), events: form.events })
      setMade(r.secret)
      setForm(null)
      refresh()
    } catch (err) { toast.error(messageFor(err)) } finally { setBusy(false) }
  }
  async function test(h) {
    const t = toast.loading('Sending a test…')
    try {
      const r = await testWebhook(h.id)
      toast[r.received ? 'success' : 'error'](r.message, { id: t })
    } catch (err) { toast.error(messageFor(err), { id: t }) }
    refresh()
  }
  async function pause(h) {
    try { await updateWebhook(h.id, { active: !h.active }); refresh() } catch (err) { toast.error(messageFor(err)) }
  }
  async function remove(h) {
    if (!await askYesNo(`Remove "${h.name}"?`, { note: 'Updates waiting for it are dropped.', confirmLabel: 'Remove', danger: true })) return
    try { await removeWebhook(h.id); refresh() } catch (err) { toast.error(messageFor(err)) }
  }

  return (
    <Section Icon={Send} title="Send updates to your software" hint="Tell your software the moment a sale, return or day close happens."
      action={!form && <button onClick={() => setForm({ name: '', url: 'https://', events: ['sale.completed', 'day.closed'] })}>Add address</button>}>
      {made && <Shown label="Address added. Your software checks each update with this signing secret." value={made} onDone={() => setMade(null)} />}
      {form && (
        <form onSubmit={add} style={s.form}>
          <label style={s.label}>Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tally bridge" aria-label="Address name" autoFocus /></label>
          <label style={s.label}>Address<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://bridge.example.com/pos" aria-label="Address" inputMode="url" /></label>
          <fieldset style={s.fieldset}>
            <legend style={s.legend}>Send</legend>
            {EVENTS.map(([v, label]) => (
              <label key={v} style={s.check}>
                <input type="checkbox" checked={form.events.includes(v)} onChange={e => setForm({ ...form, events: e.target.checked ? [...form.events, v] : form.events.filter(x => x !== v) })} />
                {label}
              </label>
            ))}
          </fieldset>
          <div style={s.actions}>
            <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
            <button type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      {hooks.length === 0 && !form && !made && <p style={s.muted}>No addresses yet.</p>}
      {hooks.length > 0 && (
        <ul style={s.list}>
          {hooks.map(h => (
            <li key={h.id} style={{ ...s.row, display: 'grid', gap: 8 }} data-hook={h.name}>
              <div style={s.rowTop}>
                <div style={{ minWidth: 0 }}>
                  <div style={s.name}>{h.name}</div>
                  <div style={{ ...s.muted, overflowWrap: 'anywhere' }}>
                    {h.url} · {h.events.length === 0 ? 'everything' : h.events.map(e => EVENTS.find(x => x[0] === e)?.[1] ?? e).join(', ').toLowerCase()}
                  </div>
                </div>
                <State h={h} />
              </div>
              {h.waiting > 0 && <div style={s.muted}>{h.waiting === 1 ? '1 update' : `${h.waiting} updates`} waiting. We keep trying for about a day.</div>}
              {h.failed > 0 && <div style={{ ...s.muted, color: 'var(--bad)' }}>{h.failed === 1 ? '1 update' : `${h.failed} updates`} could not be delivered. Open History to send again.</div>}
              <div style={s.actions}>
                <button onClick={() => test(h)}>Test</button>
                <button onClick={() => setOpen(open === h.id ? null : h.id)}>{open === h.id ? 'Hide history' : 'History'}</button>
                <button onClick={() => pause(h)}>{h.active ? 'Pause' : 'Resume'}</button>
                <button style={s.danger} onClick={() => remove(h)}>Remove</button>
              </div>
              {open === h.id && <History id={h.id} onChange={refresh} />}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function State({ h }) {
  if (!h.active) return <span className="chip">Paused</span>
  if (h.failingSince) return <span className="chip bad">Not receiving since {when(h.failingSince)}</span>
  if (h.lastDeliveryAt) return <span className="chip good">Working · {when(h.lastDeliveryAt)}</span>
  return <span className="chip">Nothing sent yet</span>
}

function History({ id, onChange }) {
  const queryClient = useQueryClient()
  const { data: rows, isLoading } = useQuery({ queryKey: ['deliveries', id], queryFn: () => loadDeliveries(id), refetchInterval: 15_000 })
  const LABEL = { 'sale.completed': 'Sale', 'sale.returned': 'Return', 'sale.exchanged': 'Exchange', 'payment.updated': 'Money after the bill', 'day.closed': 'Day close', ping: 'Test' }
  async function again(d) {
    try {
      await resendDelivery(d.id)
      toast('Sending again.')
      queryClient.invalidateQueries({ queryKey: ['deliveries', id] })
      onChange()
    } catch (err) { toast.error(messageFor(err)) }
  }
  if (isLoading) return <p style={s.muted}>Loading…</p>
  if (!rows?.length) return <p style={s.muted}>Nothing sent to this address yet.</p>
  return (
    <ul style={s.history} aria-label="What was sent">
      {rows.map(d => (
        <li key={d.id} style={s.histRow}>
          <div style={{ minWidth: 0 }}>
            <div style={s.name}>{LABEL[d.eventType] ?? d.eventType}{d.document ? ` · ${d.document}` : ''}</div>
            <div style={s.muted}>{when(d.lastAttemptAt ?? d.deliveredAt)} · {d.outcome}{d.nextAttemptAt ? ` Next try ${when(d.nextAttemptAt)}.` : ''}</div>
          </div>
          {d.status === 'FAILED' && <button onClick={() => again(d)}>Send again</button>}
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------------------------------------
function Import() {
  const [file, setFile] = useState(null)
  const [check, setCheck] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const queryClient = useQueryClient()

  async function choose(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setCheck(null); setError(null)
    if (f.size > 5 * 1024 * 1024) { setError('That file is over 5 MB. Split it into smaller files.'); return }
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
      r.onerror = () => reject(r.error)
      r.readAsDataURL(f)
    })
    const payload = { name: f.name, base64 }
    setFile(payload)
    setBusy(true)
    try { setCheck(await importItems(payload, false)) } catch (err) { setError(messageFor(err)) } finally { setBusy(false) }
  }
  async function save() {
    setBusy(true)
    try {
      const r = await importItems(file, true)
      toast.success(`${r.added + r.updated} item${r.added + r.updated === 1 ? '' : 's'} saved.`)
      setCheck(null); setFile(null)
      queryClient.invalidateQueries()
    } catch (err) { setError(messageFor(err)) } finally { setBusy(false) }
  }
  const toSave = check ? check.added + check.updated : 0

  return (
    <Section Icon={FileSpreadsheet} title="Import items from Excel" hint="A .csv or .xlsx with code, name, price and GST. Checked first — nothing is saved until every row is right.">
      <div style={s.actions}>
        <button onClick={() => download('/connections/items/template.csv', {}, 'items-template.csv').catch(err => toast.error(messageFor(err)))}>
          <Download size={15} aria-hidden="true" /> Template
        </button>
        <button onClick={() => input.current?.click()} disabled={busy}><Upload size={15} aria-hidden="true" /> {busy && !check ? 'Checking…' : 'Choose file'}</button>
        <input ref={input} type="file" accept=".csv,.xlsx,.txt,.tsv" onChange={choose} style={{ display: 'none' }} aria-label="Item file" />
      </div>
      {error && <p style={s.bad} role="alert">{error}</p>}
      {check && (
        <div style={{ display: 'grid', gap: 10 }} data-import-check>
          <div style={s.muted}>{file?.name}: {check.rows} row{check.rows === 1 ? '' : 's'}</div>
          <div style={s.stats}>
            <Stat label="New" value={check.added} />
            <Stat label="Changed" value={check.updated} />
            <Stat label="Same as now" value={check.unchanged} />
            <Stat label="To fix" value={check.problems.length} bad={check.problems.length > 0} />
          </div>
          {check.problems.length > 0 && (
            <>
              <ul style={s.problems}>{check.problems.slice(0, 50).map(p => <li key={p}>{p}</li>)}</ul>
              {check.problems.length > 50 && <p style={s.muted}>…and {check.problems.length - 50} more.</p>}
              <p style={s.muted}>Fix these in your sheet and choose it again. Import stays off until then.</p>
            </>
          )}
          {check.notes.length > 0 && <ul style={s.notes}>{check.notes.slice(0, 20).map(n => <li key={n}>{n}</li>)}</ul>}
          {check.ignoredColumns.length > 0 && <p style={s.muted}>Columns not used: {check.ignoredColumns.join(', ')}.</p>}
          {check.problems.length === 0 && (
            <div style={s.actions}>
              <button style={s.primary} onClick={save} disabled={busy || toSave === 0}>
                {busy ? 'Saving…' : toSave === 0 ? 'Nothing to change' : `Import ${toSave} item${toSave === 1 ? '' : 's'}`}
              </button>
              <button onClick={() => { setCheck(null); setFile(null) }}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

function Stat({ label, value, bad }) {
  return (
    <div style={s.stat}>
      <div style={s.muted}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: bad ? 'var(--bad)' : 'var(--ink)' }}>{value}</div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
function Export() {
  const pad = (n) => String(n).padStart(2, '0')
  const d = new Date()
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const [from, setFrom] = useState(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`)
  const [to, setTo] = useState(today)
  const [busy, setBusy] = useState(null)

  async function get(kind) {
    if (!from || !to) { toast.error('Choose both dates.'); return }
    if (to < from) { toast.error('The end date is before the start date.'); return }
    setBusy(kind)
    try { await download(`/connections/exports/sales.${kind}`, { from, to }, `sales-${from}-to-${to}.${kind}`) }
    catch (err) { toast.error(messageFor(err)) }
    finally { setBusy(null) }
  }

  return (
    <Section Icon={ReceiptIndianRupee} title="Sales for your accountant" hint="Every bill and credit note with the GST split. Excel has three sheets: bills, GST by rate, days.">
      <div style={s.dates}>
        <label style={s.label}>From<input type="date" value={from} max={today} onChange={e => setFrom(e.target.value)} aria-label="From" /></label>
        <label style={s.label}>To<input type="date" value={to} max={today} onChange={e => setTo(e.target.value)} aria-label="To" /></label>
      </div>
      <div style={s.actions}>
        <button style={s.primary} onClick={() => get('xlsx')} disabled={!!busy}>{busy === 'xlsx' ? 'Preparing…' : 'Download Excel'}</button>
        <button onClick={() => get('csv')} disabled={!!busy}>{busy === 'csv' ? 'Preparing…' : 'Download CSV'}</button>
      </div>
    </Section>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 820, alignContent: 'start' },
  card: { display: 'grid', gap: 12, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', minWidth: 0 },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  head: { display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: '1 1 260px' },
  h2: { margin: 0, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  form: { display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'var(--panel-soft)', border: '1px solid var(--line)' },
  fieldset: { border: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  legend: { fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 32 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  danger: { color: 'var(--bad)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  name: { fontWeight: 600, overflowWrap: 'anywhere' },
  mono: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 400 },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0, lineHeight: 1.45 },
  bad: { margin: 0, padding: '8px 12px', borderRadius: 10, background: 'var(--bad-tint)', color: 'var(--bad)', fontSize: 14 },
  shown: { display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'var(--warn-tint)', color: 'var(--warn)', fontSize: 14 },
  code: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', padding: '8px 10px', borderRadius: 8, overflowWrap: 'anywhere' },
  history: { listStyle: 'none', margin: 0, padding: '4px 12px', display: 'grid', background: 'var(--panel-soft)', borderRadius: 12, border: '1px solid var(--line)' },
  histRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 },
  stat: { background: 'var(--panel-soft)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' },
  problems: { margin: 0, padding: '10px 12px 10px 28px', borderRadius: 10, background: 'var(--bad-tint)', color: 'var(--bad)', fontSize: 14, lineHeight: 1.6 },
  notes: { margin: 0, padding: '10px 12px 10px 28px', borderRadius: 10, background: 'var(--warn-tint)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.6 },
  dates: { display: 'flex', gap: 12, flexWrap: 'wrap' }
}
