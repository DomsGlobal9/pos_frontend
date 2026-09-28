import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { UserPlus } from 'lucide-react'
import { loadStaff, addStaff, changeStaff, closeEveryTill, messageFor } from '../lib/api.js'
import { tillClosed } from '../lib/session.js'

/**
 * Staff, for the owner. POS-CORE-002, POS-SET-008. Approved layout 27 Sep.
 *
 * Each person: a name, a role, a 4-digit PIN to take the till. Owners and managers may also get a
 * password -- that is what opens the till on a device in the morning. Removing someone keeps their
 * name on every bill they made; they simply cannot sign in any more.
 */
const ROLES = [['CASHIER', 'Cashier'], ['MANAGER', 'Manager'], ['OWNER', 'Owner']]

export default function Staff() {
  const { shop } = useOutletContext() ?? {}
  const owner = (shop?.permissions ?? []).includes('settings:manage')
  const queryClient = useQueryClient()
  const { data: people = [], isLoading } = useQuery({ queryKey: ['staff'], queryFn: loadStaff, enabled: owner })
  const [adding, setAdding] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] })

  if (!owner) return <div style={s.page}><h1 style={{ margin: 0 }}>Staff</h1><p style={s.muted}>Only the owner can change who works the till.</p></div>

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { name: adding.name, role: adding.role, pin: adding.pin, email: adding.email || null, phone: adding.phone || null, password: adding.password || null }
      const p = await addStaff(body)
      toast.success(`${p.name} can now take the till with their PIN.`)
      setAdding(null); refresh()
    } catch (err) { toast.error(messageFor(err)) } finally { setBusy(false) }
  }
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = {}
      if (editing.name !== editing.orig.name) body.name = editing.name
      if (editing.role !== editing.orig.role) body.role = editing.role
      if (editing.pin) body.pin = editing.pin
      if (editing.password) body.password = editing.password
      if ((editing.email ?? '') !== (editing.orig.email ?? '')) body.email = editing.email || null
      if (Object.keys(body).length === 0) { setEditing(null); return }
      await changeStaff(editing.orig.id, body)
      toast.success('Saved.')
      setEditing(null); refresh()
    } catch (err) { toast.error(messageFor(err)) } finally { setBusy(false) }
  }
  async function setActive(p, active) {
    if (!active && !window.confirm(`Remove ${p.name}? They can no longer sign in. Their name stays on the bills they made.`)) return
    try { await changeStaff(p.id, { active }); toast(active ? `${p.name} is back.` : `${p.name} removed.`); refresh() } catch (err) { toast.error(messageFor(err)) }
  }

  const needsPassword = (role) => role === 'OWNER' || role === 'MANAGER'

  return (
    <div style={s.page}>
      <div style={s.headRow}>
        <h1 style={{ margin: 0 }}>Staff</h1>
        {!adding && <button onClick={() => setAdding({ name: '', role: 'CASHIER', pin: '', email: '', phone: '', password: '' })}><UserPlus size={16} aria-hidden="true" /> Add person</button>}
      </div>
      <p style={s.muted}>Everyone takes the till with their own 4-digit PIN, so each bill shows who made it. Owners and managers can also have a password to open the till in the morning.</p>

      {adding && (
        <form onSubmit={add} style={s.card} aria-label="Add person">
          <label style={s.label}>Name<input value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} aria-label="Name" autoFocus placeholder="Ravi" /></label>
          <Role value={adding.role} onChange={role => setAdding({ ...adding, role })} />
          <label style={s.label}>4-digit PIN<input value={adding.pin} onChange={e => setAdding({ ...adding, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" aria-label="PIN" placeholder="0000" /></label>
          {needsPassword(adding.role) && (
            <>
              <label style={s.label}>Email or phone to open the till with (optional)<input value={adding.email} onChange={e => setAdding({ ...adding, email: e.target.value })} aria-label="Email" placeholder="suresh@yourshop.in" /></label>
              <label style={s.label}>Password (optional, 8 or more)<input type="password" value={adding.password} onChange={e => setAdding({ ...adding, password: e.target.value })} aria-label="Password" autoComplete="new-password" /></label>
            </>
          )}
          <div style={s.actions}>
            <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
            <button type="button" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        </form>
      )}

      {isLoading && <p style={s.muted}>Loading…</p>}

      {/* A lost or stolen tablet: every open till of the shop stops at once, this one included. */}
      <button style={{ ...s.danger, justifySelf: 'start' }} onClick={async () => {
        if (!window.confirm('Close the till on every device of this shop, including this one? Everyone will need an owner or manager to open it again.')) return
        try { const r = await closeEveryTill(); toast(`${r.closed} till${r.closed === 1 ? '' : 's'} closed.`); tillClosed() } catch (err) { toast.error(messageFor(err)) }
      }}>Close the till on every device</button>
      <ul className="card-list" style={s.list}>
        {people.map(p => (
          <li key={p.id} style={s.row} data-person={p.name}>
            {editing?.orig.id === p.id ? (
              <form onSubmit={save} style={{ display: 'grid', gap: 10, width: '100%' }} aria-label={`Change ${p.name}`}>
                <label style={s.label}>Name<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} aria-label="Name" /></label>
                {!p.isYou && <Role value={editing.role} onChange={role => setEditing({ ...editing, role })} />}
                <label style={s.label}>New PIN (leave empty to keep)<input value={editing.pin} onChange={e => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" aria-label="New PIN" /></label>
                {needsPassword(editing.role) && (
                  <>
                    <label style={s.label}>Email to open the till with<input value={editing.email ?? ''} onChange={e => setEditing({ ...editing, email: e.target.value })} aria-label="Email" /></label>
                    <label style={s.label}>New password (leave empty to keep)<input type="password" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} aria-label="New password" autoComplete="new-password" /></label>
                  </>
                )}
                <div style={s.actions}>
                  <button type="submit" style={s.primary} disabled={busy}>Save</button>
                  <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ minWidth: 0 }}>
                  <div style={s.name}>{p.name}{p.isYou ? ' (you)' : ''}</div>
                  <div style={s.muted}>
                    {p.roleLabel} · {p.hasPin ? 'PIN set' : 'no PIN yet'}{p.hasPassword ? ' · can open the till' : ''}{!p.active ? ' · removed' : ''}
                  </div>
                </div>
                <div style={s.actions}>
                  {p.active && <button onClick={() => setEditing({ orig: p, name: p.name ?? '', role: p.role, pin: '', password: '', email: p.email ?? '' })}>Change</button>}
                  {p.active && !p.isYou && <button style={s.danger} onClick={() => setActive(p, false)}>Remove</button>}
                  {!p.active && <button onClick={() => setActive(p, true)}>Bring back</button>}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Role({ value, onChange }) {
  return (
    <fieldset style={s.fieldset}>
      <legend style={s.legend}>Role</legend>
      <div style={s.actions}>
        {ROLES.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            style={value === v ? s.primary : undefined}>{label}</button>
        ))}
      </div>
    </fieldset>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  fieldset: { border: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 },
  legend: { fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  danger: { color: 'var(--bad)' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' },
  name: { fontWeight: 600 },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0, lineHeight: 1.5 }
}
