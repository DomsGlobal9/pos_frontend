import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CreditCard } from 'lucide-react'
import { loadCardMachines, addCardMachine, changeCardMachine, messageFor } from '../lib/api.js'

/**
 * Card machines (24 Oct). The owner adds the shop's Pine Labs or Razorpay POS machine with the ids its
 * company gave; the payment screen then offers "Send ₹X to the card machine". The keys go to the server,
 * encrypted, and are never shown again -- a change with a key left blank keeps the old one.
 *
 * Any other machine (Paytm, Mswipe, a bank's) needs nothing here: the cashier types the slip.
 */
export default function CardMachinesSettings({ owner, counters = [] }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['card-machines', 'all'], queryFn: () => loadCardMachines(true), enabled: owner })
  const machines = data?.machines ?? []
  const providers = data?.providers ?? []
  const [form, setForm] = useState(null)   // { id?, name, provider, testMode, counterId, config }
  const [busy, setBusy] = useState(false)
  const fields = providers.find(p => p.key === form?.provider)?.fields ?? []

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['card-machines'] })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = { name: form.name, testMode: form.testMode, counterId: form.counterId || null }
      if (form.id) {
        const typed = Object.values(form.config).some(v => v.trim())
        await changeCardMachine(form.id, { ...body, ...(typed ? { config: form.config } : {}) })
      } else {
        await addCardMachine({ ...body, provider: form.provider, config: form.config })
      }
      toast.success(form.testMode ? 'Saved, on the test system. Try a sale, then switch it to live.' : 'Saved. The payment screen offers it now.')
      setForm(null); refresh()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  async function flip(m, change) {
    try { await changeCardMachine(m.id, change); refresh() } catch (err) { toast.error(messageFor(err)) }
  }

  return (
    <section style={s.card} aria-label="Card machines">
      <div style={s.head}><span style={s.icon}><CreditCard size={18} aria-hidden="true" /></span><b>Card machines</b></div>
      <p style={s.muted}>
        With your Pine Labs or Razorpay POS machine here, the cashier sends the amount to it and the payment
        confirms itself — no slip to type. Any other machine works as today: the cashier types the slip's
        last 4 digits and approval code.
      </p>
      {!owner ? <p style={s.muted}>Only the owner can set up card machines.</p> : (
        <>
          {machines.map(m => (
            <div key={m.id} style={s.machine}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{m.name}</b> · {m.providerName}{m.testMode ? ' · test system' : ' · live'}{m.active ? '' : ' · off'}
                {m.label && <div style={s.muted}>{m.label}</div>}
              </div>
              <button type="button" onClick={() => setForm({ id: m.id, name: m.name, provider: m.provider, testMode: m.testMode, counterId: m.counterId ?? '', config: {} })}>Change</button>
              <button type="button" onClick={() => flip(m, { active: !m.active })}>{m.active ? 'Switch off' : 'Switch on'}</button>
            </div>
          ))}
          {!form && (
            <div style={s.actions}>
              <button type="button" onClick={() => setForm({ name: '', provider: providers[0]?.key ?? 'PINELABS_CLOUD', testMode: true, counterId: counters[0]?.id ?? '', config: {} })}>Add a card machine</button>
            </div>
          )}
          {form && (
            <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
              <label style={s.label}>
                Name
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Counter 1 card machine" maxLength={60} required />
              </label>
              {!form.id && (
                <label style={s.label}>
                  Company
                  <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value, config: {} })}>
                    {providers.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                </label>
              )}
              {fields.map(f => (
                <label key={f.key} style={s.label}>
                  {f.label}{form.id && f.secret ? ' (leave empty to keep the one saved)' : ''}
                  <input
                    value={form.config[f.key] ?? ''}
                    onChange={e => setForm({ ...form, config: { ...form.config, [f.key]: e.target.value } })}
                    type={f.secret ? 'password' : 'text'} autoComplete="off" maxLength={200}
                    required={!form.id} aria-label={f.label}
                  />
                </label>
              ))}
              {counters.length > 1 && (
                <label style={s.label}>
                  Sits at
                  <select value={form.counterId} onChange={e => setForm({ ...form, counterId: e.target.value })}>
                    <option value="">Any counter</option>
                    {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                <input type="checkbox" checked={form.testMode} onChange={e => setForm({ ...form, testMode: e.target.checked })} />
                Test system (no real money). Untick once a test sale has worked.
              </label>
              <div style={s.actions}>
                <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}

const s = {
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  actions: { display: 'flex', gap: 8 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  machine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 12 },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 }
}
