import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { QrCode, Boxes, Monitor, Image as ImageIcon, Receipt } from 'lucide-react'
import { setShopUpi, setShopLogo, setShopGst, messageFor } from '../lib/api.js'

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
  const logo = shop?.shop?.logoUrl ?? null
  const registration = shop?.shop?.gstRegistration ?? 'REGULAR'
  const connected = shop?.inventoryConnected === true
  const [busyGst, setBusyGst] = useState(false)

  async function saveGst(value) {
    if (value === registration) return
    setBusyGst(true)
    try {
      await setShopGst(value)
      toast.success('Saved. Bills from now on follow it; bills already given out stay as they were.')
      queryClient.invalidateQueries({ queryKey: ['shop'] })
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyGst(false)
    }
  }
  const [busyLogo, setBusyLogo] = useState(false)

  async function saveLogo(value) {
    setBusyLogo(true)
    try {
      await setShopLogo(value)
      toast.success(value ? 'Saved. It prints at the top of every bill from now.' : 'Removed. Bills show the shop name only.')
      queryClient.invalidateQueries({ queryKey: ['shop'] })
    } catch (err) {
      toast.error(err?.response ? messageFor(err) : err.message)
    } finally {
      setBusyLogo(false)
    }
  }
  async function pickLogo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await saveLogo(await toJpeg(file).catch(err => { toast.error(err.message); return null }) ?? undefined)
  }

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

      <section style={s.card} aria-label="GST registration">
        <div style={s.head}><span style={s.icon}><Receipt size={18} aria-hidden="true" /></span><b>GST registration</b></div>
        <p style={s.muted}>
          Decides what every bill is: a tax invoice, a Bill of Supply (composition -- no GST charged), or a plain
          receipt. Bills already given out keep what they were issued as.
        </p>
        <div style={s.actions} role="radiogroup" aria-label="How the shop is registered for GST">
          {[['REGULAR', 'GST registered'], ['COMPOSITION', 'Composition'], ['UNREGISTERED', 'Not registered']].map(([value, label]) => (
            <button key={value} role="radio" aria-checked={registration === value}
              style={registration === value ? s.primary : undefined}
              disabled={busyGst || connected || !owner} onClick={() => saveGst(value)}>{label}</button>
          ))}
        </div>
        {connected
          ? <p style={s.muted}>Set in Inventory (Settings → Name, logo and bill details). It reaches the till with the next item refresh.</p>
          : !owner && <p style={s.muted}>Only the owner can change this.</p>}
      </section>

      <section style={s.card}>
        <div style={s.head}><span style={s.icon}><ImageIcon size={18} aria-hidden="true" /></span><b>Logo on the bill</b></div>
        <p style={s.muted}>
          Printed at the top of every bill and credit note, and on the PDF sent on WhatsApp. It prints about 4 cm across,
          so a simple mark reads better than fine detail.
        </p>
        {logo && <img src={logo} alt="The logo as it will print" style={s.logoPreview} />}
        {owner ? (
          <div style={s.actions}>
            <input type="file" accept="image/*" aria-label="Choose a logo picture" onChange={pickLogo} disabled={busyLogo} />
            {logo && <button disabled={busyLogo} onClick={() => saveLogo(null)}>Remove</button>}
          </div>
        ) : <p style={s.muted}>Only the owner can change this.</p>}
      </section>

      <Link to="/inventory-link" style={s.row}><span style={s.icon}><Boxes size={18} aria-hidden="true" /></span>Inventory link</Link>
      <Link to="/devices" style={s.row}><span style={s.icon}><Monitor size={18} aria-hidden="true" /></span>Devices</Link>

      <p style={s.muted}>Shop name, GSTIN, address, invoice numbering and discount limits are set up by ScaleEzy for now.</p>
    </div>
  )
}

/*
 * Any picture becomes a small JPEG here, in the browser. 400 px across is more than a 42 mm print
 * can show, and JPEG is the one format the receipt PDF carries without an image library on either
 * side. Drawn on white first, so a transparent PNG does not come out on black.
 */
function toJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 400 / img.width, 200 / img.height)
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * scale))
      c.height = Math.max(1, Math.round(img.height * scale))
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a picture the browser can read.')) }
    img.src = url
  })
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
  muted: { color: 'var(--ink-soft)', fontSize: 13, margin: 0 },
  logoPreview: { maxWidth: 160, maxHeight: 80, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 6 }
}
