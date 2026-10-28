import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Store } from 'lucide-react'
import { setShopDetails, messageFor } from '../lib/api.js'

/**
 * The shop's own details, for a shop without Inventory (28 Oct): what every bill prints at the top and
 * bottom, the most a cashier takes off without a manager, and how long returns are taken. Before this
 * they were "set up by ScaleEzy". Bills already given out keep the details they were issued with.
 * Connected shops get these from Inventory and see them here, read-only.
 */
export default function ShopDetailsSettings({ shop, owner, connected }) {
  const queryClient = useQueryClient()
  const now = shop?.shop ?? {}
  const initial = () => ({
    shopName: now.shopName ?? '', address: now.address ?? '', phone: now.phone ?? '', gstin: now.gstin ?? '',
    receiptFooter: now.receiptFooter ?? '', manualDiscountMaxPercent: String(now.manualDiscountMaxPercent ?? 0),
    returnWindowDays: now.returnWindowDays === null || now.returnWindowDays === undefined ? '' : String(now.returnWindowDays)
  })
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const editing = form !== null
  const f = form ?? initial()
  const set = (k, v) => setForm({ ...f, [k]: v })
  const readOnly = connected || !owner

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await setShopDetails({
        shopName: f.shopName, address: f.address, phone: f.phone, gstin: f.gstin, receiptFooter: f.receiptFooter,
        manualDiscountMaxPercent: Number(f.manualDiscountMaxPercent || 0),
        returnWindowDays: f.returnWindowDays.trim() === '' ? null : Number(f.returnWindowDays)
      })
      toast.success('Saved. Bills from now on print these; bills already given out keep theirs.')
      queryClient.invalidateQueries({ queryKey: ['shop'] })
      setForm(null)
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  const field = (key, label, props = {}) => (
    <label style={s.label}>
      {label}
      <input value={f[key]} onChange={e => set(key, e.target.value)} disabled={readOnly || busy} aria-label={label} {...props} />
    </label>
  )

  return (
    <section style={s.card} aria-label="Shop details">
      <div style={s.head}><span style={s.icon}><Store size={18} aria-hidden="true" /></span><b>Shop details</b></div>
      <p style={s.muted}>
        Printed on every bill. Bills already given out keep the details they were issued with.
      </p>
      <form onSubmit={save} style={s.grid}>
        {field('shopName', 'Shop name', { maxLength: 80, required: true })}
        {field('phone', 'Phone', { maxLength: 30, inputMode: 'tel' })}
        <label style={{ ...s.label, gridColumn: '1 / -1' }}>
          Address
          <textarea value={f.address} onChange={e => set('address', e.target.value)} disabled={readOnly || busy} aria-label="Address" rows={2} maxLength={200} />
        </label>
        {field('gstin', 'GSTIN', { maxLength: 20, autoCapitalize: 'characters', placeholder: 'Leave empty if not registered' })}
        {field('receiptFooter', 'Line at the bottom of the bill', { maxLength: 160 })}
        {field('manualDiscountMaxPercent', 'Most a cashier can take off without a manager (%)', { inputMode: 'numeric' })}
        {field('returnWindowDays', 'Returns taken for (days; empty = any time)', { inputMode: 'numeric' })}
        {!readOnly && (
          <div style={s.actions}>
            <button type="submit" style={s.primary} disabled={busy || !editing}>{busy ? 'Saving…' : 'Save'}</button>
            {editing && <button type="button" onClick={() => setForm(null)} disabled={busy}>Undo changes</button>}
          </div>
        )}
      </form>
      {connected
        ? <p style={s.muted}>Set in Inventory (Settings → Name, logo and bill details). They reach the till with the next item refresh.</p>
        : !owner && <p style={s.muted}>Only the owner can change these.</p>}
    </section>
  )
}

const s = {
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  grid: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  actions: { gridColumn: '1 / -1', display: 'flex', gap: 8 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 }
}
