import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { QrCode, Boxes, Monitor } from 'lucide-react'
import { setShopUpi, messageFor } from '../lib/api.js'

/**
 * Shop settings. POS-SET-003 (partly), POS-PAY-012.
 *
 * Only what the till needs today and nothing that pretends to be more: the UPI ID the payment QR
 * points at, and links to the Inventory link and the devices. Everything else about the shop is
 * still set up by ScaleEzy and says so.
 */
export default function Settings() {
  const { shop } = useOutletContext() ?? {}
  const queryClient = useQueryClient()
  const current = shop?.shop?.upiId ?? ''
  const [upi, setUpi] = useState(current)
  const [busy, setBusy] = useState(false)
  const owner = (shop?.permissions ?? []).includes('settings:manage')

  async function save(value) {
    setBusy(true)
    try {
      await setShopUpi(value)
      toast.success(value ? 'Saved. The payment screen will show a QR for UPI.' : 'Removed. No QR will be shown.')
      queryClient.invalidateQueries({ queryKey: ['shop'] })
      if (!value) setUpi('')
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={s.page}>
      <h1 style={{ margin: 0 }}>Settings</h1>

      <section style={s.card}>
        <div style={s.head}><span style={s.icon}><QrCode size={18} aria-hidden="true" /></span><b>UPI payments</b></div>
        <p style={s.muted}>
          With your UPI ID here, the payment screen shows a QR code with the amount already filled in. The customer
          scans it with any UPI app. The cashier still types the UPI reference, as today.
        </p>
        <label style={s.label}>
          UPI ID
          <input value={upi} onChange={e => setUpi(e.target.value)} placeholder="lakshmisilks@okhdfcbank" aria-label="UPI ID" disabled={!owner} />
        </label>
        {owner ? (
          <div style={s.actions}>
            <button style={s.primary} disabled={busy || !upi.trim() || upi.trim().toLowerCase() === current} onClick={() => save(upi.trim())}>Save</button>
            {current && <button disabled={busy} onClick={() => save(null)}>Remove</button>}
          </div>
        ) : <p style={s.muted}>Only the owner can change this.</p>}
      </section>

      <Link to="/inventory-link" style={s.row}><span style={s.icon}><Boxes size={18} aria-hidden="true" /></span>Inventory link</Link>
      <Link to="/devices" style={s.row}><span style={s.icon}><Monitor size={18} aria-hidden="true" /></span>Devices</Link>

      <p style={s.muted}>Shop name, GSTIN, address, invoice numbering and discount limits are set up by ScaleEzy for now.</p>
    </div>
  )
}

const s = {
  page: { padding: '20px 20px 28px', display: 'grid', gap: 14, maxWidth: 760, alignContent: 'start' },
  card: { display: 'grid', gap: 10, padding: 16, borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 },
  icon: { display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: 'var(--brand-tint)', color: 'var(--brand-deep)', flex: 'none' },
  label: { display: 'grid', gap: 6, fontSize: 13, color: 'var(--ink-soft)' },
  actions: { display: 'flex', gap: 8 },
  primary: { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: 'var(--panel)',
    border: '1px solid var(--line)', boxShadow: 'var(--shadow)', textDecoration: 'none', color: 'var(--ink)', fontWeight: 600
  },
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 }
}
